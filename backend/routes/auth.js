const express = require('express');
const router = express.Router();
const prisma = require('../prismaClient');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const OtpManagerService = require('../services/otp/OtpManagerService');
const { getSystemDefaultAiSettings, generateDefaultSystemPrompt } = require('../utils/aiPrompt');

// JWT secrets
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key-123';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'fallback-refresh-secret-key-456';
const ACCESS_EXPIRES_IN = '15m';
const REFRESH_EXPIRES_IN = '7d';
const LEGACY_EXPIRES_IN = '24h';

// Helper for standardized v1 responses
const sendV1Response = (res, status, data = null, error = null) => {
    return res.status(status).json({
        success: error === null,
        data,
        error,
        timestamp: new Date().toISOString()
    });
};

// POST /api/auth/signup - Register new generic SaaS users
router.post('/signup', async (req, res) => {
    const { name, email, password, phone, selectedPlan, selectedPlanId } = req.body;
    const isV1 = req.originalUrl.startsWith('/api/v1');

    if (!email || !password || !name || !phone) {
        if (isV1) return sendV1Response(res, 400, null, "Name, email, phone, and password are required");
        return res.status(400).json({ error: "Name, email, phone, and password are required" });
    }

    try {
        let existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            if (!existingUser.isEmailVerified && !existingUser.isActive) {
                await prisma.user.delete({ where: { id: existingUser.id } });
            } else {
                if (isV1) return sendV1Response(res, 400, null, "Email already in use");
                return res.status(400).json({ error: "Email already in use" });
            }
        }

        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        const trialEnabledSetting = await prisma.systemSetting.findUnique({
            where: { key: 'TRIAL_ENABLED' }
        });
        const trialEnabled = trialEnabledSetting ? trialEnabledSetting.value === 'true' : true;

        let trialExpiry = null;
        let assignedPlanId = null;
        let isPaidPlanSelected = false;

        const planIdToUse = selectedPlan || selectedPlanId;

        if (planIdToUse) {
            const plan = await prisma.plan.findUnique({
                where: { id: planIdToUse }
            });
            if (plan) {
                assignedPlanId = plan.id;
                if (Number(plan.price) === 0) {
                    // Free plan: DO NOT activate immediately.
                    // Keep assignedPlanId = null and trialExpiry = null so they start in No Plan state.
                    assignedPlanId = null;
                    trialExpiry = null;
                } else {
                    // Paid plan selected: do NOT activate automatically.
                    // validityExpiresAt stays null — payment must happen first.
                    isPaidPlanSelected = true;
                    trialExpiry = null;
                }
            }
        }

        // Fallback: auto-assign free trial is DISABLED. Users must manually claim it via the dashboard.
        if (!assignedPlanId && !isPaidPlanSelected && trialEnabled) {
            // We no longer auto-assign the free plan.
            // assignedPlanId = null;
            // trialExpiry = null;
        }

        const newUser = await prisma.user.create({
            data: {
                name,
                email,
                phone,
                password: passwordHash,
                role: 'ADMIN',
                isActive: false,
                isEmailVerified: false,
                validityExpiresAt: trialExpiry,
                planId: assignedPlanId,
                message_limit: null,
                contact_limit: null,
                botEnabled: true
            }
        });

        // Initialize AiAgent with default prompt and system default settings
        try {
            const systemDefault = await getSystemDefaultAiSettings();
            const initialPrompt = generateDefaultSystemPrompt({
                name: name,
                email: email,
                phone: phone
            });

            await prisma.aiAgent.create({
                data: {
                    userId: newUser.id,
                    name: name || "Workspace Assistant",
                    toolsEnabled: JSON.stringify(["search_products", "create_payment_link", "search_customer", "get_order_status", "escalate_to_human"]),
                    isActive: true,
                    useOwnAi: false,
                    model: systemDefault.model,
                    systemPrompt: initialPrompt
                }
            });
        } catch (aiAgentErr) {
            console.error("Failed to initialize AiAgent on signup, keeping flow active:", aiAgentErr.message);
        }

        try {
            const result = await OtpManagerService.generateAndSendOTPs(newUser.id, phone, email, 'SIGNUP');

            const payload = {
                message: "Account created successfully. Please verify your OTP(s).",
                email: newUser.email,
                requiresVerification: true,
                requiredChannels: result.requiredChannels,
                pendingChannels: result.requiredChannels
            };

            if (isV1) return sendV1Response(res, 201, payload);
            res.status(201).json(payload);
        } catch (otpError) {
            console.error("Signup OTP Dispatch Error:", otpError);
            await prisma.user.update({
                where: { id: newUser.id },
                data: { isActive: true, isEmailVerified: true }
            });

            // Generate appropriate tokens
            const legacyToken = jwt.sign({ id: newUser.id, role: newUser.role, email: newUser.email }, JWT_SECRET, { expiresIn: LEGACY_EXPIRES_IN });
            const { password: _, ...userToSend } = newUser;

            if (isV1) {
                const accessToken = jwt.sign({ id: newUser.id, role: newUser.role, email: newUser.email }, JWT_SECRET, { expiresIn: ACCESS_EXPIRES_IN });
                const refreshToken = jwt.sign({ id: newUser.id, role: newUser.role, email: newUser.email }, JWT_REFRESH_SECRET, { expiresIn: REFRESH_EXPIRES_IN });
                return sendV1Response(res, 201, {
                    message: "Account created successfully.",
                    accessToken,
                    refreshToken,
                    user: { ...userToSend, isActive: true, isEmailVerified: true }
                });
            }

            return res.status(201).json({
                message: "Account created successfully.",
                email: newUser.email,
                requiresVerification: false,
                token: legacyToken,
                user: { ...userToSend, isActive: true, isEmailVerified: true }
            });
        }
    } catch (error) {
        console.error("Signup Error:", error);
        if (isV1) return sendV1Response(res, 500, null, "Registration failed.");
        res.status(500).json({ error: "Registration failed." });
    }
});

