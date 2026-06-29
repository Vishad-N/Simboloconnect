const SmsGatewayService = require('../../sms/SmsGatewayService');

class SmsOTPService {
    static async sendOTP(phone, otp) {
        if (!phone) throw new Error("Phone number is missing for SMS OTP.");

        try {
            await SmsGatewayService.sendOTP(phone, otp);
            console.log(`[SMS OTP] Dispatched via Gateway Strategy to ${phone}`);
        } catch (error) {
            console.error(`[SMS OTP] Dispatch failed via Gateway:`, error.message);
            throw new Error("SMS delivery failed: " + error.message);
        }
    }
}

module.exports = SmsOTPService;
