/**
 * BasePaymentGateway.js
 * Abstract interface that all payment gateway adapters must implement.
 * Phase B — Enterprise Multi-Gateway Architecture
 */
class BasePaymentGateway {
    constructor(config) {
        if (new.target === BasePaymentGateway) {
            throw new Error('BasePaymentGateway is abstract and cannot be instantiated directly.');
        }
        this.config = config;
        this.providerName = 'base';
    }

    /**
     * Create a payment link / checkout URL
     * @param {Object} params
     * @param {number} params.amount - Amount in whole INR (not paise)
     * @param {string} params.currency
     * @param {string} params.referenceId - Internal CheckoutSession ID
     * @param {string} params.description
     * @param {Object} params.customer - { name, contact, email }
     * @param {Object} params.notes - Metadata (workspaceId, contactPhone, etc.)
     * @returns {Promise<{id: string, url: string, status: string}>}
     */
    async createPaymentLink(params) {
        throw new Error(`${this.providerName}.createPaymentLink() not implemented.`);
    }

    /**
     * Verify an inbound webhook signature
     * @param {string|Buffer} rawBody
     * @param {string} signature - Header value from provider
     * @param {string} secret - Workspace webhook secret
     * @returns {boolean}
     */
    verifyWebhookSignature(rawBody, signature, secret) {
        throw new Error(`${this.providerName}.verifyWebhookSignature() not implemented.`);
    }

    /**
     * Parse a webhook payload into a normalized event object
     * @param {Object} payload - The raw parsed JSON body
     * @returns {{ event: string, linkId: string, status: string, metadata: Object } | null}
     */
    parseWebhookEvent(payload) {
        throw new Error(`${this.providerName}.parseWebhookEvent() not implemented.`);
    }

    /**
     * Get a payment link's current status from the provider's API
     * @param {string} linkId - The provider's payment link ID
     * @returns {Promise<{ status: string, paidAt: Date|null }>}
     */
    async getPaymentStatus(linkId) {
        throw new Error(`${this.providerName}.getPaymentStatus() not implemented.`);
    }

    /**
     * Create a recurring Subscription Plan at the gateway
     * @param {Object} params - { name, amount, interval, currency }
     * @returns {Promise<{ externalPlanId: string }>}
     */
    async createSubscriptionPlan(params) {
        throw new Error(`${this.providerName}.createSubscriptionPlan() not implemented.`);
    }

    /**
     * Create a customer recurring subscription
     * @param {Object} params - { externalPlanId, customerPhone, customerEmail, customerName, metadata }
     * @returns {Promise<{ externalSubId: string, status: string, url: string }>}
     */
    async createSubscription(params) {
        throw new Error(`${this.providerName}.createSubscription() not implemented.`);
    }

    /**
     * Cancel an active recurring subscription
     * @param {string} externalSubId
     * @returns {Promise<{ status: string }>}
     */
    async cancelSubscription(externalSubId) {
        throw new Error(`${this.providerName}.cancelSubscription() not implemented.`);
    }
}

module.exports = BasePaymentGateway;