// POST /api/auth/login - Authenticate existing users
router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    const isV1 = req.originalUrl.startsWith('/api/v1');

    if (!email || !password) {
        if (isV1) return sendV1Response(res, 400, null, "Email and password are required");
        return res.status(400).json({ error: "Email and password are required" });
    }

    try {
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            if (isV1) return sendV1Response(res, 401, null, "Invalid credentials");
            return res.status(401).json({ error: "Invalid credentials" });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            if (isV1) return sendV1Response(res, 401, null, "Invalid credentials");
            return res.status(401).json({ error: "Invalid credentials" });
        }

        if (user.role !== 'SUPERADMIN' && !user.isEmailVerified) {
            const result = await OtpManagerService.generateAndSendOTPs(user.id, user.phone, user.email, 'SIGNUP');
            const payload = {
                error: "Please verify your identity to log in.",
                requiresVerification: true,
                email: user.email,
                requiredChannels: result.requiredChannels,
                pendingChannels: result.requiredChannels
            };
            if (isV1) return sendV1Response(res, 403, payload, "Verification required");
            return res.status(403).json(payload);
        }

        // Generate Access & Refresh JWTs
        const legacyToken = jwt.sign({ id: user.id, role: user.role, email: user.email }, JWT_SECRET, { expiresIn: LEGACY_EXPIRES_IN });
        const { password: _, ...userToSend } = user;

        if (isV1) {
            const accessToken = jwt.sign({ id: user.id, role: user.role, email: user.email }, JWT_SECRET, { expiresIn: ACCESS_EXPIRES_IN });
            const refreshToken = jwt.sign({ id: user.id, role: user.role, email: user.email }, JWT_REFRESH_SECRET, { expiresIn: REFRESH_EXPIRES_IN });
            
            return sendV1Response(res, 200, {
                message: "Login successful",
                accessToken,
                refreshToken,
                user: userToSend
            });
        }

        res.status(200).json({
            message: "Login successful",
            token: legacyToken,
            user: userToSend
        });
    } catch (error) {
        console.error("Login Error:", error);
        if (isV1) return sendV1Response(res, 500, null, "Authentication failed.");
        res.status(500).json({ error: "Authentication failed." });
    }
});

