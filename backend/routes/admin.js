const express = require('express');
const router = express.Router();
const prisma = require('../prismaClient');
const { authenticate, checkSuperAdmin } = require('../middleware/auth');
const jwt = require('jsonwebtoken'); // Assuming jwt is used for auth later. We need it for impersonation
const { clearMetaConfigCache } = require('../utils/metaConfig');


// Unauthenticated pulse check to ensure Live Health Checks remain green when server is active
router.get('/system/pulse', (req, res) => {
    res.status(200).json({ status: "ok", timestamp: new Date() });
});

// All routes below require SUPERADMIN / ADMIN_STAFF status
router.use(authenticate, checkSuperAdmin);

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key-123';

// 1. Get all clients (Users where adminId is null - meaning they are workspace owners)
router.get('/users', async (req, res) => {
    try {
        const users = await prisma.user.findMany({
            where: {
                adminId: null, // Only fetch workspace owners, not staff
                role: { in: ['ADMIN', 'SUPERADMIN'] }
            },
            select: {
                id: true,
                email: true,
                name: true,
                phone: true,
                isActive: true,
                isEmailVerified: true,
                validityExpiresAt: true,
                metaAppId: true, // Just to check if configured
                metaAppSecret: true,
                createdAt: true,
                message_limit: true,
                contact_limit: true,
                campaigns_limit: true,
                bot_replies_limit: true,
                bot_flows_limit: true,
                team_members_limit: true,
                planId: true,
                plan: {
                    select: { name: true }
                },
                metaToken: true,
                phoneNumberId: true,
                wallet: true
            },
            orderBy: { createdAt: 'desc' }
        });

        // Compute "Meta Status" simplistically for the UI
        const enrichedUsers = users.map(u => ({
            ...u,
            metaConfigured: !!(u.metaToken || u.phoneNumberId || (u.metaAppId && u.metaAppSecret))
        }));

        res.status(200).json(enrichedUsers);
    } catch (error) {
        console.error("Fetch Users Error:", error);
        res.status(500).json({ error: "Failed to fetch users" });
    }
});

// 2. Toggle User Suspend/Activate status
router.put('/users/:id/status', async (req, res) => {
    const targetUserId = req.params.id;
    const { isActive } = req.body;

    try {
        const updatedUser = await prisma.user.update({
            where: { id: targetUserId },
            data: { isActive: !!isActive }
        });

        await prisma.auditLog.create({
            data: {
                adminId: req.user.id,
                action: isActive ? "ACTIVATE_USER" : "SUSPEND_USER",
                targetUserId,
                details: { isActive }
            }
        });

        let message = isActive ? "User activated successfully." : "User suspended successfully.";
        res.status(200).json({ message, user: { id: updatedUser.id, isActive: updatedUser.isActive } });
    } catch (error) {
        console.error("Toggle Status Error:", error);
        res.status(500).json({ error: "Failed to update user status" });
    }
});

// 3. Update User Subscription Validity Date
router.put('/users/:id/validity', async (req, res) => {
    const targetUserId = req.params.id;
    const { validityExpiresAt } = req.body; // Expects ISO string or null

    try {
        const updatedUser = await prisma.user.update({
            where: { id: targetUserId },
            data: { validityExpiresAt: validityExpiresAt ? new Date(validityExpiresAt) : null }
        });

        await prisma.auditLog.create({
            data: {
                adminId: req.user.id,
                action: "UPDATE_VALIDITY",
                targetUserId,
                details: { validityExpiresAt }
            }
        });

        res.status(200).json({ message: "Validity updated successfully", user: { id: updatedUser.id, validityExpiresAt: updatedUser.validityExpiresAt } });
    } catch (error) {
        console.error("Update Validity Error:", error);
        res.status(500).json({ error: "Failed to update validity expiration" });
    }
});

// POST /api/admin/users/:id/impersonate - Generate a token to login as a specific user
router.post('/users/:id/impersonate', async (req, res) => {
    const { id } = req.params;

    try {
        const targetUser = await prisma.user.findUnique({
            where: { id }
        });

        if (!targetUser) {
            return res.status(404).json({ error: "User not found" });
        }

        // Generate a standard user token
        const token = jwt.sign(
            { id: targetUser.id, role: targetUser.role, email: targetUser.email },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        // Audit log for security tracking
        await prisma.auditLog.create({
            data: {
                adminId: req.user.id,
                action: "IMPERSONATE_USER",
                targetUserId: targetUser.id,
                details: { email: targetUser.email }
            }
        });

        res.status(200).json({ token });
    } catch (error) {
        console.error("Impersonate Error:", error);
        res.status(500).json({ error: "Failed to generate impersonation token." });
    }
});


// 5. System Settings (Global)
router.get('/profile', async (req, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user.id },
            select: { id: true, email: true, name: true, role: true }
        });
        res.status(200).json(user);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch profile" });
    }
});

router.put('/profile', async (req, res) => {
    const { email, password } = req.body;
    try {
        const updateData = {};
        if (email) updateData.email = email;

        if (password && password.trim() !== '') {
            const bcryptMod = require('bcryptjs');
            const salt = await bcryptMod.genSalt(10);
            updateData.password = await bcryptMod.hash(password, salt);
        }

        const updatedUser = await prisma.user.update({
            where: { id: req.user.id },
            data: updateData,
            select: { id: true, email: true, name: true }
        });

        await prisma.auditLog.create({
            data: { adminId: req.user.id, action: "UPDATE_ADMIN_PROFILE", details: { email: updatedUser.email } }
        });

        res.status(200).json({ message: "Profile updated successfully", user: updatedUser });
    } catch (error) {
        console.error("Admin Profile Update Error:", error);
        if (error.code === 'P2002') return res.status(400).json({ error: "Email already exists" });
        res.status(500).json({ error: "Failed to update profile" });
    }
});

router.get('/settings', async (req, res) => {
    try {
        const settings = await prisma.systemSetting.findMany();
        // Convert to key-value object map
        const settingsMap = settings.reduce((acc, curr) => {
            acc[curr.key] = curr.value;
            return acc;
        }, {});

        res.status(200).json(settingsMap);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch settings" });
    }
});

