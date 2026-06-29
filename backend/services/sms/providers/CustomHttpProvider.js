const axios = require('axios');

class CustomHttpProvider {
    constructor(config) {
        // config expected: { apiUrl, method, headersJson, payloadJson }
        this.apiUrl = config.apiUrl;
        this.method = (config.method || 'POST').toUpperCase();
        try {
            this.headers = config.headersJson ? JSON.parse(config.headersJson) : { 'Content-Type': 'application/json' };
            this.payloadTemplate = config.payloadJson ? JSON.parse(config.payloadJson) : {};
        } catch (e) {
            this.headers = { 'Content-Type': 'application/json' };
            this.payloadTemplate = {};
        }
    }

    async sendOTP(phone, otp) {
        if (!this.apiUrl) {
            throw new Error("Custom HTTP API URL is required");
        }

        // Deep copy the template and replace placeholders {otp} and {mobile}
        let payloadString = JSON.stringify(this.payloadTemplate);
        payloadString = payloadString.replace(/\{otp\}/g, otp).replace(/\{mobile\}/g, phone);
        const interpolatedPayload = JSON.parse(payloadString);

        // Interpolate URL params too if it's GET
        let url = this.apiUrl.replace(/\{otp\}/g, otp).replace(/\{mobile\}/g, phone);

        try {
            const options = {
                method: this.method,
                url: url,
                headers: this.headers
            };

            if (this.method !== 'GET') {
                options.data = interpolatedPayload;
            }

            const response = await axios(options);
            console.log(`[Custom HTTP] OTP sent successfully to ${phone}`);
            return response.data;
        } catch (error) {
            console.error(`[Custom HTTP Error] Failed to send OTP:`, error.response?.data || error.message);
            throw new Error("Failed to send Custom HTTP OTP: " + (error.response?.statusText || error.message));
        }
    }
}

module.exports = CustomHttpProvider;