// POST /api/auth/refresh - Refresh short-lived Access Token using long-lived Refresh Token
router.post('/refresh', async (req, res) => {
    const { refreshToken } = req.body;
    const isV1 = req.originalUrl.startsWith('/api/v1');

    if (!refreshToken) {
        if (isV1) return sendV1Response(res, 400, null, "Refresh token is required");
        return res.status(400).json({ error: "Refresh token is required" });
    }

    try {
        // Verify Refresh JWT
        const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET);
        const user = await prisma.user.findUnique({ where: { id: decoded.id } });

        if (!user || !user.isActive) {
            if (isV1) return sendV1Response(res, 401, null, "Invalid session or suspended account");
            return res.status(401).json({ error: "Invalid session" });
        }

        // Generate new short-lived Access Token & rotate long-lived Refresh Token
        const newAccessToken = jwt.sign({ id: user.id, role: user.role, email: user.email }, JWT_SECRET, { expiresIn: ACCESS_EXPIRES_IN });
        const newRefreshToken = jwt.sign({ id: user.id, role: user.role, email: user.email }, JWT_REFRESH_SECRET, { expiresIn: REFRESH_EXPIRES_IN });

        if (isV1) {
            return sendV1Response(res, 200, {
                accessToken: newAccessToken,
                refreshToken: newRefreshToken
            });
        }

        res.status(200).json({
            token: newAccessToken,
            accessToken: newAccessToken,
            refreshToken: newRefreshToken
        });
    } catch (error) {
        console.error("Refresh Token Error:", error.message);
        if (isV1) return sendV1Response(res, 401, null, "Session expired, please log in again");
        res.status(401).json({ error: "Invalid refresh token" });
    }
});

// GET /api/auth/plans - Public endpoint to fetch available SaaS plans
router.get('/plans', async (req, res) => {
    try {
        const plans = await prisma.plan.findMany({
            orderBy: { price: 'asc' }
        });
        res.status(200).json(plans);
    } catch (error) {
        console.error("Fetch Public Plans Error:", error);
        res.status(500).json({ error: "Failed to fetch plans" });
    }
});

