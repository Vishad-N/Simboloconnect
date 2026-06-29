const prisma = require('../../prismaClient');
const EmailOTPService = require('./channels/EmailOTPService');
const SmsOTPService = require('./channels/SmsOTPService');
const WhatsAppOTPService = require('./channels/WhatsAppOTPService');

class OtpManagerService {

    static OTP_EXPIRY_MINUTES = 10;
    static MAX_ATTEMPTS = 5;

    /**
     * Helper to read dynamic settings
     */
    static async getRequiredChannels(context) {
        // Expected keys: REQUIRE_SIGNUP_EMAIL, REQUIRE_SIGNUP_SMS, REQUIRE_SIGNUP_WA
        // Expected keys: REQUIRE_FORGOT_EMAIL, REQUIRE_FORGOT_SMS, REQUIRE_FORGOT_WA
        const prefix = context === 'SIGNUP' ? 'REQUIRE_SIGNUP' : 'REQUIRE_FORGOT';

        const settingsList = await prisma.systemSetting.findMany({
            where: { key: { in: [`${prefix}_EMAIL`, `${prefix}_SMS`, `${prefix}_WA`] } }
        });

        const activeChannels = [];
        settingsList.forEach(s => {
            if (s.value === 'true') {
                if (s.key.endsWith('_EMAIL')) activeChannels.push('EMAIL');
                if (s.key.endsWith('_SMS')) activeChannels.push('SMS');
                if (s.key.endsWith('_WA')) activeChannels.push('WHATSAPP');
            }
        });

        // Verify Gateway Configurations before enforcing them
        const validatedChannels = [];
        for (const channel of activeChannels) {
            if (channel === 'EMAIL') {
                // Email is always validated as it falls back to the core platform SMTP config realistically.
                validatedChannels.push('EMAIL');
            } else if (channel === 'SMS') {
                const activeSmsGateway = await prisma.smsGateway.findFirst({ where: { status: 'ACTIVE' } });
                console.log(`[OTP DEBUG] Checking SMS Gateway... Found Active:`, activeSmsGateway ? activeSmsGateway.provider : 'NONE');
                if (activeSmsGateway) {
                    validatedChannels.push('SMS');
                } else {
                    console.warn(`[OtpManagerService] SMS OTP enabled but no active SMS Gateway. Suppressing SMS requirement.`);
                }
            } else if (channel === 'WHATSAPP') {
                const waToken = await prisma.systemSetting.findUnique({ where: { key: 'SYSTEM_META_TOKEN' } });
                const waPhone = await prisma.systemSetting.findUnique({ where: { key: 'SYSTEM_PHONE_NUMBER_ID' } });
                console.log(`[OTP DEBUG] Checking WhatsApp... Token: ${waToken?.value ? 'YES' : 'NO'}, Phone: ${waPhone?.value ? 'YES' : 'NO'}`);
                if (waToken && waToken.value && waPhone && waPhone.value) {
                    validatedChannels.push('WHATSAPP');
                } else {
                    console.warn(`[OtpManagerService] WhatsApp OTP enabled but Meta API not configured. Suppressing WA requirement.`);
                }
            }
        }

        if (validatedChannels.length === 0) {
            console.warn(`[OtpManagerService] No valid configured channels for context ${context}. Defaulting to EMAIL.`);
            return ['EMAIL'];
        }

        console.log(`[OTP DEBUG] Returning Fully Validated Channels:`, validatedChannels);
        return validatedChannels;
    }

    static generateCode() {
        return Math.floor(100000 + Math.random() * 900000).toString(); // 6 digits
    }

    /**
     * Determines required channels matching context, drops old OTPs, generates new ones, and dispatches.
     */
    static async generateAndSendOTPs(userId, phone, email, context) {
        const requiredChannels = await this.getRequiredChannels(context);

        if (!requiredChannels.length) {
            throw new Error(`No OTP channels are enabled for ${context}.`);
        }

        const expiresAt = new Date(Date.now() + this.OTP_EXPIRY_MINUTES * 60 * 1000);

        const dispatchPromises = [];

        for (const channel of requiredChannels) {
            // Check if there is an unverified attempt limit
            const existing = await prisma.otpVerification.findFirst({
                where: { userId, channel_type: channel, context, is_verified: false },
                orderBy: { createdAt: 'desc' }
            });

            if (existing && existing.attempts >= this.MAX_ATTEMPTS) {
                // If it's still unexpired, block resend
                if (new Date() < new Date(existing.expires_at)) {
                    throw new Error(`Maximum OTP attempts reached for ${channel}. Please wait 10 minutes to try again.`);
                }
            }

            // Invalidate/delete old unverified OTPs for this context and channel
            await prisma.otpVerification.deleteMany({
                where: { userId, channel_type: channel, context, is_verified: false }
            });

            const otp = this.generateCode();

            // Save to DB
            await prisma.otpVerification.create({
                data: {
                    userId,
                    channel_type: channel,
                    context,
                    otp_code: otp,
                    expires_at: expiresAt
                }
            });

            // Dispatch
            try {
                if (channel === 'EMAIL' && email) {
                    dispatchPromises.push(EmailOTPService.sendOTP(email, otp, userId));
                } else if (channel === 'SMS' && phone) {
                    dispatchPromises.push(SmsOTPService.sendOTP(phone, otp));
                } else if (channel === 'WHATSAPP' && phone) {
                    dispatchPromises.push(WhatsAppOTPService.sendOTP(phone, otp));
                }
            } catch (error) {
                console.error(`[OtpManagerService] Failed to queue ${channel} OTP:`, error);
            }
        }

        // Fire all dispatches concurrently
        const results = await Promise.allSettled(dispatchPromises);
        
        // If all attempts failed, bubble up the error so the UI blocks progression
        const allFailed = results.length > 0 && results.every(r => r.status === 'rejected');
        if (allFailed) {
            console.error("[OtpManagerService] All OTP dispatch channels failed:", results.map(r => r.reason));
            throw new Error(results[0].reason?.message || "Failed to deliver OTP. Please check gateway configurations.");
        }

        return {
            success: true,
            requiredChannels,
            message: `OTP sent via: ${requiredChannels.join(', ')}`
        };
    }

