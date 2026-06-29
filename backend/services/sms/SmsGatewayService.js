const prisma = require('../../prismaClient');
const Fast2SmsProvider = require('./providers/Fast2SmsProvider');
const TwilioProvider = require('./providers/TwilioProvider');
const Msg91Provider = require('./providers/Msg91Provider');
const PlivoProvider = require('./providers/PlivoProvider');
const VonageProvider = require('./providers/VonageProvider');
const CustomHttpProvider = require('./providers/CustomHttpProvider');

class SmsGatewayService {

    static getProviderInstance(providerName, configJson) {
        switch (providerName) {
            case 'FAST2SMS':
                return new Fast2SmsProvider(configJson);
            case 'TWILIO':
                return new TwilioProvider(configJson);
            case 'MSG91':
                return new Msg91Provider(configJson);
            case 'PLIVO':
                return new PlivoProvider(configJson);
            case 'VONAGE':
                return new VonageProvider(configJson);
            case 'CUSTOM':
                return new CustomHttpProvider(configJson);
            default:
                throw new Error(`Unsupported SMS Provider: ${providerName}`);
        }
    }

    static async sendOTP(phone, otp) {
        // Fetch Primary Gateway
        let primaryGateway = await prisma.smsGateway.findFirst({
            where: { is_primary: true, status: 'ACTIVE' }
        });

        // Use Fallback if Primary is missing, but log a warning
        if (!primaryGateway) {
            console.warn("[SmsGatewayService] No Primary SMS Gateway configured! Looking for Secondary...");
            primaryGateway = await prisma.smsGateway.findFirst({
                where: { is_secondary: true, status: 'ACTIVE' }
            });

            if (!primaryGateway) {
                console.warn("[SmsGatewayService] No Active SMS Gateways available.");
                throw new Error("No active SMS Gateway is configured to send OTPs.");
            }
        }

        try {
            const provider = this.getProviderInstance(primaryGateway.provider, primaryGateway.config_json);
            return await provider.sendOTP(phone, otp);
        } catch (error) {
            console.error(`[SmsGatewayService] Primary Gateway (${primaryGateway.provider}) failed:`, error.message);

            // Auto Fallback to Secondary if primary failed
            const secondaryGateway = await prisma.smsGateway.findFirst({
                where: { is_secondary: true, status: 'ACTIVE', id: { not: primaryGateway.id } }
            });

            if (secondaryGateway) {
                console.log(`[SmsGatewayService] Attempting fallback to Secondary Gateway (${secondaryGateway.provider})...`);
                try {
                    const fallbackProvider = this.getProviderInstance(secondaryGateway.provider, secondaryGateway.config_json);
                    return await fallbackProvider.sendOTP(phone, otp);
                } catch (fallbackError) {
                    console.error(`[SmsGatewayService] Secondary Gateway (${secondaryGateway.provider}) also failed:`, fallbackError.message);
                    throw new Error(`Both Primary and Secondary SMS Gateways failed. ${error.message}`);
                }
            } else {
                throw error;
            }
        }
    }

    // Helper for testing gateways directly from admin panel without waiting for OTP trigger
    static async testGateway(gatewayId, phone) {
        const gateway = await prisma.smsGateway.findUnique({ where: { id: gatewayId } });
        if (!gateway) throw new Error("Gateway not found");

        const testOtp = Math.floor(100000 + Math.random() * 900000).toString(); // 6 digit fake OTP
        const provider = this.getProviderInstance(gateway.provider, gateway.config_json);

        return await provider.sendOTP(phone, testOtp);
    }
}

module.exports = SmsGatewayService;