// GET /api/auth/branding - Public endpoint to fetch SaaS branding details
router.get('/branding', async (req, res) => {
    try {
        const settings = await prisma.systemSetting.findMany({
            where: { key: { in: ['PLATFORM_NAME', 'PLATFORM_LOGO_URL', 'FRESH_THEME_LOGO_URL', 'PLATFORM_FAVICON_URL', 'SUPPORT_PHONE_NUMBER', 'LANDING_HERO_TITLE', 'LANDING_HERO_SUBTITLE', 'LANDING_FEATURES_JSON', 'LANDING_TESTIMONIALS_JSON', 'EMBEDDED_SIGNUP_ENABLED', 'EMBEDDED_SIGNUP_APP_ID', 'EMBEDDED_SIGNUP_CONFIG_ID', 'MANUAL_SETUP_VIDEO_URL', 'LANDING_PRIVACY_POLICY', 'LANDING_TERMS_CONDITIONS', 'LANDING_REFUND_POLICY', 'TRIAL_ENABLED', 'DEFAULT_TRIAL_DAYS', 'TRIAL_SIGNUP_TEXT', 'FRONTEND_THEME', 'GOOGLE_OAUTH_ENABLED', 'FACEBOOK_OAUTH_ENABLED', 'META_JS_SDK_SDK_VERSION', 'META_JS_SDK_VERSION', 'META_GRAPH_API_VERSION', 'META_API_VERSION', 'META_EMBEDDED_SIGNUP_VERSION', 'META_BUSINESS_APP_ONBOARDING_ENABLED', 'META_SETTINGS_LAST_UPDATED'] } }
        });

        const trialEnabledVal = settings.find(s => s.key === 'TRIAL_ENABLED')?.value;
        const trialEnabled = trialEnabledVal === undefined ? true : trialEnabledVal === 'true';
        const trialDurationDays = parseInt(settings.find(s => s.key === 'DEFAULT_TRIAL_DAYS')?.value || '7', 10);
        const trialSignupText = settings.find(s => s.key === 'TRIAL_SIGNUP_TEXT')?.value || 'Start your 7-day free trial';

        const branding = {
            name: settings.find(s => s.key === 'PLATFORM_NAME')?.value || 'Platform',
            logoUrl: settings.find(s => s.key === 'PLATFORM_LOGO_URL')?.value || null,
            freshLogoUrl: settings.find(s => s.key === 'FRESH_THEME_LOGO_URL')?.value || null,
            faviconUrl: settings.find(s => s.key === 'PLATFORM_FAVICON_URL')?.value || null,
            supportPhoneNumber: settings.find(s => s.key === 'SUPPORT_PHONE_NUMBER')?.value || null,
            landingHeroTitle: settings.find(s => s.key === 'LANDING_HERO_TITLE')?.value || 'Automate your business on WhatsApp',
            landingHeroSubtitle: settings.find(s => s.key === 'LANDING_HERO_SUBTITLE')?.value || null,
            landingFeaturesJson: settings.find(s => s.key === 'LANDING_FEATURES_JSON')?.value || '[]',
            landingTestimonialsJson: settings.find(s => s.key === 'LANDING_TESTIMONIALS_JSON')?.value || '[]',
            landingPrivacyPolicy: settings.find(s => s.key === 'LANDING_PRIVACY_POLICY')?.value || '',
            landingTermsConditions: settings.find(s => s.key === 'LANDING_TERMS_CONDITIONS')?.value || '',
            landingRefundPolicy: settings.find(s => s.key === 'LANDING_REFUND_POLICY')?.value || '',
            embeddedSignupEnabled: settings.find(s => s.key === 'EMBEDDED_SIGNUP_ENABLED')?.value === 'true',
            embeddedSignupAppId: settings.find(s => s.key === 'EMBEDDED_SIGNUP_APP_ID')?.value || '',
            embeddedSignupConfigId: settings.find(s => s.key === 'EMBEDDED_SIGNUP_CONFIG_ID')?.value || '',
            manualSetupVideoUrl: settings.find(s => s.key === 'MANUAL_SETUP_VIDEO_URL')?.value || null,
            trialEnabled,
            trialDurationDays,
            trialSignupText,
            frontendTheme: settings.find(s => s.key === 'FRONTEND_THEME')?.value || 'classic',
            googleOauthEnabled: settings.find(s => s.key === 'GOOGLE_OAUTH_ENABLED')?.value === 'true',
            facebookOauthEnabled: settings.find(s => s.key === 'FACEBOOK_OAUTH_ENABLED')?.value === 'true',
            metaJsSdkVersion: settings.find(s => s.key === 'META_JS_SDK_VERSION')?.value || 'v19.0',
            metaGraphApiVersion: settings.find(s => s.key === 'META_GRAPH_API_VERSION')?.value || settings.find(s => s.key === 'META_API_VERSION')?.value || 'v20.0',
            metaEmbeddedSignupVersion: settings.find(s => s.key === 'META_EMBEDDED_SIGNUP_VERSION')?.value || 'v19.0',
            metaBusinessAppOnboardingEnabled: settings.find(s => s.key === 'META_BUSINESS_APP_ONBOARDING_ENABLED')?.value === 'true',
            metaSettingsLastUpdated: settings.find(s => s.key === 'META_SETTINGS_LAST_UPDATED')?.value || ''
        };

        res.status(200).json(branding);
    } catch (error) {
        console.error("Fetch Branding Error:", error);
        res.status(500).json({ error: "Failed to fetch branding" });
    }
});