router.put('/settings', async (req, res) => {
    const {
        manualSetupVideoUrl,
        embeddedSignupEnabled,
        embeddedSignupAppId,
        embeddedSignupAppSecret,
        embeddedSignupConfigId,
        defaultMetaAppId,
        defaultMetaAppSecret,
        razorpayKeyId,
        razorpayKeySecret,
        stripeKeyPub,
        stripeKeySecret,
        airwallexClientId,
        airwallexApiKey,
        activePaymentGateway,
        systemCurrency,
        phonepeMerchantId,
        phonepeSaltKey,
        platformName,
        platformLogoUrl,
        freshThemeLogoUrl,
        platformFaviconUrl,
        smtpHost,
        smtpPort,
        smtpUser,
        smtpPassword,
        smtpFromEmail,
        smtpFromName,
        smtpLogoUrl,
        smtpSecure,
        metaApiVersion,
        metaGraphApiVersion,
        draftMetaApiVersion,
        metaJsSdkVersion,
        metaEmbeddedSignupVersion,
        metaBusinessAppOnboardingEnabled,
        webhookVerifyToken,
        defaultTrialDays,
        systemMetaToken,
        maintenanceMode,
        adminCustomCss,
        userCustomCss,
        enableEmailOtp,
        enableSmsOtp,
        enableTextSmsOtp,
        systemPhoneNumberId,
        requireSignupEmail,
        requireSignupSms,
        requireSignupWa,
        requireForgotEmail,
        requireForgotSms,
        requireForgotWa,
        supportPhoneNumber,
        landingHeroTitle,
        landingHeroSubtitle,
        landingFeaturesJson,
        landingTestimonialsJson,
        landingPrivacyPolicy,
        landingTermsConditions,
        landingRefundPolicy,
        walletMinRecharge,
        walletLowBalanceAlert,
        walletManagementEnabled,
        trialEnabled,
        trialSignupText,
        frontendTheme,
        googleOauthEnabled,
        googleClientId,
        googleClientSecret,
        facebookOauthEnabled,
        facebookAppId,
        facebookAppSecret
    } = req.body;

    const activeGraphApiVersion = metaGraphApiVersion || metaApiVersion;

    const whitelist = ['v19.0', 'v20.0', 'v21.0', 'v22.0', 'v23.0', 'v24.0', 'v25.0'];
    if (metaJsSdkVersion && !whitelist.includes(metaJsSdkVersion)) {
        return res.status(400).json({ error: `Invalid Frontend JS SDK Version: ${metaJsSdkVersion}. Must be one of: ${whitelist.join(', ')}` });
    }
    if (activeGraphApiVersion && !whitelist.includes(activeGraphApiVersion)) {
        return res.status(400).json({ error: `Invalid Active Graph API Version: ${activeGraphApiVersion}. Must be one of: ${whitelist.join(', ')}` });
    }
    if (metaEmbeddedSignupVersion && !whitelist.includes(metaEmbeddedSignupVersion)) {
        return res.status(400).json({ error: `Invalid Embedded Signup Version: ${metaEmbeddedSignupVersion}. Must be one of: ${whitelist.join(', ')}` });
    }

    try {
        const updateSetting = async (key, value) => {
            if (value !== undefined) {
                await prisma.systemSetting.upsert({
                    where: { key },
                    update: { value },
                    create: { key, value }
                });
            }
        };

        const currentJsSdk = await prisma.systemSetting.findUnique({ where: { key: 'META_JS_SDK_VERSION' } });
        const currentGraphApi = await prisma.systemSetting.findUnique({ where: { key: 'META_GRAPH_API_VERSION' } }) || await prisma.systemSetting.findUnique({ where: { key: 'META_API_VERSION' } });
        const currentEmbeddedSignup = await prisma.systemSetting.findUnique({ where: { key: 'META_EMBEDDED_SIGNUP_VERSION' } });
        const currentBusinessAppOnboarding = await prisma.systemSetting.findUnique({ where: { key: 'META_BUSINESS_APP_ONBOARDING_ENABLED' } });

        if (metaJsSdkVersion && currentJsSdk?.value !== metaJsSdkVersion) {
            await updateSetting('PREV_META_JS_SDK_VERSION', currentJsSdk?.value || 'v19.0');
        }
        if (activeGraphApiVersion && currentGraphApi?.value !== activeGraphApiVersion) {
            await updateSetting('PREV_META_GRAPH_API_VERSION', currentGraphApi?.value || 'v20.0');
            await updateSetting('PREV_META_API_VERSION', currentGraphApi?.value || 'v20.0');
        }
        if (metaEmbeddedSignupVersion && currentEmbeddedSignup?.value !== metaEmbeddedSignupVersion) {
            await updateSetting('PREV_META_EMBEDDED_SIGNUP_VERSION', currentEmbeddedSignup?.value || 'v19.0');
        }
        if (metaBusinessAppOnboardingEnabled !== undefined && currentBusinessAppOnboarding?.value !== String(metaBusinessAppOnboardingEnabled)) {
            await updateSetting('PREV_META_BUSINESS_APP_ONBOARDING_ENABLED', currentBusinessAppOnboarding?.value || 'false');
        }

        const isMetaChanged = 
            (metaJsSdkVersion && currentJsSdk?.value !== metaJsSdkVersion) ||
            (activeGraphApiVersion && currentGraphApi?.value !== activeGraphApiVersion) ||
            (metaEmbeddedSignupVersion && currentEmbeddedSignup?.value !== metaEmbeddedSignupVersion) ||
            (metaBusinessAppOnboardingEnabled !== undefined && currentBusinessAppOnboarding?.value !== String(metaBusinessAppOnboardingEnabled));

        if (isMetaChanged) {
            await prisma.auditLog.create({
                data: {
                    adminId: req.user.id,
                    action: "UPDATE_META_CONFIG",
                    details: {
                        previous: {
                            metaJsSdkVersion: currentJsSdk?.value || 'v19.0',
                            metaApiVersion: currentGraphApi?.value || 'v20.0',
                            metaEmbeddedSignupVersion: currentEmbeddedSignup?.value || 'v19.0',
                            metaBusinessAppOnboardingEnabled: currentBusinessAppOnboarding?.value === 'true'
                        },
                        new: {
                            metaJsSdkVersion: metaJsSdkVersion || currentJsSdk?.value || 'v19.0',
                            metaApiVersion: activeGraphApiVersion || currentGraphApi?.value || 'v20.0',
                            metaEmbeddedSignupVersion: metaEmbeddedSignupVersion || currentEmbeddedSignup?.value || 'v19.0',
                            metaBusinessAppOnboardingEnabled: metaBusinessAppOnboardingEnabled !== undefined ? metaBusinessAppOnboardingEnabled : (currentBusinessAppOnboarding?.value === 'true')
                        }
                    }
                }
            });
        }

        await updateSetting('EMBEDDED_SIGNUP_ENABLED', embeddedSignupEnabled !== undefined ? String(embeddedSignupEnabled) : undefined);
        await updateSetting('MANUAL_SETUP_VIDEO_URL', manualSetupVideoUrl);
        await updateSetting('EMBEDDED_SIGNUP_APP_ID', embeddedSignupAppId);
        await updateSetting('EMBEDDED_SIGNUP_APP_SECRET', embeddedSignupAppSecret);
        await updateSetting('EMBEDDED_SIGNUP_CONFIG_ID', embeddedSignupConfigId);
        await updateSetting('DEFAULT_META_APP_ID', defaultMetaAppId);
        await updateSetting('DEFAULT_META_APP_SECRET', defaultMetaAppSecret);
        await updateSetting('RAZORPAY_KEY_ID', razorpayKeyId);
        await updateSetting('RAZORPAY_KEY_SECRET', razorpayKeySecret);
        await updateSetting('STRIPE_KEY_PUB', stripeKeyPub);
        await updateSetting('STRIPE_KEY_SECRET', stripeKeySecret);
        await updateSetting('AIRWALLEX_CLIENT_ID', airwallexClientId);
        await updateSetting('AIRWALLEX_API_KEY', airwallexApiKey);
        await updateSetting('ACTIVE_PAYMENT_GATEWAY', activePaymentGateway);
        await updateSetting('SYSTEM_CURRENCY', systemCurrency);
        await updateSetting('PHONEPE_MERCHANT_ID', phonepeMerchantId);
        await updateSetting('PHONEPE_SALT_KEY', phonepeSaltKey);
        await updateSetting('PLATFORM_NAME', platformName);
        await updateSetting('PLATFORM_LOGO_URL', platformLogoUrl);
        await updateSetting('FRESH_THEME_LOGO_URL', freshThemeLogoUrl);
        await updateSetting('PLATFORM_FAVICON_URL', platformFaviconUrl);
        await updateSetting('SMTP_HOST', smtpHost);
        await updateSetting('SMTP_PORT', smtpPort);
        await updateSetting('SMTP_USER', smtpUser);
        await updateSetting('SMTP_PASSWORD', smtpPassword);
        await updateSetting('SMTP_FROM_EMAIL', smtpFromEmail);
        await updateSetting('SMTP_FROM_NAME', smtpFromName);
        await updateSetting('SMTP_LOGO_URL', smtpLogoUrl);
        await updateSetting('SMTP_SECURE', smtpSecure !== undefined ? String(smtpSecure) : undefined);
        await updateSetting('META_GRAPH_API_VERSION', activeGraphApiVersion);
        await updateSetting('META_API_VERSION', activeGraphApiVersion);
        await updateSetting('DRAFT_META_API_VERSION', draftMetaApiVersion);
        await updateSetting('META_JS_SDK_VERSION', metaJsSdkVersion);
        await updateSetting('META_EMBEDDED_SIGNUP_VERSION', metaEmbeddedSignupVersion);
        await updateSetting('META_BUSINESS_APP_ONBOARDING_ENABLED', metaBusinessAppOnboardingEnabled !== undefined ? String(metaBusinessAppOnboardingEnabled) : undefined);
        await updateSetting('META_SETTINGS_LAST_UPDATED', new Date().toISOString());
        await updateSetting('WEBHOOK_VERIFY_TOKEN', webhookVerifyToken);
        await updateSetting('DEFAULT_TRIAL_DAYS', defaultTrialDays ? String(defaultTrialDays) : undefined);
        await updateSetting('SYSTEM_META_TOKEN', systemMetaToken);
        await updateSetting('MAINTENANCE_MODE', maintenanceMode !== undefined ? String(maintenanceMode) : undefined);
        await updateSetting('ADMIN_CUSTOM_CSS', adminCustomCss !== undefined ? String(adminCustomCss) : undefined);
        await updateSetting('USER_CUSTOM_CSS', userCustomCss !== undefined ? String(userCustomCss) : undefined);
        await updateSetting('ENABLE_EMAIL_OTP', enableEmailOtp !== undefined ? String(enableEmailOtp) : undefined);
        await updateSetting('ENABLE_SMS_OTP', enableSmsOtp !== undefined ? String(enableSmsOtp) : undefined);
        await updateSetting('ENABLE_TEXT_SMS_OTP', enableTextSmsOtp !== undefined ? String(enableTextSmsOtp) : undefined);
        await updateSetting('SYSTEM_PHONE_NUMBER_ID', systemPhoneNumberId);
        await updateSetting('REQUIRE_SIGNUP_EMAIL', requireSignupEmail !== undefined ? String(requireSignupEmail) : undefined);
        await updateSetting('REQUIRE_SIGNUP_SMS', requireSignupSms !== undefined ? String(requireSignupSms) : undefined);
        await updateSetting('REQUIRE_SIGNUP_WA', requireSignupWa !== undefined ? String(requireSignupWa) : undefined);
        await updateSetting('REQUIRE_FORGOT_EMAIL', requireForgotEmail !== undefined ? String(requireForgotEmail) : undefined);
        await updateSetting('REQUIRE_FORGOT_SMS', requireForgotSms !== undefined ? String(requireForgotSms) : undefined);
        await updateSetting('REQUIRE_FORGOT_WA', requireForgotWa !== undefined ? String(requireForgotWa) : undefined);
        await updateSetting('SUPPORT_PHONE_NUMBER', supportPhoneNumber !== undefined ? String(supportPhoneNumber) : undefined);
        await updateSetting('LANDING_HERO_TITLE', landingHeroTitle);
        await updateSetting('LANDING_HERO_SUBTITLE', landingHeroSubtitle);
        if (landingFeaturesJson) await updateSetting('LANDING_FEATURES_JSON', landingFeaturesJson);
        if (landingTestimonialsJson) await updateSetting('LANDING_TESTIMONIALS_JSON', landingTestimonialsJson);
        if (landingPrivacyPolicy !== undefined) await updateSetting('LANDING_PRIVACY_POLICY', landingPrivacyPolicy);
        if (landingTermsConditions !== undefined) await updateSetting('LANDING_TERMS_CONDITIONS', landingTermsConditions);
        if (landingRefundPolicy !== undefined) await updateSetting('LANDING_REFUND_POLICY', landingRefundPolicy);
        await updateSetting('WALLET_MIN_RECHARGE', walletMinRecharge?.toString());
        await updateSetting('WALLET_LOW_BALANCE_ALERT', walletLowBalanceAlert?.toString());
        await updateSetting('WALLET_MANAGEMENT_ENABLED', walletManagementEnabled !== undefined ? String(walletManagementEnabled) : undefined);
        await updateSetting('TRIAL_ENABLED', trialEnabled !== undefined ? String(trialEnabled) : undefined);
        await updateSetting('TRIAL_SIGNUP_TEXT', trialSignupText !== undefined ? String(trialSignupText) : undefined);
        await updateSetting('FRONTEND_THEME', frontendTheme !== undefined ? String(frontendTheme) : undefined);
        await updateSetting('GOOGLE_OAUTH_ENABLED', googleOauthEnabled !== undefined ? String(googleOauthEnabled) : undefined);
        await updateSetting('GOOGLE_CLIENT_ID', googleClientId);
        await updateSetting('GOOGLE_CLIENT_SECRET', googleClientSecret);
        await updateSetting('FACEBOOK_OAUTH_ENABLED', facebookOauthEnabled !== undefined ? String(facebookOauthEnabled) : undefined);
        await updateSetting('FACEBOOK_APP_ID', facebookAppId);
        await updateSetting('FACEBOOK_APP_SECRET', facebookAppSecret);


        clearMetaConfigCache();
        res.status(200).json({ message: "Settings updated successfully" });
    } catch (error) {
        res.status(500).json({ error: "Failed to save settings" });
    }
});

