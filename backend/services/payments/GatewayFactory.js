/**
 * GatewayFactory.js
 * Phase B — Instantiates the correct payment gateway adapter from workspace config.
 * Decrypts the gateway's encrypted config and returns a ready-to-use adapter.
 */
const { decrypt } = require('../../utils/encryption');
const RazorpayAdapter = require('./adapters/RazorpayAdapter');
const StripeAdapter = require('./adapters/StripeAdapter');
const CashfreeAdapter = require('./adapters/CashfreeAdapter');
const UPIQRAdapter = require('./adapters/UPIQRAdapter');

// Feature flag: set FEATURE_MULTI_GATEWAY=true to use new PaymentGateway table
const MULTI_GATEWAY_ENABLED = process.env.FEATURE_MULTI_GATEWAY === 'true';

const ADAPTER_MAP = {
    razorpay: RazorpayAdapter,
    stripe: StripeAdapter,
    cashfree: CashfreeAdapter,
    upi: UPIQRAdapter,
};

class GatewayFactory {
    /**
     * Create an adapter instance from a PaymentGateway DB record
     * @param {Object} gatewayRecord - A row from the PaymentGateway table
     * @returns {BasePaymentGateway} adapter instance
     */
    static fromGatewayRecord(gatewayRecord) {
        const AdapterClass = ADAPTER_MAP[gatewayRecord.provider];
        if (!AdapterClass) {
            throw new Error(`Unsupported payment provider: ${gatewayRecord.provider}`);
        }

        let config;
        try {
            config = JSON.parse(decrypt(gatewayRecord.encryptedConfig));
        } catch (e) {
            throw new Error(`Failed to decrypt gateway config for provider ${gatewayRecord.provider}: ${e.message}`);
        }

        return new AdapterClass({ ...config, mode: gatewayRecord.mode });
    }

    /**
     * (Phase A Compatibility) Create a RazorpayAdapter from a PaymentCredential record
     * @param {Object} credentialRecord - A row from the PaymentCredential table
     * @returns {RazorpayAdapter}
     */
    static fromLegacyCredential(credentialRecord) {
        return new RazorpayAdapter({
            keyId: decrypt(credentialRecord.encryptedKeyId),
            keySecret: decrypt(credentialRecord.encryptedSecret),
            mode: credentialRecord.mode
        });
    }
}

module.exports = { GatewayFactory, ADAPTER_MAP, MULTI_GATEWAY_ENABLED };
