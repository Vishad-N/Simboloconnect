const nodemailer = require('nodemailer');
const prisma = require('../../prismaClient');

class EmailService {
    /**
     * Helper to get system-wide fallback SMTP settings
     */
    static async getPlatformSmtpSettings() {
        const settingsList = await prisma.systemSetting.findMany({
            where: {
                key: {
                    in: ['SMTP_HOST', 'SMTP_PORT', 'SMTP_SECURE', 'SMTP_USER', 'SMTP_PASSWORD', 'SMTP_FROM_EMAIL', 'SMTP_FROM_NAME']
                }
            }
        });

        const settings = {};
        settingsList.forEach(s => { settings[s.key] = s.value; });

        if (!settings.SMTP_HOST || !settings.SMTP_USER || !settings.SMTP_PASSWORD) {
            throw new Error("System SMTP configuration is missing or incomplete.");
        }

        const portObj = parseInt(settings.SMTP_PORT, 10) || 587;
        return {
            host: settings.SMTP_HOST,
            port: portObj,
            secure: portObj === 465 || settings.SMTP_SECURE === 'true',
            auth: {
                user: settings.SMTP_USER,
                pass: settings.SMTP_PASSWORD
            },
            tls: {
                rejectUnauthorized: false
            },
            senderName: settings.SMTP_FROM_NAME || 'Support',
            senderEmail: settings.SMTP_FROM_EMAIL || settings.SMTP_USER
        };
    }

    /**
     * Helper to get a tenant's custom SMTP configuration
     */
    static async getTenantSmtpSettings(userId) {
        if (!userId) return null;

        const config = await prisma.smtpConfig.findUnique({
            where: { userId }
        });

        if (!config) return null;

        return {
            host: config.host,
            port: config.port,
            secure: config.encryptionType === 'SSL' || config.port === 465,
            auth: {
                user: config.username,
                pass: config.password
            },
            senderName: config.senderName,
            senderEmail: config.senderEmail,
            tls: { rejectUnauthorized: false }
        };
    }

    /**
     * Tests an SMTP connection dynamically (useful for Admin panel tests)
     */
    static async testConnection(config) {
        const transporter = nodemailer.createTransport({
            host: config.host,
            port: parseInt(config.port, 10),
            secure: config.encryptionType === 'SSL' || config.port === 465,
            auth: {
                user: config.username,
                pass: config.password
            },
            tls: { rejectUnauthorized: false },
            connectionTimeout: 10000,
            greetingTimeout: 10000,
            socketTimeout: 20000
        });

        try {
            await transporter.verify();
            return { success: true, message: "Connection verified successfully!" };
        } catch (error) {
            console.error("[EmailService] Test Connection Failed:", error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Centralized email sender.
     * @param {string|null} userId - The ID of the tenant. If null, uses platform default.
     * @param {Object} options - { to, subject, html, text }
     */
    static async sendEmail(userId, { to, subject, html, text }) {
        if (!to) throw new Error("Recipient email 'to' address is missing");
        if (!subject) throw new Error("Email 'subject' is missing");

        let smtpConfig;

        // 1. Try to load tenant config if requested
        if (userId) {
            try {
                smtpConfig = await this.getTenantSmtpSettings(userId);
            } catch (err) {
                console.error(`[EmailService] Failed to fetch config for user ${userId}:`, err);
            }
        }

        // 2. Fallback to Platform settings if no tenant config exists
        if (!smtpConfig) {
            smtpConfig = await this.getPlatformSmtpSettings();
        }

        const transporter = nodemailer.createTransport({
            host: smtpConfig.host,
            port: smtpConfig.port,
            secure: smtpConfig.secure,
            auth: smtpConfig.auth,
            tls: smtpConfig.tls,
            connectionTimeout: 10000, // 10 seconds to connect
            greetingTimeout: 10000,   // 10 seconds to greet
            socketTimeout: 20000      // 20 seconds of inactivity
        });

        // 3. Ensure the 'From' header is strictly set to the configured sender mask
        const fromHeader = `"${smtpConfig.senderName}" <${smtpConfig.senderEmail}>`;

        const mailOptions = {
            from: fromHeader,
            to,
            subject,
            html,
            text
        };

        const info = await transporter.sendMail(mailOptions);
        console.log(`[EmailService] Delivered '${subject}' to ${to}. Message ID: ${info.messageId}`);
        return info;
    }
}

module.exports = EmailService;
