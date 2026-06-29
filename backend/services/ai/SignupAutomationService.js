const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { decrypt } = require('../../utils/encryption');
const MetaApiService = require('../MetaApiService');
const VoiceQueueManager = require('../voice/VoiceQueueManager');
const logger = require('../logger');

class SignupAutomationService {
    static activeProcessingLeads = new Set();
    static nextWhatsAppSendTime = 0;

    /**
     * Interpolates params into template string, replacing undefined/null with empty string.
     * @param {string} templateStr 
     * @param {object} params 
     * @returns {string}
     */
    static safeTemplateInterpolate(templateStr, params) {
        if (!templateStr) return "";
        return templateStr.replace(/\{\{(\w+)\}\}/g, (match, key) => {
            return params[key] !== undefined && params[key] !== null ? String(params[key]) : "";
        });
    }

    /**
     * Checks if current time is within configured business hours.
     * @param {object} config 
     * @returns {boolean}
     */
    static isWithinBusinessHours(config) {
        if (!config || !config.businessHoursEnabled) return true;
        
        const timezone = config.businessHoursTimezone || 'Asia/Kolkata';
        const now = new Date();
        
        try {
            // Get hours and minutes in the configured timezone
            const formatter = new Intl.DateTimeFormat('en-US', {
                timeZone: timezone,
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
            });
            
            const parts = formatter.formatToParts(now);
            const hour = parseInt(parts.find(p => p.type === 'hour').value, 10);
            const minute = parseInt(parts.find(p => p.type === 'minute').value, 10);
            const currentMinutes = hour * 60 + minute;
            
            const [startHour, startMin] = (config.businessHoursStart || "09:00").split(':').map(Number);
            const [endHour, endMin] = (config.businessHoursEnd || "18:00").split(':').map(Number);
            const startMinutes = startHour * 60 + startMin;
            const endMinutes = endHour * 60 + endMin;
            
            return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
        } catch (error) {
            logger.error('[SignupAutomation] Error parsing business hours', { error: error.message });
            return true; // Fallback to allowed on error to prevent blocking
        }
    }

