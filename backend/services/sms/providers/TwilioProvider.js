const axios = require('axios');

class TwilioProvider {
    constructor(config) {
        this.accountSid = config.accountSid;
        this.authToken = config.authToken;
        this.fromNumber = config.fromNumber;
    }

    async sendOTP(phone, otp) {
        if (!this.accountSid || !this.authToken || !this.fromNumber) {
            throw new Error("Twilio Configuration is incomplete");
        }

        const phoneFormatted = phone.startsWith('+') ? phone : '+' + phone;
        const message = `Your verification code is ${otp}. Do not share this with anyone.`;

        // Twilio expects url-encoded payload for its /Messages.json endpoint rather than JSON body
        const credentials = Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64');
        const data = new URLSearchParams();
        data.append('To', phoneFormatted);
        data.append('From', this.fromNumber);
        data.append('Body', message);

        try {
            const response = await axios.post(
                `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`,
                data,
                {
                    headers: {
                        'Authorization': `Basic ${credentials}`,
                        'Content-Type': 'application/x-www-form-urlencoded'
                    }
                }
            );
            console.log(`[Twilio] OTP sent successfully to ${phoneFormatted}`);
            return response.data;
        } catch (error) {
            console.error(`[Twilio Error] Failed to send OTP:`, error.response?.data || error.message);
            throw new Error(error.response?.data?.message || "Failed to send Twilio OTP");
        }
    }
}

module.exports = TwilioProvider;