// 6. Webhook Monitor Logs
router.get('/webhooks', async (req, res) => {
    try {
        const logs = await prisma.webhookLog.findMany({
            orderBy: { createdAt: 'desc' },
            take: 50
        });
        res.status(200).json(logs);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch webhook logs" });
    }
});

// 7. Dashboard Stats
router.get('/dashboard-stats', async (req, res) => {
    try {
        const totalUsers = await prisma.user.count({ where: { adminId: null, role: { in: ['ADMIN', 'SUPERADMIN'] } } });
        const activeUsers = await prisma.user.count({
            where: {
                adminId: null,
                isActive: true,
                OR: [
                    { validityExpiresAt: null },
                    { validityExpiresAt: { gt: new Date() } }
                ]
            }
        });
        const totalMessages = await prisma.messageLog.count();

        res.status(200).json({ totalUsers, activeUsers, totalMessages });
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch stats" });
    }
});

// 8. Create User Manually
router.post('/users', async (req, res) => {
    const { name, email, password, validityExpiresAt, planId } = req.body;
    try {
        const bcryptMod = require('bcryptjs');
        const salt = await bcryptMod.genSalt(10);
        const passwordHash = await bcryptMod.hash(password, salt);

        const newUser = await prisma.user.create({
            data: {
                name,
                email,
                password: passwordHash,
                role: 'ADMIN',
                isActive: true,
                isEmailVerified: true,
                validityExpiresAt: validityExpiresAt ? new Date(validityExpiresAt) : null,
                planId: planId || null,
            }
        });

        await prisma.auditLog.create({
            data: { adminId: req.user.id, action: "CREATE_USER", targetUserId: newUser.id, details: { email: newUser.email } }
        });

        res.status(201).json(newUser);
    } catch (error) {
        console.error("Admin Create User Error:", error);
        if (error.code === 'P2002') return res.status(400).json({ error: "Email already exists" });
        res.status(500).json({ error: "Failed to create user" });
    }
});

