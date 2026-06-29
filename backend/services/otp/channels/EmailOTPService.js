const EmailService = require('../../email/EmailService');

class EmailOTPService {
    static async sendOTP(email, otp, userId = null) {
        if (!email) throw new Error("Email address is missing");

        try {
            // Determine dynamic sender name based on tenant configuration
            let senderName = "Platform";
            if (userId) {
                const tenantConfig = await EmailService.getTenantSmtpSettings(userId);
                if (tenantConfig && tenantConfig.senderName) {
                    senderName = tenantConfig.senderName;
                }
            }
            if (senderName === "Platform") {
                const platformConfig = await EmailService.getPlatformSmtpSettings();
                senderName = platformConfig.senderName || "Platform";
            }

            const htmlContent = `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="utf-8">
                    <title>OTP Verification</title>
                </head>
                <body style="margin: 0; padding: 0; background-color: #f6f9fc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f6f9fc; padding: 40px 20px;">
                        <tr>
                            <td align="center">
                                <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; background-color: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0; padding: 40px;">
                                    <tr>
                                        <td align="center">
                                            <h2 style="margin: 0 0 20px; font-size: 24px; color: #333333; font-weight: 700;">Welcome to ${senderName}!</h2>
                                            
                                            <p style="margin: 0 0 30px; font-size: 15px; line-height: 24px; color: #4b5563; text-align: left;">
                                                Please use the following 6-digit verification code to activate your account. This code is valid for 15 minutes.
                                            </p>

                                            <div style="background-color: #f3f4f6; border-radius: 8px; padding: 20px; text-align: center; margin-bottom: 30px;">
                                                <span style="font-family: monospace; font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #2563eb;">${otp}</span>
                                            </div>

                                            <p style="margin: 0; font-size: 13px; color: #9ca3af; text-align: center;">
                                                If you did not request this, please ignore this email.
                                            </p>
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                    </table>
                </body>
                </html>
            `;

            const mailOptions = {
                to: email,
                subject: `Your OTP Verification Code - ${senderName}`,
                text: `Your verification code is: ${otp}\n\nThis code will expire in 15 minutes. Do not share this code with anyone.`,
                html: htmlContent
            };

            const info = await EmailService.sendEmail(userId, mailOptions);
            return info;
        } catch (error) {
            console.error(`[Email OTP] Pipeline failed for ${email}:`, error);
            throw new Error("Email delivery failed: " + error.message);
        }
    }
}

module.exports = EmailOTPService;