    /**
     * Verify a specific channel OTP.
     */
    static async verifyOTP(userId, channel, otpCode, context) {
        const record = await prisma.otpVerification.findFirst({
            where: { userId, channel_type: channel, context, is_verified: false },
            orderBy: { createdAt: 'desc' }
        });

        if (!record) {
            throw new Error(`No pending OTP verification found for ${channel}.`);
        }

        if (new Date() > new Date(record.expires_at)) {
            throw new Error(`The ${channel} OTP has expired. Please request a new one.`);
        }

        if (record.attempts >= this.MAX_ATTEMPTS) {
            throw new Error(`Too many incorrect attempts for ${channel} OTP.`);
        }

        if (record.otp_code !== otpCode) {
            await prisma.otpVerification.update({
                where: { id: record.id },
                data: { attempts: record.attempts + 1 }
            });
            throw new Error(`Invalid OTP. You have ${this.MAX_ATTEMPTS - record.attempts - 1} attempts left.`);
        }

        // Mark as verified
        await prisma.otpVerification.update({
            where: { id: record.id },
            data: { is_verified: true }
        });

        return { success: true, message: `${channel} OTP verified.` };
    }

    /**
     * Check if all required channels for a specific context have been successfully verified.
     */
    static async isContextFullyVerified(userId, context) {
        const requiredChannels = await this.getRequiredChannels(context);

        // Fetch latest records for this user & context
        const records = await prisma.otpVerification.findMany({
            where: { userId, context },
            orderBy: { createdAt: 'desc' }
        });

        // Group by channel
        const verificationMap = {};
        for (const record of records) {
            // We only care about the most recent state per channel
            if (verificationMap[record.channel_type] === undefined) {
                // Verified acts as true, Expiry implies false if not already verified
                verificationMap[record.channel_type] = record.is_verified;
            }
        }

        const pendingChannels = [];

        for (const channel of requiredChannels) {
            if (!verificationMap[channel]) {
                pendingChannels.push(channel);
            }
        }

        return {
            isFullyVerified: pendingChannels.length === 0,
            pendingChannels,
            requiredChannels
        };
    }

    /**
     * Cleanup: Called when a signup/forgot password flow is completely finished successfully.
     * Deletes the rows so they can't be reused maliciously.
     */
    static async cleanupContext(userId, context) {
        await prisma.otpVerification.deleteMany({
            where: { userId, context }
        });
    }

    /**
     * Resend strictly for one channel
     */
    static async resendOTP(userId, phone, email, channel, context) {
        const requiredChannels = await this.getRequiredChannels(context);

        if (!requiredChannels.includes(channel)) {
            throw new Error(`${channel} is not a valid requirement for ${context}.`);
        }

        const existing = await prisma.otpVerification.findFirst({
            where: { userId, channel_type: channel, context, is_verified: false },
            orderBy: { createdAt: 'desc' }
        });

        if (existing && existing.attempts >= this.MAX_ATTEMPTS && new Date() < new Date(existing.expires_at)) {
            throw new Error("Max attempts reached. Cannot resend yet.");
        }

        // Delete old
        await prisma.otpVerification.deleteMany({
            where: { userId, channel_type: channel, context, is_verified: false }
        });

        const otp = this.generateCode();
        const expiresAt = new Date(Date.now() + this.OTP_EXPIRY_MINUTES * 60 * 1000);

        await prisma.otpVerification.create({
            data: {
                userId,
                channel_type: channel,
                context,
                otp_code: otp,
                expires_at: expiresAt
            }
        });

        try {
            if (channel === 'EMAIL' && email) {
                await EmailOTPService.sendOTP(email, otp, userId);
            } else if (channel === 'SMS' && phone) {
                await SmsOTPService.sendOTP(phone, otp);
            } else if (channel === 'WHATSAPP' && phone) {
                await WhatsAppOTPService.sendOTP(phone, otp);
            }
        } catch (e) {
            throw new Error(`Failed to deliver ${channel} OTP: ${e.message}`);
        }

        return { success: true };
    }
}

module.exports = OtpManagerService;