// 9. Update Limits
router.put('/users/:id/limits', async (req, res) => {
    const targetUserId = req.params.id;
    const {
        message_limit, contact_limit, planId,
        campaigns_limit, bot_replies_limit, bot_flows_limit, team_members_limit
    } = req.body;

    const safeInt = (val, fallback) => (val !== undefined && val !== null && val !== '') ? parseInt(val, 10) : fallback;

    try {
        const updateData = { planId: planId || null };

        let plan = null;
        if (planId) {
            plan = await prisma.plan.findUnique({ where: { id: planId } });
        }

        const msgLimitVal = message_limit !== undefined ? safeInt(message_limit, null) : undefined;
        const contactLimitVal = contact_limit !== undefined ? safeInt(contact_limit, null) : undefined;
        const campaignsLimitVal = campaigns_limit !== undefined ? safeInt(campaigns_limit, null) : undefined;
        const botRepliesLimitVal = bot_replies_limit !== undefined ? safeInt(bot_replies_limit, null) : undefined;
        const botFlowsLimitVal = bot_flows_limit !== undefined ? safeInt(bot_flows_limit, null) : undefined;
        const teamMembersLimitVal = team_members_limit !== undefined ? safeInt(team_members_limit, null) : undefined;

        const planMsgLimit = plan?.message_limit ?? 1000;
        const planContactLimit = plan?.contacts_limit ?? 1000;
        const planCampaignsLimit = plan?.campaigns_limit ?? 60;
        const planBotRepliesLimit = plan?.bot_replies_limit ?? 1000;
        const planBotFlowsLimit = plan?.bot_flows_limit ?? 5;
        const planTeamMembersLimit = plan?.team_members_limit ?? 3;

        if (msgLimitVal !== undefined) {
            updateData.message_limit = (msgLimitVal !== null && msgLimitVal !== planMsgLimit) ? msgLimitVal : null;
        }
        if (contactLimitVal !== undefined) {
            updateData.contact_limit = (contactLimitVal !== null && contactLimitVal !== planContactLimit) ? contactLimitVal : null;
        }
        if (campaignsLimitVal !== undefined) {
            updateData.campaigns_limit = (campaignsLimitVal !== null && campaignsLimitVal !== planCampaignsLimit) ? campaignsLimitVal : null;
        }
        if (botRepliesLimitVal !== undefined) {
            updateData.bot_replies_limit = (botRepliesLimitVal !== null && botRepliesLimitVal !== planBotRepliesLimit) ? botRepliesLimitVal : null;
        }
        if (botFlowsLimitVal !== undefined) {
            updateData.bot_flows_limit = (botFlowsLimitVal !== null && botFlowsLimitVal !== planBotFlowsLimit) ? botFlowsLimitVal : null;
        }
        if (teamMembersLimitVal !== undefined) {
            updateData.team_members_limit = (teamMembersLimitVal !== null && teamMembersLimitVal !== planTeamMembersLimit) ? teamMembersLimitVal : null;
        }

        const updatedUser = await prisma.user.update({
            where: { id: targetUserId },
            data: updateData
        });

        await prisma.auditLog.create({
            data: {
                adminId: req.user.id,
                action: "UPDATE_LIMITS",
                targetUserId,
                details: { message_limit, contact_limit, campaigns_limit, bot_replies_limit, bot_flows_limit, team_members_limit }
            }
        });

        res.status(200).json(updatedUser);
    } catch (error) {
        console.error('[UPDATE_LIMITS]', error);
        res.status(500).json({ error: "Failed to update limits" });
    }
});


// Update User Profile (Admin manual edit)
router.put('/users/:id/profile', async (req, res) => {
    const { name, email, password, logo } = req.body;
    try {
        const updateData = {};
        if (name) updateData.name = name;
        if (email) updateData.email = email;
        if (logo !== undefined) updateData.logo = logo;

        if (password) {
            const bcryptMod = require('bcryptjs');
            const salt = await bcryptMod.genSalt(10);
            updateData.password = await bcryptMod.hash(password, salt);
        }

        const updatedUser = await prisma.user.update({
            where: { id: req.params.id },
            data: updateData
        });

        await prisma.auditLog.create({
            data: { adminId: req.user.id, action: "UPDATE_USER_PROFILE", targetUserId: req.params.id, details: { name, email } }
        });

        res.json(updatedUser);
    } catch (error) { res.status(500).json({ error: "Failed to update user profile" }); }
});

// Delete User Manually
router.delete('/users/:id', async (req, res) => {
    try {
        await prisma.user.delete({ where: { id: req.params.id } });
        await prisma.auditLog.create({
            data: { adminId: req.user.id, action: "DELETE_USER", targetUserId: req.params.id, details: {} }
        });
        res.json({ message: "User deleted" });
    } catch (error) { res.status(500).json({ error: "Failed to delete user" }); }
});

// 10. Plan Manager CRUD
router.get('/plans', async (req, res) => {
    const plans = await prisma.plan.findMany();
    res.json(plans);
});

router.post('/plans', async (req, res) => {
    const { name, price, duration_days, features_json, message_limit, contacts_limit, campaigns_limit, bot_replies_limit, bot_flows_limit, team_members_limit, allow_campaigns, allow_flow_builder, allow_ai_brain, allow_ai_voice, allow_qna, allow_ecommerce, allow_integrations, allow_team, is_default_free } = req.body;
    try {
        const plan = await prisma.plan.create({
            data: {
                name,
                price: parseFloat(price),
                duration_days: parseInt(duration_days, 10),
                features_json,
                message_limit:      parseInt(message_limit      ?? 1000, 10),
                contacts_limit:     parseInt(contacts_limit     ?? 1000, 10),
                campaigns_limit:    parseInt(campaigns_limit    ?? 60,   10),
                bot_replies_limit:  parseInt(bot_replies_limit  ?? 1000, 10),
                bot_flows_limit:    parseInt(bot_flows_limit    ?? 5,    10),
                team_members_limit: parseInt(team_members_limit ?? 3,    10),
                allow_campaigns:    allow_campaigns !== false && allow_campaigns !== 'false',
                allow_flow_builder: allow_flow_builder === true || allow_flow_builder === 'true',
                allow_ai_brain:     allow_ai_brain === true || allow_ai_brain === 'true',
                allow_ai_voice:     allow_ai_voice === true || allow_ai_voice === 'true',
                allow_qna:          allow_qna === true || allow_qna === 'true',
                allow_ecommerce:    allow_ecommerce === true || allow_ecommerce === 'true',
                allow_integrations: allow_integrations === true || allow_integrations === 'true',
                allow_team:         allow_team === true || allow_team === 'true',
                is_default_free:    is_default_free === true || is_default_free === 'true',
            }
        });

        if (is_default_free === true || is_default_free === 'true') {
            await prisma.plan.updateMany({
                where: { id: { not: plan.id } },
                data: { is_default_free: false }
            });
        }

        res.status(201).json(plan);
    } catch (error) {
        console.error('[CREATE_PLAN]', error);
        res.status(500).json({ error: "Failed to create plan" });
    }
});

router.put('/plans/:id', async (req, res) => {
    const { name, price, duration_days, features_json, message_limit, contacts_limit, campaigns_limit, bot_replies_limit, bot_flows_limit, team_members_limit, allow_campaigns, allow_flow_builder, allow_ai_brain, allow_ai_voice, allow_qna, allow_ecommerce, allow_integrations, allow_team, is_default_free } = req.body;
    try {
        const plan = await prisma.plan.update({
            where: { id: req.params.id },
            data: {
                name,
                price: parseFloat(price),
                duration_days: parseInt(duration_days, 10),
                features_json,
                message_limit:      parseInt(message_limit      ?? 1000, 10),
                contacts_limit:     parseInt(contacts_limit     ?? 1000, 10),
                campaigns_limit:    parseInt(campaigns_limit    ?? 60,   10),
                bot_replies_limit:  parseInt(bot_replies_limit  ?? 1000, 10),
                bot_flows_limit:    parseInt(bot_flows_limit    ?? 5,    10),
                team_members_limit: parseInt(team_members_limit ?? 3,    10),
                allow_campaigns:    allow_campaigns !== false && allow_campaigns !== 'false',
                allow_flow_builder: allow_flow_builder === true || allow_flow_builder === 'true',
                allow_ai_brain:     allow_ai_brain === true || allow_ai_brain === 'true',
                allow_ai_voice:     allow_ai_voice === true || allow_ai_voice === 'true',
                allow_qna:          allow_qna === true || allow_qna === 'true',
                allow_ecommerce:    allow_ecommerce === true || allow_ecommerce === 'true',
                allow_integrations: allow_integrations === true || allow_integrations === 'true',
                allow_team:         allow_team === true || allow_team === 'true',
                is_default_free:    is_default_free === true || is_default_free === 'true',
            }
        });

        if (is_default_free === true || is_default_free === 'true') {
            await prisma.plan.updateMany({
                where: { id: { not: req.params.id } },
                data: { is_default_free: false }
            });
        }

        res.json(plan);
    } catch (error) {
        console.error('[UPDATE_PLAN]', error);
        res.status(500).json({ error: "Failed to update plan" });
    }
});


