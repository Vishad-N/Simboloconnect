/**
 * ShiprocketAdapter.js
 * Concrete adapter for Shiprocket fulfillment API implementing BaseDeliveryProvider.
 */
const axios = require('axios');
const BaseDeliveryProvider = require('../BaseDeliveryProvider');

class ShiprocketAdapter extends BaseDeliveryProvider {
    constructor(config) {
        super(config);
        this.providerName = 'shiprocket';
        this.email = config.email;
        this.password = config.password;
        this.token = null;
        this.tokenExpiry = null;
        this.baseUrl = 'https://apiv2.shiprocket.in/v1/external';
    }

    async _authenticate() {
        if (this.token && this.tokenExpiry > Date.now()) return this.token;

        try {
            const res = await axios.post(`${this.baseUrl}/auth/login`, {
                email: this.email,
                password: this.password
            });
            this.token = res.data.token;
            this.tokenExpiry = Date.now() + 9 * 24 * 60 * 60 * 1000; // token lasts 10 days
            return this.token;
        } catch (error) {
            console.error('[ShiprocketAdapter] Authentication failed:', error.message);
            throw new Error('Shiprocket authentication failed');
        }
    }

    async _headers() {
        const token = await this._authenticate();
        return {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        };
    }

    async createShipment(order, details) {
        try {
            const headers = await this._headers();
            const items = Array.isArray(order.lineItems) ? order.lineItems : [];

            const payload = {
                order_id: order.id,
                order_date: new Date(order.createdAt).toISOString().split('T')[0],
                pickup_location: this.config.pickupLocation || 'Primary',
                billing_customer_name: order.customerName || 'Customer',
                billing_last_name: '',
                billing_address: details.shippingAddress || 'India Address',
                billing_city: details.city || 'Mumbai',
                billing_pincode: details.pincode || '400001',
                billing_state: details.state || 'Maharashtra',
                billing_country: 'India',
                billing_email: order.customerEmail || 'billing@example.com',
                billing_phone: order.customerPhone || '9999999999',
                shipping_is_billing: true,
                order_items: items.map(i => ({
                    name: i.name || i.title || 'Product',
                    sku: i.sku || 'SKU-001',
                    units: Number(i.quantity || 1),
                    selling_price: String(i.price || 0)
                })),
                payment_method: order.paymentStatus === 'paid' ? 'Prepaid' : 'COD',
                sub_total: Number(order.totalAmount || 0),
                length: Number(details.length || 10),
                width: Number(details.width || 10),
                height: Number(details.height || 10),
                weight: Number(details.weight || 0.5)
            };

            const res = await axios.post(`${this.baseUrl}/shipments/create/forward-shipment`, payload, { headers });
            return {
                awbNumber: res.data.awb_code || null,
                trackingId: String(res.data.shipment_id || ''),
                status: 'pending'
            };
        } catch (error) {
            console.error('[ShiprocketAdapter] createShipment failed:', error.response?.data || error.message);
            throw new Error(`Shiprocket createShipment: ${error.message}`);
        }
    }

    async trackShipment(awbNumber) {
        try {
            const headers = await this._headers();
            const res = await axios.get(`${this.baseUrl}/courier/track/awb/${awbNumber}`, { headers });
            const data = res.data?.tracking_data;
            
            if (!data) return { status: 'unknown', location: 'Unknown', history: [] };

            let status = 'pending';
            const trackingState = String(data.shipment_status).toLowerCase();
            if (trackingState === 'in_transit') status = 'in_transit';
            if (trackingState === 'out_for_delivery') status = 'out_for_delivery';
            if (trackingState === 'delivered') status = 'delivered';
            if (trackingState === 'cancelled') status = 'failed';

            return {
                status,
                location: data.location || 'Hub',
                estimatedDelivery: data.edd ? new Date(data.edd) : null,
                history: data.scans || []
            };
        } catch (error) {
            console.error('[ShiprocketAdapter] trackShipment failed:', error.message);
            throw error;
        }
    }

    parseWebhookEvent(payload) {
        if (!payload.awb) return null;
        return {
            awbNumber: payload.awb,
            status: String(payload.current_status).toLowerCase(),
            location: payload.location || '',
            statusHistory: payload.scans || []
        };
    }
}

module.exports = ShiprocketAdapter;
