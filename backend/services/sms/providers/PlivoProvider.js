const axios = require('axios');

class PlivoProvider {
    constructor(config) {
        this.authId = config.authId;
        this.authToken = config.authToken;
        this.srcNumber = config.srcNumber;
    }

    async sendOTP(phone, otp) {
        if (!this.authId || !this.authToken || !this.srcNumber) {
            throw new Error("Plivo Configuration is incomplete");
        }

        const phoneFormatted = phone.startsWith('+') ? phone.replace('+', '') : phone;
        const message = `Your verification code is ${otp}. Do not share this with anyone.`;

        const credentials = Buffer.from(`${this.authId}:${this.authToken}`).toString('base64');
        const payload = {
            src: this.srcNumber,
            dst: phoneFormatted,
            text: message,
        };

        try {
            const response = await axios.post(
                `https://api.plivo.com/v1/Account/${this.authId}/Message/`,
                payload,
                {
                    headers: {
                        'Authorization': `Basic ${credentials}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
            console.log(`[Plivo] OTP sent successfully to ${phoneFormatted}`);
            return response.data;
        } catch (error) {
            console.error(`[Plivo Error] Failed to send OTP:`, error.response?.data || error.message);
            throw new Error(error.response?.data?.error || "Failed to send Plivo OTP");
        }
    }
}

module.exports = PlivoProvider;