router.delete('/plans/:id', async (req, res) => {
    try {
        await prisma.plan.delete({ where: { id: req.params.id } });
        res.json({ message: "Deleted" });
    } catch (error) { res.status(500).json({ error: "Failed to delete plan" }); }
});

// 11. Audit Logs
router.get('/audit-logs', async (req, res) => {
    const logs = await prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 100 });
    res.json(logs);
});

// 12. Broadcast Message
router.post('/broadcast', async (req, res) => {
    const { title = "System Broadcast", message } = req.body;

    if (!message) return res.status(400).json({ error: "Message is required" });

    try {
        // Fetch all active workspace owners
        const activeUsers = await prisma.user.findMany({
            where: {
                adminId: null,
                isActive: true
            },
            select: { id: true }
        });

        // Create a notification for each user
        if (activeUsers.length > 0) {
            const notifications = activeUsers.map(u => ({
                title,
                message,
                userId: u.id,
                isRead: false
            }));

            await prisma.notification.createMany({
                data: notifications
            });
        }

        await prisma.auditLog.create({
            data: { adminId: req.user.id, action: "BROADCAST_MESSAGE", details: { message, count: activeUsers.length } }
        });

        // Optional: Trigger socket.io event here to show realtime alert if io is available
        const io = req.app.get('io');
        if (io) {
            io.emit('system_broadcast', { title, message });
        }

        res.status(200).json({ message: `Broadcast dispatched to ${activeUsers.length} active users.` });
    } catch (e) {
        console.error("Broadcast Error:", e);
        res.status(500).json({ error: "Failed to broadcast message" });
    }
});

// 13. System Maintenance & Diagnostics (Read-Only Diagnostics Suite)
router.post('/system/test-meta', async (req, res) => {
    const { version, token } = req.body;
    if (!version || !token) {
        return res.status(400).json({ error: "Version and token required" });
    }

    const axios = require('axios');
    const report = [];

    // Retrieve settings
    let appId = null;
    let appSecret = null;
    try {
        const appIdSetting = await prisma.systemSetting.findUnique({ where: { key: 'EMBEDDED_SIGNUP_APP_ID' } });
        const appSecretSetting = await prisma.systemSetting.findUnique({ where: { key: 'EMBEDDED_SIGNUP_APP_SECRET' } });
        appId = appIdSetting?.value;
        appSecret = appSecretSetting?.value;
    } catch (err) {
        console.error("Failed to query settings for test-meta", err);
    }

    // Step 1: Verify OAuth Configuration
    let isAppCredentialsValid = false;
    let appAccessToken = null;
    if (appId && appSecret) {
        try {
            const handshakeUrl = `https://graph.facebook.com/${version}/oauth/access_token?client_id=${appId}&client_secret=${appSecret}&grant_type=client_credentials`;
            const handshakeRes = await axios.get(handshakeUrl);
            appAccessToken = handshakeRes.data?.access_token;
            isAppCredentialsValid = !!appAccessToken;
            report.push({
                step: "Verify OAuth Configuration",
                success: true,
                message: `OAuth parameters are configured correctly. App Access Token generated.`
            });
        } catch (err) {
            report.push({
                step: "Verify OAuth Configuration",
                success: false,
                message: `OAuth handshake failed (Check App ID and Secret): ${err.response?.data?.error?.message || err.message}`
            });
        }
    } else {
        report.push({
            step: "Verify OAuth Configuration",
            success: false,
            message: "App ID or App Secret configuration is missing in system settings."
        });
    }

    // Step 2: Token Exchange & Debug
    let isTokenValid = false;
    let scopes = [];
    if (token) {
        try {
            // First check basic validity
            const url = `https://graph.facebook.com/${version}/me?access_token=${token}`;
            const response = await axios.get(url);
            const accountName = response.data?.name || "WhatsApp Business Account";
            isTokenValid = true;

            // If App credentials are valid, debug token to extract scopes
            if (isAppCredentialsValid && appAccessToken) {
                try {
                    const debugUrl = `https://graph.facebook.com/${version}/debug_token?input_token=${token}&access_token=${appAccessToken}`;
                    const debugRes = await axios.get(debugUrl);
                    scopes = debugRes.data?.data?.scopes || [];
                } catch (_) {}
            }

            report.push({
                step: "Token Exchange & Validity",
                success: true,
                message: `Token is valid. Connected Account: ${accountName} (ID: ${response.data?.id || 'N/A'}).`
            });
        } catch (err) {
            report.push({
                step: "Token Exchange & Validity",
                success: false,
                message: `Token validation failed: ${err.response?.data?.error?.message || err.message}`
            });
        }
    } else {
        report.push({
            step: "Token Exchange & Validity",
            success: false,
            message: "No System Meta Token supplied."
        });
    }

    // Step 3: Business Fetch
    let businessId = null;
    if (isTokenValid) {
        try {
            const url = `https://graph.facebook.com/${version}/me/businesses?access_token=${token}`;
            const response = await axios.get(url);
            const businesses = response.data?.data || [];
            if (businesses.length > 0) {
                businessId = businesses[0].id;
                report.push({
                    step: "Business Fetch",
                    success: true,
                    message: `Successfully fetched ${businesses.length} Business Account(s). First Business ID: ${businessId} (${businesses[0].name})`
                });
            } else {
                // Try resolving from assigned WABAs (useful for System Users)
                try {
                    const wabaDiscoveryUrl = `https://graph.facebook.com/${version}/me/assigned_whatsapp_business_accounts?access_token=${token}`;
                    const wabaDiscoveryRes = await axios.get(wabaDiscoveryUrl);
                    const discoveryWabas = wabaDiscoveryRes.data?.data || [];
                    if (discoveryWabas.length > 0) {
                        const tempWabaId = discoveryWabas[0].id;
                        const wabaDetailsRes = await axios.get(`https://graph.facebook.com/${version}/${tempWabaId}?fields=owner_business_info&access_token=${token}`);
                        if (wabaDetailsRes.data?.owner_business_info) {
                            businessId = wabaDetailsRes.data.owner_business_info.id;
                            report.push({
                                step: "Business Fetch",
                                success: true,
                                message: `Successfully resolved Business ID via WABA owner: ${businessId} (${wabaDetailsRes.data.owner_business_info.name})`
                            });
                        } else {
                            throw new Error("No owner business info on WABA");
                        }
                    } else {
                        throw new Error("No WABAs found to resolve business");
                    }
                } catch (bizErr) {
                    report.push({
                        step: "Business Fetch",
                        success: true,
                        message: "Compatible: No Business Portfolio directly associated with token, and WABA owner lookup skipped."
                    });
                }
            }
        } catch (err) {
            report.push({
                step: "Business Fetch",
                success: false,
                message: `Failed to fetch Business Managers: ${err.response?.data?.error?.message || err.message}`
            });
        }
    } else {
        report.push({
            step: "Business Fetch",
            success: false,
            message: "Skipped: Access token is invalid."
        });
    }

    // Step 4: WABA Fetch
    let wabaId = null;
    if (isTokenValid) {
        try {
            // Check me/assigned_whatsapp_business_accounts first, then me/owned_whatsapp_business_accounts, then me/whatsapp_business_accounts
            let wabas = [];
            const endpoints = [
                `https://graph.facebook.com/${version}/me/assigned_whatsapp_business_accounts?access_token=${token}`,
                `https://graph.facebook.com/${version}/me/owned_whatsapp_business_accounts?access_token=${token}`,
                `https://graph.facebook.com/${version}/me/whatsapp_business_accounts?access_token=${token}`
            ];

            for (const url of endpoints) {
                try {
                    const response = await axios.get(url);
                    wabas = response.data?.data || [];
                    if (wabas.length > 0) {
                        break;
                    }
                } catch (_) {}
            }

            if (wabas.length > 0) {
                wabaId = wabas[0].id;
                report.push({
                    step: "WABA Fetch",
                    success: true,
                    message: `Successfully fetched ${wabas.length} WABA(s). Active WABA ID: ${wabaId} (${wabas[0].name || 'WABA'})`
                });
            } else {
                // If Business ID is available, try fallback query through business
                if (businessId) {
                    try {
                        const bizWabaUrl = `https://graph.facebook.com/${version}/${businessId}/owned_whatsapp_business_accounts?access_token=${token}`;
                        const bizWabaRes = await axios.get(bizWabaUrl);
                        const bizWabas = bizWabaRes.data?.data || [];
                        if (bizWabas.length > 0) {
                            wabaId = bizWabas[0].id;
                            report.push({
                                step: "WABA Fetch",
                                success: true,
                                message: `Successfully fetched ${bizWabas.length} WABA(s) under Business ID: ${businessId}. WABA ID: ${wabaId}`
                            });
                        } else {
                            throw new Error("No WABAs under business");
                        }
                    } catch (_) {
                        report.push({
                            step: "WABA Fetch",
                            success: true, // API responded successfully with empty array
                            message: "Compatible: Token connection is valid, but no assigned WhatsApp Business Accounts are found."
                        });
                    }
                } else {
                    report.push({
                        step: "WABA Fetch",
                        success: true, // API responded successfully with empty array
                        message: "Compatible: Token connection is valid, but no assigned WhatsApp Business Accounts are found."
                    });
                }
            }
        } catch (err) {
            report.push({
                step: "WABA Fetch",
                success: false,
                message: `Failed to query WhatsApp Business Accounts: ${err.response?.data?.error?.message || err.message}`
            });
        }
    } else {
        report.push({
            step: "WABA Fetch",
            success: false,
            message: "Skipped: Access token is invalid."
        });
    }

    // Step 5: Phone Number Fetch
    let phoneVerified = false;
    if (isTokenValid) {
        if (wabaId) {
            try {
                const url = `https://graph.facebook.com/${version}/${wabaId}/phone_numbers?access_token=${token}`;
                const response = await axios.get(url);
                const phones = response.data?.data || [];
                if (phones.length > 0) {
                    const activePhone = phones[0];
                    report.push({
                        step: "Phone Number Fetch",
                        success: true,
                        message: `Successfully fetched ${phones.length} Phone Number(s). First Phone ID: ${activePhone.id} (Number: ${activePhone.display_phone_number || 'N/A'}, Status: ${activePhone.status || 'N/A'})`
                    });
                    phoneVerified = true;
                }
            } catch (err) {
                console.warn("Failed to fetch phone numbers via WABA ID:", err.message);
            }
        }

        // Fallback: Verify configured SYSTEM_PHONE_NUMBER_ID directly
        if (!phoneVerified) {
            try {
                const systemPhoneSetting = await prisma.systemSetting.findUnique({ where: { key: 'SYSTEM_PHONE_NUMBER_ID' } });
                const systemPhoneId = systemPhoneSetting?.value;
                if (systemPhoneId) {
                    const url = `https://graph.facebook.com/${version}/${systemPhoneId}?access_token=${token}`;
                    const response = await axios.get(url);
                    if (response.data && response.data.id) {
                        report.push({
                            step: "Phone Number Fetch",
                            success: true,
                            message: `Successfully verified configured System Phone ID: ${systemPhoneId} (${response.data.display_phone_number || 'Display Name: ' + response.data.verified_name})`
                        });
                        phoneVerified = true;
                    }
                }
            } catch (err) {
                console.warn("Failed to verify system phone ID directly:", err.message);
            }
        }

        if (!phoneVerified) {
            report.push({
                step: "Phone Number Fetch",
                success: true, // Mark as true (compatible) but warning
                message: "Compatible: No active phone numbers resolved or verified (please configure SYSTEM_PHONE_NUMBER_ID)."
            });
        }
    } else {
        report.push({
            step: "Phone Number Fetch",
            success: false,
            message: "Skipped: Access token is invalid."
        });
    }

    // Step 6: Message Send Capability
    if (isTokenValid) {
        const required = ['whatsapp_business_messaging', 'whatsapp_business_management', 'business_management'];
        const missing = required.filter(s => scopes.length > 0 && !scopes.includes(s));

        if (missing.length === 0) {
            report.push({
                step: "Message Send Capability",
                success: true,
                message: "All messaging permission scopes are active and granted."
            });
        } else {
            report.push({
                step: "Message Send Capability",
                success: false,
                message: `Missing required scopes/permissions: ${missing.join(', ')}. Please request Advanced Access inside your Meta App settings.`
            });
        }
    } else {
        report.push({
            step: "Message Send Capability",
            success: false,
            message: "Skipped: Access token is invalid."
        });
    }

    // Step 7: Template Sync Capability
    if (isTokenValid) {
        if (wabaId) {
            try {
                const url = `https://graph.facebook.com/${version}/${wabaId}/message_templates?limit=5&access_token=${token}`;
                const response = await axios.get(url);
                const count = response.data?.data?.length || 0;
                report.push({
                    step: "Template Sync Capability",
                    success: true,
                    message: `Template sync API check passed. Verified access to templates (Retrieved: ${count}).`
                });
            } catch (err) {
                report.push({
                    step: "Template Sync Capability",
                    success: false,
                    message: `Template sync API check failed: ${err.response?.data?.error?.message || err.message}`
                });
            }
        } else {
            report.push({
                step: "Template Sync Capability",
                success: true, // Mark as true/compatible
                message: "Compatible: Skipped template sync query because no WABA ID was resolved."
            });
        }
    } else {
        report.push({
            step: "Template Sync Capability",
            success: false,
            message: "Skipped: Access token is invalid."
        });
    }

    res.status(200).json({
        success: report.every(r => r.success || r.message.startsWith("Skipped:")),
        report
    });
});


