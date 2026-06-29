const axios = require('axios');

class VonageProvider {
    constructor(config) {
        this.apiKey = config.apiKey;
        this.apiSecret = config.apiSecret;
        this.fromName = config.fromName || 'System';
    }

    async sendOTP(phone, otp) {
        if (!this.apiKey || !this.apiSecret) {
            throw new Error("Vonage Configuration is incomplete");
        }

        const phoneFormatted = phone.startsWith('+') ? phone.replace('+', '') : phone;
        const message = `Your verification code is ${otp}. Do not share this with anyone.`;

        const payload = {
            api_key: this.apiKey,
            api_secret: this.apiSecret,
            to: phoneFormatted,
            from: this.fromName,
            text: message
        };

        try {
            const response = await axios.post(
                'https://rest.nexmo.com/sms/json',
                payload,
                {
                    headers: {
                        'Content-Type': 'application/json'
                    }
                }
            );

            if (response.data?.messages?.[0]?.status !== '0') {
                throw new Error(response.data?.messages?.[0]?.['error-text'] || "Vonage API returned an error");
            }

            console.log(`[Vonage] OTP sent successfully to ${phoneFormatted}`);
            return response.data;
        } catch (error) {
            console.error(`[Vonage Error] Failed to send OTP:`, error.response?.data || error.message);
            throw new Error(error.response?.data?.error_title || error.message || "Failed to send Vonage OTP");
        }
    }
}

module.exports = VonageProvider;
