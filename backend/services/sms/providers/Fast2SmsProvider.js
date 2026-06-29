const axios = require('axios');

class Fast2SmsProvider {
    constructor(config) {
        this.apiKey = config.apiKey;
        this.senderId = config.senderId || 'TXTIND';
        this.route = config.route || 'v3';
    }

    async sendOTP(phone, otp) {
        if (!this.apiKey) throw new Error("Fast2SMS API Key is missing");

        const payload = {
            route: this.route,
            sender_id: this.senderId,
            message: `Your verification code is ${otp}. Do not share this with anyone.`,
            language: "english",
            flash: 0,
            numbers: phone
        };

        try {
            const response = await axios.post("https://www.fast2sms.com/dev/bulkV2", payload, {
                headers: {
                    "authorization": this.apiKey,
                    "Content-Type": "application/json"
                }
            });
            console.log(`[Fast2SMS] OTP sent successfully to ${phone}`);
            return response.data;
        } catch (error) {
            console.error(`[Fast2SMS Error] Failed to send OTP:`, error.response?.data || error.message);
            throw new Error(error.response?.data?.message || "Failed to send Fast2SMS OTP");
        }
    }
}

module.exports = Fast2SmsProvider;