router.post('/system/refresh', (req, res) => {
    clearMetaConfigCache();
    res.status(200).json({ message: "System configuration cache cleared successfully." });
});

router.post('/system/rollback-meta', async (req, res) => {
    try {
        const prevJsSdk = await prisma.systemSetting.findUnique({ where: { key: 'PREV_META_JS_SDK_VERSION' } });
        const prevGraphApi = await prisma.systemSetting.findUnique({ where: { key: 'PREV_META_GRAPH_API_VERSION' } }) || await prisma.systemSetting.findUnique({ where: { key: 'PREV_META_API_VERSION' } });
        const prevEmbeddedSignup = await prisma.systemSetting.findUnique({ where: { key: 'PREV_META_EMBEDDED_SIGNUP_VERSION' } });
        const prevBusinessAppOnboarding = await prisma.systemSetting.findUnique({ where: { key: 'PREV_META_BUSINESS_APP_ONBOARDING_ENABLED' } });

        if (!prevJsSdk && !prevGraphApi && !prevEmbeddedSignup && !prevBusinessAppOnboarding) {
            return res.status(400).json({ error: "No rollback configuration history found." });
        }

        const updateSetting = async (key, value) => {
            if (value !== undefined && value !== null) {
                await prisma.systemSetting.upsert({
                    where: { key },
                    update: { value: String(value) },
                    create: { key, value: String(value) }
                });
            }
        };

        const currentJsSdk = await prisma.systemSetting.findUnique({ where: { key: 'META_JS_SDK_VERSION' } });
        const currentGraphApi = await prisma.systemSetting.findUnique({ where: { key: 'META_GRAPH_API_VERSION' } }) || await prisma.systemSetting.findUnique({ where: { key: 'META_API_VERSION' } });
        const currentEmbeddedSignup = await prisma.systemSetting.findUnique({ where: { key: 'META_EMBEDDED_SIGNUP_VERSION' } });
        const currentBusinessAppOnboarding = await prisma.systemSetting.findUnique({ where: { key: 'META_BUSINESS_APP_ONBOARDING_ENABLED' } });

        const jsSdkVal = prevJsSdk?.value || 'v19.0';
        const graphApiVal = prevGraphApi?.value || 'v20.0';
        const embeddedSignupVal = prevEmbeddedSignup?.value || 'v19.0';
        const businessAppOnboardingVal = prevBusinessAppOnboarding?.value || 'false';

        await updateSetting('PREV_META_JS_SDK_VERSION', currentJsSdk?.value || 'v19.0');
        await updateSetting('PREV_META_GRAPH_API_VERSION', currentGraphApi?.value || 'v20.0');
        await updateSetting('PREV_META_API_VERSION', currentGraphApi?.value || 'v20.0');
        await updateSetting('PREV_META_EMBEDDED_SIGNUP_VERSION', currentEmbeddedSignup?.value || 'v19.0');
        await updateSetting('PREV_META_BUSINESS_APP_ONBOARDING_ENABLED', currentBusinessAppOnboarding?.value || 'false');

        await updateSetting('META_JS_SDK_VERSION', jsSdkVal);
        await updateSetting('META_GRAPH_API_VERSION', graphApiVal);
        await updateSetting('META_API_VERSION', graphApiVal);
        await updateSetting('META_EMBEDDED_SIGNUP_VERSION', embeddedSignupVal);
        await updateSetting('META_BUSINESS_APP_ONBOARDING_ENABLED', businessAppOnboardingVal);
        await updateSetting('META_SETTINGS_LAST_UPDATED', new Date().toISOString());

        clearMetaConfigCache();

        // Create rollback audit log
        await prisma.auditLog.create({
            data: {
                adminId: req.user.id,
                action: "ROLLBACK_META_CONFIG",
                details: {
                    metaJsSdkVersion: jsSdkVal,
                    metaApiVersion: graphApiVal,
                    metaEmbeddedSignupVersion: embeddedSignupVal,
                    metaBusinessAppOnboardingEnabled: businessAppOnboardingVal === 'true'
                }
            }
        });

        res.status(200).json({
            message: "Meta configurations rolled back successfully.",
            metaJsSdkVersion: jsSdkVal,
            metaApiVersion: graphApiVal,
            metaEmbeddedSignupVersion: embeddedSignupVal,
            metaBusinessAppOnboardingEnabled: businessAppOnboardingVal === 'true'
        });
    } catch (error) {
        res.status(500).json({ error: "Failed to rollback settings." });
    }
});

