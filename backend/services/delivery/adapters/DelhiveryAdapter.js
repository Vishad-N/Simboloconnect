/**
 * DelhiveryAdapter.js
 * Concrete adapter for Delhivery API implementing BaseDeliveryProvider.
 */
const axios = require('axios');
const BaseDeliveryProvider = require('../BaseDeliveryProvider');

class DelhiveryAdapter extends BaseDeliveryProvider {
    constructor(config) {
        super(config);
        this.providerName = 'delhivery';
        this.token = config.apiKey;
        this.mode = config.mode || 'live';
        this.baseUrl = this.mode === 'test'
            ? 'https://track.delhivery.com'
            : 'https://track.delhivery.com'; // Standard base URL
    }

    _headers() {
        return {
            'Authorization': `Token ${this.token}`,
            'Content-Type': 'application/json'
        };
    }

    async createShipment(order, details) {
        try {
            // Delhivery creation endpoint payload
            const payload = {
                shipments: [{
                    name: order.customerName || 'Customer',
                    add: details.shippingAddress || 'India Address',
                    pin: details.pincode || '400001',
                    phone: order.customerPhone || '9999999999',
                    payment_mode: order.paymentStatus === 'paid' ? 'Prepaid' : 'COD',
                    cod_amount: order.paymentStatus === 'paid' ? 0 : Number(order.totalAmount || 0),
                    order: order.id,
                    weight: String(details.weight || 500) // Weight in grams
                }]
            };

            const res = await axios.post(`${this.baseUrl}/api/cmu/create.json`, payload, { headers: this._headers() });
            const packages = res.data?.packages?.[0];
            return {
                awbNumber: packages?.waybill || null,
                trackingId: packages?.client_order_id || String(order.id),
                status: 'pending'
            };
        } catch (error) {
            console.error('[DelhiveryAdapter] createShipment failed:', error.message);
            throw new Error(`Delhivery: ${error.message}`);
        }
    }

    async trackShipment(awbNumber) {
        try {
            const res = await axios.get(`${this.baseUrl}/api/v1/packages/json/`, {
                headers: this._headers(),
                params: { waybill: awbNumber }
            });
            const pkg = res.data?.ShipmentData?.[0]?.Shipment;
            if (!pkg) return { status: 'unknown', location: 'Unknown', history: [] };

            let status = 'pending';
            const state = String(pkg.Status?.Status).toLowerCase();
            if (state.includes('transit')) status = 'in_transit';
            if (state.includes('delivery')) status = 'out_for_delivery';
            if (state.includes('delivered')) status = 'delivered';

            return {
                status,
                location: pkg.Status?.StatusLocation || 'Hub',
                estimatedDelivery: pkg.ExpectedDeliveryDate ? new Date(pkg.ExpectedDeliveryDate) : null,
                history: pkg.Scans || []
            };
        } catch (error) {
            console.error('[DelhiveryAdapter] trackShipment failed:', error.message);
            throw error;
        }
    }

    parseWebhookEvent(payload) {
        if (!payload.waybill) return null;
        return {
            awbNumber: payload.waybill,
            status: String(payload.status).toLowerCase(),
            location: payload.location || '',
            statusHistory: payload.scans || []
        };
    }
}

module.exports = DelhiveryAdapter;