    /**
     * Main entrypoint to trigger onboarding automation.
     * @param {string} workspaceId - Admin/Workspace User ID
     * @param {object} leadData - { name, email, phone, plan }
     */
    static async triggerOnboarding(workspaceId, leadData) {
        const { name, email, phone, plan } = leadData;
        const normalizedPhone = phone ? phone.trim() : "";
        const normalizedEmail = email ? email.trim().toLowerCase() : "";

        // Concurrency Deduplication Lock: 5-second in-memory lock
        const dedupeKey = `${workspaceId}:${normalizedPhone}:${normalizedEmail}`;
        if (SignupAutomationService.activeProcessingLeads.has(dedupeKey)) {
            logger.warn('[SignupAutomation] Suppressed: Concurrent duplicate trigger in progress', { dedupeKey });
            return { success: false, error: "Suppressed: Duplicate concurrent signup request in progress." };
        }
        SignupAutomationService.activeProcessingLeads.add(dedupeKey);
        setTimeout(() => {
            SignupAutomationService.activeProcessingLeads.delete(dedupeKey);
        }, 5000);

        logger.info('[SignupAutomation] Starting onboarding trigger', { workspaceId, name, email, phone: normalizedPhone, plan });

        // Retrieve Workspace / AI Agent settings
        const aiAgent = await prisma.aiAgent.findUnique({
            where: { userId: workspaceId }
        });

        if (!aiAgent) {
            logger.warn('[SignupAutomation] AI Agent config not found for workspace', { workspaceId });
            return { success: false, error: "AI Agent settings not configured." };
        }

        const config = aiAgent.signupAutomation || {};
        
        // Environment Sandbox Hard Safety Guard override
        if (process.env.FORCE_SANDBOX_ONBOARDING === 'true') {
            config.sandboxMode = true;
            logger.info('[SignupAutomation] Global environment sandbox mode enforced via FORCE_SANDBOX_ONBOARDING.', { workspaceId });
        }

        if (!config.enabled) {
            logger.info('[SignupAutomation] Automation is disabled for workspace', { workspaceId });
            return { success: false, error: "Signup Automation is disabled." };
        }

        // Initialize log record
        const logRecord = await prisma.signupAutomationLog.create({
            data: {
                userId: workspaceId,
                name: name || "Unknown Lead",
                email: normalizedEmail,
                phone: normalizedPhone,
                plan: plan || "Free Trial",
                testMode: !!config.sandboxMode,
                whatsappStatus: "PENDING",
                voiceStatus: "PENDING"
            }
        });

        try {
            // ────────────────────────────────────────────────────────
            // SPAM & COOLDOWN PROTECTION
            // ────────────────────────────────────────────────────────
            const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000);
            const duplicateLead = await prisma.signupAutomationLog.findFirst({
                where: {
                    userId: workspaceId,
                    id: { not: logRecord.id },
                    createdAt: { gte: fifteenMinsAgo },
                    OR: [
                        { phone: normalizedPhone },
                        { email: normalizedEmail }
                    ]
                }
            });

            if (duplicateLead) {
                logger.warn('[SignupAutomation] Suppressed: Cooldown active (15 mins)', { phone: normalizedPhone, email: normalizedEmail });
                await prisma.signupAutomationLog.update({
                    where: { id: logRecord.id },
                    data: {
                        whatsappStatus: "SUPPRESSED",
                        whatsappError: "Suppressed: Duplicate signup cooldown active (15 mins)",
                        voiceStatus: "SUPPRESSED",
                        voiceError: "Suppressed: Duplicate signup cooldown active (15 mins)"
                    }
                });
                return { success: false, error: "Suppressed: Cooldown active.", logId: logRecord.id };
            }

            // ────────────────────────────────────────────────────────
            // BUSINESS HOURS COMPLIANCE
            // ────────────────────────────────────────────────────────
            const isBusinessHours = this.isWithinBusinessHours(config);
            if (!isBusinessHours) {
                logger.warn('[SignupAutomation] Suppressed: Outside configured business hours', { workspaceId });
                await prisma.signupAutomationLog.update({
                    where: { id: logRecord.id },
                    data: {
                        whatsappStatus: "SUPPRESSED",
                        whatsappError: "Outside configured business hours",
                        voiceStatus: "SUPPRESSED",
                        voiceError: "Outside configured business hours"
                    }
                });
                return { success: false, error: "Suppressed: Outside business hours.", logId: logRecord.id };
            }

            // Create/Find Contact in CRM
            let contact = await prisma.contact.findFirst({
                where: { userId: workspaceId, phone: normalizedPhone }
            });
            if (!contact && normalizedPhone) {
                try {
                    contact = await prisma.contact.create({
                        data: {
                            userId: workspaceId,
                            name: name || "Onboarding Lead",
                            phone: normalizedPhone,
                            tags: ['onboarding-lead'],
                            customFields: { plan: plan || "Free Trial" }
                        }
                    });
                } catch (e) {
                    logger.warn('[SignupAutomation] Error creating CRM contact, continuing', { error: e.message });
                }
            }

            // ────────────────────────────────────────────────────────
            // WHATSAPP DISPATCH (SAFE MODE)
            // ────────────────────────────────────────────────────────
            if (config.whatsappEnabled) {
                const targetPhone = config.sandboxMode ? config.whatsappAdminPhone : normalizedPhone;

                if (!targetPhone) {
                    await prisma.signupAutomationLog.update({
                        where: { id: logRecord.id },
                        data: {
                            whatsappStatus: "FAILED",
                            whatsappError: config.sandboxMode ? "Sandbox: Admin phone not configured." : "Lead phone not found."
                        }
                    });
                } else {
                    // Fetch user's WhatsApp API Credentials
                    const user = await prisma.user.findUnique({
                        where: { id: workspaceId }
                    });

                    if (!user || !user.metaToken || !user.phoneNumberId) {
                        logger.error('[SignupAutomation] WhatsApp credentials missing in User profile', { workspaceId });
                        await prisma.signupAutomationLog.update({
                            where: { id: logRecord.id },
                            data: {
                                whatsappStatus: "FAILED",
                                whatsappError: "Reseller Meta credentials missing in user settings."
                            }
                        });
                    } else {
                        // Decrypt Meta token safely
                        let metaToken = null;
                        try {
                            metaToken = decrypt(user.metaToken);
                        } catch (decErr) {
                            logger.error('[SignupAutomation] Error decrypting Meta token', { workspaceId, error: decErr.message });
                        }

                        if (!metaToken) {
                            logger.error('[SignupAutomation] Decryption failed or Meta token corrupted in user profile', { workspaceId });
                            await prisma.signupAutomationLog.update({
                                where: { id: logRecord.id },
                                data: {
                                    whatsappStatus: "FAILED",
                                    whatsappError: "Decryption failed: Meta token is expired, corrupted, or invalid."
                                }
                            });
                        } else {
                            // Asynchronously send with SAFE MODE delay (5 to 45 seconds) & queue spacing
                            const randomDelayMs = Math.floor(Math.random() * (45000 - 5000 + 1)) + 5000;
                            const now = Date.now();
                            let scheduledTime = now + randomDelayMs;

                            // Queue spacing: at least 1500ms separation
                            if (scheduledTime < SignupAutomationService.nextWhatsAppSendTime + 1500) {
                                scheduledTime = SignupAutomationService.nextWhatsAppSendTime + 1500;
                            }
                            SignupAutomationService.nextWhatsAppSendTime = scheduledTime;
                            const finalDelayMs = scheduledTime - now;

                            logger.info(`[SignupAutomation] Safe Mode delay scheduled: ${finalDelayMs}ms (base delay: ${randomDelayMs}ms, queue spacing active)`, { targetPhone });

                            setTimeout(async () => {
                                try {
                                    // 1. Customer Welcome Message
                                    const interpolatedWelcome = this.safeTemplateInterpolate(
                                        config.whatsappWelcomeTemplate,
                                        { name, email, phone: normalizedPhone, plan }
                                    );

                                    await MetaApiService.sendText({
                                        phoneNumberId: user.phoneNumberId,
                                        token: metaToken,
                                        to: targetPhone,
                                        text: interpolatedWelcome,
                                        context: { userId: workspaceId, source: "signup_automation_customer" }
                                    });

                                    // 2. Optional Admin Alert Message
                                    if (config.whatsappAdminNotifyEnabled && config.whatsappAdminPhone) {
                                        const interpolatedAdmin = this.safeTemplateInterpolate(
                                            config.whatsappAdminTemplate,
                                            { name, email, phone: normalizedPhone, plan }
                                        );

                                        await MetaApiService.sendText({
                                            phoneNumberId: user.phoneNumberId,
                                            token: metaToken,
                                            to: config.whatsappAdminPhone,
                                            text: interpolatedAdmin,
                                            context: { userId: workspaceId, source: "signup_automation_admin" }
                                        });
                                    }

                                    try {
                                        // Update Status to SENT
                                        await prisma.signupAutomationLog.update({
                                            where: { id: logRecord.id },
                                            data: { whatsappStatus: "SENT" }
                                        });
                                    } catch (updateErr) {
                                        if (updateErr.code === 'P2025') {
                                            logger.warn('[SignupAutomation] Log record not found during success status update; skipping.', { id: logRecord.id });
                                        } else {
                                            throw updateErr;
                                        }
                                    }

                                } catch (waError) {
                                    logger.error('[SignupAutomation] WhatsApp message dispatch failed', { error: waError.message });
                                    try {
                                        await prisma.signupAutomationLog.update({
                                            where: { id: logRecord.id },
                                            data: {
                                                whatsappStatus: "FAILED",
                                                whatsappError: waError.message
                                            }
                                        });
                                    } catch (updateErr) {
                                        if (updateErr.code === 'P2025') {
                                            logger.warn('[SignupAutomation] Log record not found during error status update; skipping.', { id: logRecord.id });
                                        } else {
                                            logger.error('[SignupAutomation] Failed to write WhatsApp error status to log', { error: updateErr.message });
                                        }
                                    }
                                }
                            }, finalDelayMs);
                        }
                    }
                }
            } else {
                await prisma.signupAutomationLog.update({
                    where: { id: logRecord.id },
                    data: {
                        whatsappStatus: "SUPPRESSED",
                        whatsappError: "WhatsApp welcome option disabled in settings."
                    }
                });
            }

            // ────────────────────────────────────────────────────────
            // AI VOICE CALLS DISPATCH (SANDBOX & LIMIT COMPLIANCE)
            // ────────────────────────────────────────────────────────
            if (config.voiceEnabled) {
                if (config.sandboxMode) {
                    logger.info('[SignupAutomation] Voice Call Bypassed: Sandbox Mode active', { workspaceId });
                    await prisma.signupAutomationLog.update({
                        where: { id: logRecord.id },
                        data: {
                            voiceStatus: "SUPPRESSED",
                            voiceError: "Sandbox Mode: Voice calling bypassed."
                        }
                    });
                } else if (!normalizedPhone) {
                    await prisma.signupAutomationLog.update({
                        where: { id: logRecord.id },
                        data: {
                            voiceStatus: "FAILED",
                            voiceError: "Lead phone number is empty."
                        }
                    });
                } else {
                    // Check hourly quota cap (Max 3 enqueued voice calls per hour per workspace)
                    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
                    const callCountThisHour = await prisma.signupAutomationLog.count({
                        where: {
                            userId: workspaceId,
                            createdAt: { gte: oneHourAgo },
                            voiceStatus: { in: ["QUEUED", "COMPLETED"] }
                        }
                    });

                    if (callCountThisHour >= 3) {
                        logger.warn('[SignupAutomation] Suppressed: Workspace hourly call quota reached (3 calls/hr)', { workspaceId });
                        await prisma.signupAutomationLog.update({
                            where: { id: logRecord.id },
                            data: {
                                voiceStatus: "SUPPRESSED",
                                voiceError: "Suppressed: Workspace hourly onboarding call limit reached (3 calls/hr)"
                            }
                        });
                    } else {
                        // Enqueue Voice call via VoiceQueueManager
                        try {
                            const context = {
                                type: "signup_onboarding",
                                leadName: name,
                                plan: plan || "Free Trial",
                                provider: config.voiceProvider || "vapi",
                                agentId: config.voiceAgentId,
                                voiceId: config.voiceVoiceId
                            };

                            const job = await VoiceQueueManager.enqueueCall(
                                workspaceId,
                                contact ? contact.id : "onboarding-new",
                                normalizedPhone,
                                context,
                                5000 // 5s standard delayed call start
                            );

                            await prisma.signupAutomationLog.update({
                                where: { id: logRecord.id },
                                data: {
                                    voiceStatus: "QUEUED",
                                    voiceCallId: job.id ? String(job.id) : null
                                }
                            });

                        } catch (voiceQueueError) {
                            logger.error('[SignupAutomation] Voice call enqueuing failed', { error: voiceQueueError.message });
                            await prisma.signupAutomationLog.update({
                                where: { id: logRecord.id },
                                data: {
                                    voiceStatus: "FAILED",
                                    voiceError: voiceQueueError.message
                                }
                            });
                        }
                    }
                }
            } else {
                await prisma.signupAutomationLog.update({
                    where: { id: logRecord.id },
                    data: {
                        voiceStatus: "SUPPRESSED",
                        voiceError: "Voice calling option disabled in settings."
                    }
                });
            }

            return { success: true, logId: logRecord.id };

        } catch (globalErr) {
            logger.error('[SignupAutomation] Global execution failure', { error: globalErr.message });
            await prisma.signupAutomationLog.update({
                where: { id: logRecord.id },
                data: {
                    whatsappStatus: "FAILED",
                    whatsappError: `Global Error: ${globalErr.message}`,
                    voiceStatus: "FAILED",
                    voiceError: `Global Error: ${globalErr.message}`
                }
            });
            return { success: false, error: globalErr.message, logId: logRecord.id };
        }
    }
}

module.exports = SignupAutomationService;