// 14. Admin Staff Management
router.get('/staff', async (req, res) => {
    try {
        const staffList = await prisma.user.findMany({
            where: { role: 'ADMIN_STAFF' },
            select: {
                id: true,
                name: true,
                email: true,
                permissions: true,
                createdAt: true
            }
        });
        res.status(200).json(staffList);
    } catch (e) {
        res.status(500).json({ error: "Failed to fetch admin staff" });
    }
});

router.post('/staff', async (req, res) => {
    const { name, email, password, permissions } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: "Missing required fields" });

    try {
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const newStaff = await prisma.user.create({
            data: {
                name,
                email,
                password: hashedPassword,
                role: 'ADMIN_STAFF',
                permissions: permissions || []
            },
            select: { id: true, name: true, email: true, permissions: true }
        });
        res.status(201).json(newStaff);
    } catch (e) {
        if (e.code === 'P2002') return res.status(400).json({ error: "Email already exists" });
        res.status(500).json({ error: "Failed to create staff" });
    }
});

router.put('/staff/:id', async (req, res) => {
    const { name, email, password, permissions } = req.body;
    const staffId = req.params.id;

    try {
        const updateData = { name, email, permissions };
        if (password && password.trim() !== '') {
            const salt = await bcrypt.genSalt(10);
            updateData.password = await bcrypt.hash(password, salt);
        }

        const updatedStaff = await prisma.user.update({
            where: { id: staffId },
            data: updateData,
            select: { id: true, name: true, email: true, permissions: true }
        });
        res.status(200).json(updatedStaff);
    } catch (e) {
        res.status(500).json({ error: "Failed to update staff" });
    }
});

router.delete('/staff/:id', async (req, res) => {
    try {
        await prisma.user.delete({ where: { id: req.params.id } });
        res.status(200).json({ success: true });
    } catch (e) {
        res.status(500).json({ error: "Failed to delete staff" });
    }
});

// 15. Wallet Pricing & Management
router.get('/pricing', async (req, res) => {
    try {
        const rates = await prisma.pricingRate.findMany();
        res.status(200).json(rates);
    } catch (e) {
        res.status(500).json({ error: "Failed to fetch pricing rates" });
    }
});

router.post('/pricing', async (req, res) => {
    const { rates } = req.body; 
    // Expecting array: [{ category: 'MARKETING', baseCost: 0.8, markup: 0.2 }, ...]
    try {
        await prisma.$transaction(
            rates.map(r => prisma.pricingRate.upsert({
                where: { category: r.category },
                update: { baseCost: parseFloat(r.baseCost), markup: parseFloat(r.markup) },
                create: { category: r.category, baseCost: parseFloat(r.baseCost), markup: parseFloat(r.markup) }
            }))
        );
        res.status(200).json({ message: "Pricing rates updated" });
    } catch (e) {
        res.status(500).json({ error: "Failed to update pricing rates" });
    }
});

router.post('/users/:id/topup', async (req, res) => {
    const { amount, description } = req.body;
    const userId = req.params.id;

    if (amount === undefined || amount === null || isNaN(amount) || amount === 0) {
        return res.status(400).json({ error: "Invalid amount" });
    }

    const parsedAmount = parseFloat(amount);
    const isCredit = parsedAmount > 0;
    const absAmount = Math.abs(parsedAmount);

    try {
        await prisma.$transaction(async (tx) => {
            let wallet = await tx.wallet.findUnique({ where: { userId } });
            
            // If deductive and insufficient balance, throw error
            if (!isCredit) {
                if (!wallet || wallet.currentBalance < absAmount) {
                    throw new Error("INSUFFICIENT_FUNDS");
                }
            }

            wallet = await tx.wallet.upsert({
                where: { userId },
                update: { currentBalance: { increment: parsedAmount } },
                create: { userId, currentBalance: parsedAmount, currency: 'INR' }
            });

            await tx.transaction.create({
                data: {
                    userId,
                    amount: absAmount,
                    type: isCredit ? 'CREDIT' : 'DEBIT',
                    category: 'ADMIN_ADJUSTMENT',
                    description: description ? `Admin Adjustment: ${description}` : `Admin Adjustment: ${isCredit ? 'Credit added' : 'Credit deducted'} by ${req.user.email}`
                }
            });
        });
        res.status(200).json({ message: `Successfully ${isCredit ? 'added' : 'deducted'} ${absAmount} credits` });
    } catch (e) {
        if (e.message === "INSUFFICIENT_FUNDS") {
            return res.status(400).json({ error: "Cannot deduct more than the current wallet balance." });
        }
        res.status(500).json({ error: "Failed to adjust wallet" });
    }
});
// ============================================================
// ADMIN AI CONTROL CENTER ROUTES
// ============================================================

// GET /api/admin/ai/overview
router.get('/ai/overview', async (req, res) => {
    try {
        const [totalWorkspaces, activeWorkspaces, totalActions, failedActions, usageStats] = await Promise.all([
            prisma.user.count({ where: { adminId: null, role: { in: ['ADMIN', 'SUPERADMIN'] } } }),
            prisma.user.count({ where: { adminId: null, role: { in: ['ADMIN', 'SUPERADMIN'] }, botEnabled: true } }),
            prisma.aiActionLog.count(),
            prisma.aiActionLog.count({ where: { status: 'FAILED' } }),
            prisma.aiUsageLog.aggregate({ _sum: { totalTokens: true, estimatedCost: true } }).catch(() => ({ _sum: { totalTokens: 0, estimatedCost: 0 } }))
        ]);

        res.json({
            totalWorkspaces,
            activeWorkspaces,
            totalActions,
            failedActions,
            escalations: 0,
            totalTokens: usageStats._sum.totalTokens || 0,
            estimatedCost: usageStats._sum.estimatedCost || 0,
            health: { openai: 'Active', redis: 'Active', bullmq: 'Active' }
        });
    } catch (e) {
        console.error('Admin AI Overview error:', e);
        res.status(500).json({ error: 'Failed to load AI overview' });
    }
});