// POST /api/auth/verify-otp - Verify multi-channel OTP
router.post('/verify-otp', async (req, res) => {
    const { email, otp, channel = 'EMAIL', context = 'SIGNUP' } = req.body;

    if (!email || !otp) {
        return res.status(400).json({ error: "Email and OTP are required" });
    }

    try {
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        if (user.isEmailVerified && context === 'SIGNUP') {
            return res.status(400).json({ error: "User is already verified" });
        }

        // 1. Verify this specific channel's OTP
        await OtpManagerService.verifyOTP(user.id, channel, otp, context);

        // 2. Check if the whole context is satisfied
        const verifiedCheck = await OtpManagerService.isContextFullyVerified(user.id, context);

        if (!verifiedCheck.isFullyVerified) {
            return res.status(200).json({
                message: `${channel} verified. Pending channels remain.`,
                requiresMoreVerification: true,
                requiredChannels: verifiedCheck.requiredChannels,
                pendingChannels: verifiedCheck.pendingChannels
            });
        }

        // 3. Fully Verified - Activate Account & Login
        await prisma.user.update({
            where: { id: user.id },
            data: {
                isEmailVerified: true,
                isActive: true
            }
        });

        // Trigger onboarding call automatically on registration
        if (process.env.ENABLE_AI_VOICE_CALLING === 'true') {
            try {
                const VoiceOrchestrator = require('../services/voice/VoiceOrchestrator');
                const MetaApiService = require('../services/MetaApiService');

                const admin = await prisma.user.findFirst({ where: { role: 'SUPERADMIN' } });
                if (admin) {
                    let adminContact = await prisma.contact.findFirst({
                        where: { userId: admin.id, phone: user.phone }
                    });
                    if (!adminContact) {
                        adminContact = await prisma.contact.create({
                            data: {
                                userId: admin.id,
                                phone: user.phone,
                                name: user.name
                            }
                        });
                    }

                    // Trigger outbound onboarding call using the Admin's AI agent
                    try {
                        await VoiceOrchestrator.initiateCall(admin.id, adminContact.id, user.phone, {
                            name: user.name,
                            intent: 'welcome_onboarding',
                            summary: 'Welcome to our WhatsApp CRM platform. I am your virtual onboarding assistant.'
                        });
                    } catch (voiceErr) {
                        console.error("Failed to initiate onboarding voice call:", voiceErr.message);
                    }
                }

                // Send WhatsApp summary to the master onboarding number (configured via MASTER_ONBOARDING_PHONE env)
                const masterOnboardingPhone = process.env.MASTER_ONBOARDING_PHONE;
                const systemMetaTokenSetting = await prisma.systemSetting.findUnique({ where: { key: 'SYSTEM_META_TOKEN' } });
                const systemPhoneIdSetting = await prisma.systemSetting.findUnique({ where: { key: 'SYSTEM_PHONE_NUMBER_ID' } });

                if (masterOnboardingPhone && systemMetaTokenSetting?.value && systemPhoneIdSetting?.value) {
                    await MetaApiService.sendText({
                        phoneNumberId: systemPhoneIdSetting.value,
                        token: systemMetaTokenSetting.value,
                        to: masterOnboardingPhone,
                        text: `🎉 [New Registration]: ${user.name} (${user.email}, Phone: ${user.phone}) has registered. Outbound onboarding voice call initiated.`,
                        context: { userId: user.id }
                    });
                }
            } catch (err) {
                console.error('[Onboarding Call Trigger Error]:', err.message);
            }
        }

        // Cleanup DB
        await OtpManagerService.cleanupContext(user.id, context);

        // Generate Login Token
        const token = jwt.sign({ id: user.id, role: user.role, email: user.email }, JWT_SECRET, { expiresIn: LEGACY_EXPIRES_IN });
        const { password, ...userToSend } = user;
        userToSend.isEmailVerified = true;

        res.status(200).json({
            message: "All required verifications completed successfully",
            token,
            user: userToSend
        });
    } catch (error) {
        console.error("OTP verification error:", error);
        res.status(401).json({ error: error.message || "Verification failed." });
    }
});

