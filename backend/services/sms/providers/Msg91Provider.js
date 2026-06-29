const axios = require('axios');

class Msg91Provider {
    constructor(config) {
        this.authKey = config.authKey;
        this.templateId = config.templateId; // MSG91 often requires DLT template ID
        this.senderId = config.senderId;
    }

    async sendOTP(phone, otp) {
        if (!this.authKey || !this.templateId) {
            throw new Error("MSG91 Configuration is incomplete");
        }

        const phoneFormatted = phone.startsWith('+') ? phone.replace('+', '') : phone;

        // Using MSG91 Send OTP API (supports otp expiry, template)
        // https://docs.msg91.com/reference/send-otp
        try {
            const response = await axios.post(
                'https://control.msg91.com/api/v5/otp',
                {
                    template_id: this.templateId,
                    mobile: phoneFormatted,
                    authkey: this.authKey,
                    otp: otp,
                    // If senderId is empty, MSG91 uses default sender set in template
                }
            );

            if (response.data?.type === 'error') {
                throw new Error(response.data.message || "MSG91 API returned an error");
            }
            console.log(`[MSG91] OTP sent successfully to ${phoneFormatted}`);
            return response.data;
        } catch (error) {
            console.error(`[MSG91 Error] Failed to send OTP:`, error.response?.data || error.message);
            throw new Error(error.response?.data?.message || error.message || "Failed to send MSG91 OTP");
        }
    }
}

module.exports = Msg91Provider;