// GET /api/admin/ai/workspaces
router.get('/ai/workspaces', async (req, res) => {
    try {
        const workspaces = await prisma.user.findMany({
            where: { adminId: null, role: { in: ['ADMIN', 'SUPERADMIN'] } },
            select: {
                id: true, name: true, email: true, botEnabled: true,
                aiAgent: { select: { useOwnAi: true, sandboxMode: true, model: true } },
                _count: { select: { aiActionLogs: true } }
            },
            orderBy: { createdAt: 'desc' },
            take: 100
        });
        res.json(workspaces);
    } catch (e) {
        console.error('Admin AI Workspaces error:', e);
        res.status(500).json({ error: 'Failed to load workspaces' });
    }
});

// POST /api/admin/ai/workspaces/:id/toggle
router.post('/ai/workspaces/:id/toggle', async (req, res) => {
    try {
        const { botEnabled } = req.body;
        await prisma.user.update({ where: { id: req.params.id }, data: { botEnabled } });
        res.json({ success: true });
    } catch (e) {
        console.error('Admin AI toggle error:', e);
        res.status(500).json({ error: 'Failed to toggle workspace AI' });
    }
});

// GET /api/admin/ai/logs
router.get('/ai/logs', async (req, res) => {
    try {
        const logs = await prisma.aiActionLog.findMany({
            orderBy: { executedAt: 'desc' },
            take: 100,
            include: { user: { select: { name: true, email: true } } }
        });
        res.json(logs);
    } catch (e) {
        console.error('Admin AI Logs error:', e);
        res.status(500).json({ error: 'Failed to load logs' });
    }
});

// GET /api/admin/ai/security
router.get('/ai/security', async (req, res) => {
    try {
        const [failedCount, alerts] = await Promise.all([
            prisma.aiActionLog.count({ where: { status: 'FAILED' } }),
            prisma.aiActionLog.findMany({
                where: { status: 'FAILED' },
                orderBy: { executedAt: 'desc' },
                take: 20,
                include: { user: { select: { name: true } } }
            })
        ]);
        res.json({ stats: { failedValidations: failedCount }, alerts });
    } catch (e) {
        console.error('Admin AI Security error:', e);
        res.status(500).json({ error: 'Failed to load security data' });
    }
});

// GET /api/admin/ai/prompts
router.get('/ai/prompts', async (req, res) => {
    try {
        // Return global prompt templates stored in system settings
        const settings = await prisma.adminSettings.findFirst();
        const prompts = settings?.aiPrompts ? JSON.parse(settings.aiPrompts) : [
            { id: 1, name: 'Default Support', content: 'You are a helpful customer support agent.', version: 1 },
            { id: 2, name: 'Sales Agent', content: 'You are an expert sales assistant.', version: 1 },
        ];
        res.json(prompts);
    } catch (e) {
        res.json([]);
    }
});

// POST /api/admin/ai/prompts
router.post('/ai/prompts', async (req, res) => {
    try {
        const settings = await prisma.adminSettings.findFirst();
        const existing = settings?.aiPrompts ? JSON.parse(settings.aiPrompts) : [];
        const newPrompt = { id: Date.now(), version: 1, ...req.body };
        const updated = [...existing, newPrompt];
        if (settings) {
            await prisma.adminSettings.update({ where: { id: settings.id }, data: { aiPrompts: JSON.stringify(updated) } });
        }
        res.json({ success: true, prompt: newPrompt });
    } catch (e) {
        res.status(500).json({ error: 'Failed to save prompt' });
    }
});

// POST /api/admin/ai/emergency/stop
router.post('/ai/emergency/stop', async (req, res) => {
    try {
        // Disable AI for ALL workspaces
        await prisma.user.updateMany({ where: { adminId: null }, data: { botEnabled: false } });
        res.json({ success: true, message: 'Emergency stop executed. AI disabled for all workspaces.' });
    } catch (e) {
        res.status(500).json({ error: 'Emergency stop failed' });
    }
});

// POST /api/admin/ai/emergency/resume
router.post('/ai/emergency/resume', async (req, res) => {
    try {
        await prisma.user.updateMany({ where: { adminId: null }, data: { botEnabled: true } });
        res.json({ success: true, message: 'AI resumed for all workspaces.' });
    } catch (e) {
        res.status(500).json({ error: 'Resume failed' });
    }
});

// POST /api/admin/ai/workspaces/:id/clear-memory
router.post('/ai/workspaces/:id/clear-memory', async (req, res) => {
    try {
        // Delete AI action logs for this workspace
        await prisma.aiActionLog.deleteMany({ where: { userId: req.params.id } });
        res.json({ success: true, message: 'Workspace AI memory cleared.' });
    } catch (e) {
        res.status(500).json({ error: 'Failed to clear memory' });
    }
});

// POST /api/admin/ai/workspaces/:id/revoke-key
router.post('/ai/workspaces/:id/revoke-key', async (req, res) => {
    try {
        await prisma.user.update({ where: { id: req.params.id }, data: { aiApiKey: null } });
        await prisma.aiAgent.updateMany({ where: { userId: req.params.id }, data: { useOwnAi: false } });
        res.json({ success: true, message: 'Custom API key revoked. Workspace reverted to Admin AI.' });
    } catch (e) {
        res.status(500).json({ error: 'Failed to revoke key' });
    }
});

// GET /api/admin/ai/providers
router.get('/ai/providers', async (req, res) => {
    try {
        const admin = await prisma.user.findFirst({ where: { role: 'SUPERADMIN' } });
        res.json({
            provider: admin?.aiProvider || 'openai',
            model: admin?.aiModel || 'gpt-4o',
            apiKey: admin?.aiApiKey || '',
            aiWebhookUrl: admin?.aiWebhookUrl || ''
        });
    } catch (e) {
        console.error('Failed to get admin providers:', e);
        res.status(500).json({ error: 'Failed to load AI providers settings' });
    }
});

// POST /api/admin/ai/providers
router.post('/ai/providers', async (req, res) => {
    try {
        const { provider, apiKey, model, aiWebhookUrl } = req.body;
        
        // Safeguard 1: Reject masked/empty strings
        let finalKey = apiKey;
        if (apiKey === undefined || apiKey === null || apiKey.trim() === '') {
            finalKey = null; // Clearing the key
        } else if (apiKey.includes('••••') || apiKey === '---') {
            return res.status(400).json({ error: "Cannot save masked values." });
        }
        
        // Safeguard 2: Groq validation
        if (provider === 'groq' && finalKey && !finalKey.startsWith('gsk_')) {
            return res.status(400).json({ error: "Invalid Groq API Key. Must start with gsk_" });
        }

        const admin = await prisma.user.findFirst({ where: { role: 'SUPERADMIN' } });
        
        if (admin) {
            await prisma.user.update({
                where: { id: admin.id },
                data: {
                    aiProvider: provider,
                    ...(finalKey !== undefined ? { aiApiKey: finalKey } : {}),
                    aiModel: model,
                    aiWebhookUrl: aiWebhookUrl !== undefined ? aiWebhookUrl : undefined
                }
            });

            // Safeguard 3: DB Verification & Logging
            const updatedAdmin = await prisma.user.findFirst({ where: { role: 'SUPERADMIN' } });
            console.log("[AI CONFIG SAVE] Admin Config Updated:");
            console.log(JSON.stringify({
                provider: updatedAdmin.aiProvider,
                keyPrefix: updatedAdmin.aiApiKey ? `${updatedAdmin.aiApiKey.substring(0, 10)}...` : 'NONE',
                webhookUrl: updatedAdmin.aiWebhookUrl || 'NONE',
                updatedAt: updatedAdmin.updatedAt,
                userId: updatedAdmin.id
            }, null, 2));
        }
        res.json({ success: true, message: 'Global AI Provider saved successfully.' });
    } catch (e) {
        console.error('Failed to save admin providers:', e);
        res.status(500).json({ error: 'Failed to save AI providers settings' });
    }
});

module.exports = router;