// POST /api/auth/resend-otp - Resend Multi-Channel OTP
router.post('/resend-otp', async (req, res) => {
    const { email, channel, context = 'SIGNUP' } = req.body;

    if (!email || !channel) {
        return res.status(400).json({ error: "Email and channel are required" });
    }

    try {
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }
        if (user.isEmailVerified && context === 'SIGNUP') {
            return res.status(400).json({ error: "User is already verified" });
        }

        await OtpManagerService.resendOTP(user.id, user.phone, user.email, channel, context);

        res.status(200).json({ message: `A new OTP has been sent to your ${channel}.` });
    } catch (error) {
        console.error("OTP resend error:", error);
        res.status(400).json({ error: error.message || "Failed to resend OTP." });
    }
});

// GET /api/auth/status - Public endpoint to check system maintenance mode
router.get('/status', async (req, res) => {
    try {
        const maintenanceSetting = await prisma.systemSetting.findUnique({
            where: { key: 'MAINTENANCE_MODE' }
        });
        const isMaintenance = maintenanceSetting?.value === 'true';
        res.status(200).json({ maintenanceMode: isMaintenance });
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch status" });
    }
});

// POST /api/auth/forgot-password - Solicits an OTP for password reset
router.post('/forgot-password', async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email is required" });

    try {
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            // Return success even if not found to prevent enumeration
            return res.status(200).json({ message: "If an account exists, a recovery OTP has been sent." });
        }

        const result = await OtpManagerService.generateAndSendOTPs(user.id, user.phone, user.email, 'FORGOT_PASSWORD');

        res.status(200).json({
            message: "If an account exists, a recovery OTP has been sent.",
            requiredChannels: result.requiredChannels,
            pendingChannels: result.requiredChannels
        });
    } catch (error) {
        console.error("Forgot password error:", error);
        res.status(500).json({ error: "Failed to process request." });
    }
});

// POST /api/auth/reset-password - Resets the password using multi-channel OTP
router.post('/reset-password', async (req, res) => {
    const { email, otp, newPassword, channel = 'EMAIL' } = req.body;

    if (!email || !otp || !newPassword) {
        return res.status(400).json({ error: "Email, OTP, and new password are required." });
    }

    try {
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return res.status(404).json({ error: "User not found." });

        // 1. Verify this specific channel
        await OtpManagerService.verifyOTP(user.id, channel, otp, 'FORGOT_PASSWORD');

        // 2. Check complete context
        const verifiedCheck = await OtpManagerService.isContextFullyVerified(user.id, 'FORGOT_PASSWORD');

        if (!verifiedCheck.isFullyVerified) {
            return res.status(200).json({
                message: `${channel} verified. Pending channels remain.`,
                requiresMoreVerification: true,
                requiredChannels: verifiedCheck.requiredChannels,
                pendingChannels: verifiedCheck.pendingChannels
            });
        }

        // 3. Fully Verified - Apply new password
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(newPassword, salt);

        await prisma.user.update({
            where: { id: user.id },
            data: { password: passwordHash }
        });

        // Cleanup
        await OtpManagerService.cleanupContext(user.id, 'FORGOT_PASSWORD');

        res.status(200).json({ message: "Password has been successfully reset. You can now log in." });
    } catch (error) {
        console.error("Reset password error:", error);
        res.status(401).json({ error: error.message || "Failed to reset password." });
    }
});

module.exports = router;
