/**
 * BaseDeliveryProvider.js
 * Abstract interface that all courier / fulfillment adapters must implement.
 * Phase B — Enterprise Delivery Architecture
 */
class BaseDeliveryProvider {
    constructor(config) {
        if (new.target === BaseDeliveryProvider) {
            throw new Error('BaseDeliveryProvider is abstract and cannot be instantiated.');
        }
        this.config = config;
        this.providerName = 'base_courier';
    }

    /**
     * Ship a new order (Create Shipment / Generate AWB)
     * @param {Object} order - The EcomOrder record
     * @param {Object} details - Weight, package dimensions, destination
     * @returns {Promise<{ awbNumber: string, trackingId: string, status: string }>}
     */
    async createShipment(order, details) {
        throw new Error(`${this.providerName}.createShipment() not implemented.`);
    }

    /**
     * Get active tracking status details from the courier
     * @param {string} awbNumber
     * @returns {Promise<{ status: string, location: string, estimatedDelivery: Date|null, history: Array }>}
     */
    async trackShipment(awbNumber) {
        throw new Error(`${this.providerName}.trackShipment() not implemented.`);
    }

    /**
     * Parse inbound carrier webhook event into normalized status
     * @param {Object} payload
     * @returns {{ awbNumber: string, status: string, location: string, statusHistory: Array } | null}
     */
    parseWebhookEvent(payload) {
        throw new Error(`${this.providerName}.parseWebhookEvent() not implemented.`);
    }
}

module.exports = BaseDeliveryProvider;
