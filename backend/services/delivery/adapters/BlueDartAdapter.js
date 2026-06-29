/**
 * BlueDartAdapter.js
 * Concrete adapter for BlueDart API implementing BaseDeliveryProvider.
 */
const axios = require('axios');
const BaseDeliveryProvider = require('../BaseDeliveryProvider');

class BlueDartAdapter extends BaseDeliveryProvider {
    constructor(config) {
        super(config);
        this.providerName = 'bluedart';
        this.licenseKey = config.licenseKey;
        this.loginId = config.loginId;
    }

    async createShipment(order, details) {
        try {
            // BlueDart SOAP or JSON REST request placeholder
            // Unified adapter interface keeps it standard
            const awbNumber = `BD${Math.floor(100000000 + Math.random() * 900000000)}`;
            return {
                awbNumber,
                trackingId: `bluedart_${order.id}`,
                status: 'pending'
            };
        } catch (error) {
            console.error('[BlueDartAdapter] createShipment error:', error.message);
            throw new Error(`BlueDart: ${error.message}`);
        }
    }

    async trackShipment(awbNumber) {
        // Return simulated track response for BlueDart APIs
        return {
            status: 'in_transit',
            location: 'BlueDart Regional Hub',
            estimatedDelivery: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
            history: []
        };
    }

    parseWebhookEvent(payload) {
        if (!payload.awbNo) return null;
        return {
            awbNumber: payload.awbNo,
            status: String(payload.status).toLowerCase(),
            location: payload.location || '',
            statusHistory: []
        };
    }
}

module.exports = BlueDartAdapter;
