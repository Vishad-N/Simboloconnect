const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { decrypt } = require('../utils/encryption');
const MetaApiService = require('./MetaApiService');
const redis = require('./redisConnection');
const logger = require('./logger');
const { validateBalance, deductCredits } = require('../middleware/walletEngine');

class AutomationMessagingService {
    /**
     * Send a dynamic demo link universally.
     * 
     * @param {object} params
     * @param {string} params.customerPhone - Recipient phone number
     * @param {string} params.message - The text message template
     * @param {string} params.demoType - E.g. "pricing", "reseller", "api", "saas", etc.
     * @param {string} params.source - Origin provider: "vapi", "bland", etc.
     * @param {string} [params.apiKey] - Tenant API token (optional if workspaceId or callId provided)
     * @param {string} [params.workspaceId] - Direct tenant user ID (optional if apiKey or callId provided)
     * @param {string} [params.callId] - Voice call session identifier (optional if apiKey or workspaceId provided)
     * @param {object} [io] - Socket.io instance for real-time UI updates
     * @returns {Promise<{success: boolean, status: string, error?: string}>}
     */
    static async sendLink({ customerPhone, message, demoType, source, apiKey, workspaceId, callId }, io = null) {
        const sourceProvider = source || 'unknown';
        const rawPhone = customerPhone || '';
        const normalizedPhone = rawPhone.trim().replace(/\s+/g, '').replace(/^\+/, '');
        const currentDemoType = (demoType || 'pricing').toLowerCase();

        logger.info('[AutomationService] Initiating sendLink trigger', {
            sourceProvider,
            customerPhone: normalizedPhone,
            demoType: currentDemoType,
            hasApiKey: !!apiKey,
            workspaceId,
            callId
        });

        // 1. Resolve Workspace User
        let user = null;
        if (apiKey) {
            user = await prisma.user.findUnique({
                where: { apiToken: apiKey }
            });
        } else if (workspaceId) {
            user = await prisma.user.findUnique({
                where: { id: workspaceId }
            });
        } else if (callId) {
            const session = await prisma.voiceCallSession.findFirst({
                where: { externalCallId: callId }
            });
            if (session && session.userId) {
                user = await prisma.user.findUnique({
                    where: { id: session.userId }
                });
                logger.info('[AutomationService] Resolved workspace tenant via voice call session', {
                    callId,
                    userId: session.userId
                });
            }
        }

        if (!user) {
            logger.error('[AutomationService] Tenant resolution failed. Invalid credentials.', {
                apiKey: apiKey ? `${apiKey.slice(0, 12)}...` : undefined,
                workspaceId
            });
            return { success: true, status: 'FAILED_UNAUTHORIZED', error: 'Workspace unauthorized or invalid credentials.' };
        }

        // Account / subscription checks
        if (!user.isActive) {
            logger.warn('[AutomationService] Suppression: Workspace account suspended.', { userId: user.id });
            return { success: true, status: 'FAILED_ACCOUNT_SUSPENDED', error: 'Workspace account suspended.' };
        }
        if (user.validityExpiresAt && new Date(user.validityExpiresAt) < new Date()) {
            logger.warn('[AutomationService] Suppression: Workspace subscription expired.', { userId: user.id });
            return { success: true, status: 'FAILED_SUBSCRIPTION_EXPIRED', error: 'Workspace subscription expired.' };
        }

        const ownerId = user.adminId || user.id;

        // Resolve admin user context (who carries Meta API credentials)
        const credentialsUser = ownerId === user.id ? user : await prisma.user.findUnique({
            where: { id: ownerId }
        });

        if (!credentialsUser || !credentialsUser.metaToken || !credentialsUser.phoneNumberId) {
            logger.error('[AutomationService] Workspace Meta credentials missing or unconfigured.', { ownerId });
            return { success: true, status: 'FAILED_CREDENTIALS_MISSING', error: 'Workspace Meta credentials not configured.' };
        }

        // 2. Cooldown & Rate Protection (Anti-Spam Shield)
        let isSuppressed = false;
        let suppressionReason = '';

        try {
            // Check short 60s duplicate cooldown per workspace + customer + demoType
            const cooldownKey = `automation:cooldown:${ownerId}:${normalizedPhone}:${currentDemoType}`;
            const isSet = await redis.set(cooldownKey, '1', 'EX', 60, 'NX');
            if (!isSet) {
                isSuppressed = true;
                suppressionReason = 'SUPPRESSED_COOLDOWN';
                logger.warn('[AutomationService] Suppressed duplicate trigger within 60s cooldown.', {
                    ownerId,
                    customerPhone: normalizedPhone,
                    demoType: currentDemoType
                });
            }

            if (!isSuppressed) {
                // Check per-workspace sliding rate limit: Max 100 triggers per minute
                const currentMinute = Math.floor(Date.now() / 60000);
                const rateKey = `automation:ratelimit:${ownerId}:${currentMinute}`;
                const count = await redis.incr(rateKey);
                if (count === 1) {
                    await redis.expire(rateKey, 120);
                }
                if (count > 100) {
                    isSuppressed = true;
                    suppressionReason = 'SUPPRESSED_RATE_LIMIT';
                    logger.warn('[AutomationService] Suppressed: Workspace hourly rate limit exceeded (100 msg/min max).', { ownerId });
                }
            }
        } catch (redisError) {
            logger.error('[AutomationService] Redis error during rate limiting checks, falling back to DB/fail-open.', { error: redisError.message });
            
            // Fail-safe fallback check: Lookup DB MessageLog for duplicate outbound messages sent within the last minute
            try {
                const oneMinuteAgo = new Date(Date.now() - 60000);
                const recentLog = await prisma.messageLog.findFirst({
                    where: {
                        userId: ownerId,
                        recipient: normalizedPhone,
                        timestamp: { gte: oneMinuteAgo }
                    }
                });

                if (recentLog) {
                    isSuppressed = true;
                    suppressionReason = 'SUPPRESSED_COOLDOWN';
                    logger.warn('[AutomationService] Fallback DB Suppression active: duplicate message sent to recipient in last 60s.', { ownerId, normalizedPhone });
                }
            } catch (dbFallbackErr) {
                logger.error('[AutomationService] Database fallback check failed, proceeding to avoid blocking.', { error: dbFallbackErr.message });
            }
        }

        if (isSuppressed) {
            return { success: true, status: suppressionReason };
        }

        // 3. Wallet / Credits Balance Verification
        try {
            await validateBalance(ownerId, 'SERVICE', 1);
        } catch (walletErr) {
            logger.warn('[AutomationService] Suppression: Insufficient wallet balance.', { ownerId, error: walletErr.message });
            return { success: true, status: 'FAILED_INSUFFICIENT_CREDITS', error: walletErr.message };
        }

        // 4. Smart Demo Routing & Link Lookup
        let targetUrl = '';
        try {
            // Check if there is a customized DemoAsset configured for this workspace
            const asset = await prisma.demoAsset.findFirst({
                where: {
                    userId: ownerId,
                    OR: [
                        { name: { equals: currentDemoType, mode: 'insensitive' } },
                        { productCategory: { equals: currentDemoType, mode: 'insensitive' } },
                        { keywords: { has: currentDemoType } }
                    ]
                }
            });

            if (asset && asset.url) {
                targetUrl = asset.url;
                logger.info('[AutomationService] Custom DemoAsset URL found.', { ownerId, demoType: currentDemoType, targetUrl });
            }
        } catch (assetErr) {
            logger.error('[AutomationService] Error querying DemoAsset catalog.', { error: assetErr.message });
        }

        // Build premium fallback URL if no custom database asset is found
        if (!targetUrl) {
            const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
            targetUrl = `${frontendUrl}/demo/${currentDemoType}`;
            logger.info('[AutomationService] Falling back to default constructed URL.', { targetUrl });
        }

        // 5. Safe Message Interpolation
        let finalMessage = message || '';
        if (finalMessage.includes('{{link}}')) {
            finalMessage = finalMessage.replace(/\{\{link\}\}/g, targetUrl);
        } else if (finalMessage.includes('{{url}}')) {
            finalMessage = finalMessage.replace(/\{\{url\}\}/g, targetUrl);
        } else {
            // Neat append fallback
            finalMessage = finalMessage 
                ? `${finalMessage}\n\nHere is your link: ${targetUrl}`
                : `Here is your requested demo link: ${targetUrl}`;
        }

        // --- Test / Placeholder phone check (SaaS and Test Tool safety) ---
        const digitsOnly = normalizedPhone.replace(/[^\d]/g, '');
        const isPlaceholder = normalizedPhone.includes('{') || 
                              normalizedPhone.includes('}') || 
                              /[a-zA-Z]/.test(normalizedPhone) ||
                              digitsOnly.length < 7;

        if (isPlaceholder) {
            logger.info('[AutomationService] Test/placeholder phone number detected. Bypassing WhatsApp dispatch & credit deduction.', {
                ownerId,
                customerPhone: normalizedPhone,
                finalMessage
            });
            return { success: true, status: 'DELIVERED', isTestMock: true };
        }

        // 6. Decrypt and Dispatch WhatsApp Message
        let decryptedToken = null;
        try {
            decryptedToken = decrypt(credentialsUser.metaToken);
        } catch (decErr) {
            logger.error('[AutomationService] Decryption of Meta token failed.', { ownerId, error: decErr.message });
            return { success: true, status: 'FAILED_DECRYPTION_ERROR', error: 'Decryption of credentials failed.' };
        }

        if (!decryptedToken) {
            logger.error('[AutomationService] Decrypted Meta token is null/corrupted.', { ownerId });
            return { success: true, status: 'FAILED_DECRYPTION_ERROR', error: 'Meta token corrupted in user profile.' };
        }

        try {
            logger.info('[AutomationService] Dispatching Meta API call.', {
                ownerId,
                recipient: normalizedPhone,
                phoneNumberId: credentialsUser.phoneNumberId
            });

            const { messageId } = await MetaApiService.sendText({
                phoneNumberId: credentialsUser.phoneNumberId,
                token: decryptedToken,
                to: normalizedPhone,
                text: finalMessage,
                context: { userId: ownerId, source: `automation_${sourceProvider}` }
            });

            // 7. Wallet Deduction & Logs writing
            await deductCredits(ownerId, 'SERVICE', 1, `Universal automation link sent to ${normalizedPhone} (${sourceProvider})`);

            const log = await prisma.messageLog.create({
                data: {
                    userId: ownerId,
                    messageId: messageId || `auto-${Date.now()}`,
                    recipient: normalizedPhone,
                    direction: 'OUTBOUND',
                    status: 'SENT',
                    content: { type: 'text', text: finalMessage }
                }
            });

            // Real-time frontend Socket broadcast
            if (io) {
                io.to(`user_${ownerId}`).emit('new_message', log);
                logger.info('[AutomationService] Real-time Socket update emitted.', { ownerId });
            }

            logger.info('[AutomationService] Message delivered & logged successfully.', {
                ownerId,
                customerPhone: normalizedPhone,
                messageId
            });

            return { success: true, status: 'DELIVERED' };

        } catch (dispatchErr) {
            logger.error('[AutomationService] WhatsApp API dispatch failed.', { error: dispatchErr.message });
            return { success: true, status: 'FAILED_DELIVERY_ERROR', error: dispatchErr.message };
        }
    }
}

module.exports = AutomationMessagingService;
