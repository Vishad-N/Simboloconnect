/**
 * CashfreeAdapter.js
 * Phase B — Cashfree Payment Links adapter implementing BasePaymentGateway.
 * Uses Cashfree's Payment Links API (v3).
 */
const axios = require('axios');
const crypto = require('crypto');
const BasePaymentGateway = require('../BasePaymentGateway');

class CashfreeAdapter extends BasePaymentGateway {
    constructor(config) {
        super(config);
        this.providerName = 'cashfree';
        this.appId = config.appId;
        this.secretKey = config.secretKey;
        this.mode = config.mode || 'live';
        this.baseUrl = this.mode === 'test'
            ? 'https://sandbox.cashfree.com/pg'
            : 'https://api.cashfree.com/pg';
    }

    _headers() {
        return {
            'x-client-id': this.appId,
            'x-client-secret': this.secretKey,
            'x-api-version': '2023-08-01',
            'Content-Type': 'application/json'
        };
    }

    async createPaymentLink(params) {
        try {
            const linkId = `lnk_${params.referenceId.replace(/-/g, '').substring(0, 14)}`;
            const payload = {
                link_id: linkId,
                link_amount: Number(params.amount),
                link_currency: params.currency || 'INR',
                link_purpose: params.description || 'Payment',
                customer_details: {
                    customer_name: params.customer?.name || 'Customer',
                    customer_phone: params.customer?.contact || '',
                    customer_email: params.customer?.email || ''
                },
                link_meta: {
                    notify_url: process.env.CASHFREE_WEBHOOK_URL || '',
                    ...(params.notes || {})
                }
            };

            const res = await axios.post(`${this.baseUrl}/links`, payload, { headers: this._headers() });
            return {
                id: res.data.link_id,
                url: res.data.link_url,
                status: res.data.link_status
            };
        } catch (error) {
            console.error('[CashfreeAdapter] createPaymentLink error:', error.response?.data || error.message);
            throw new Error(`Cashfree: ${error.response?.data?.message || error.message}`);
        }
    }

    verifyWebhookSignature(rawBody, signature, secret) {
        if (!rawBody || !signature || !secret) return false;
        try {
            const data = typeof rawBody === 'string' ? rawBody : JSON.stringify(rawBody);
            const computed = crypto.createHmac('sha256', secret).update(data).digest('base64');
            return computed === signature;
        } catch { return false; }
    }

    parseWebhookEvent(payload) {
        if (payload.type === 'PAYMENT_LINK_EVENT' && payload.data?.payment?.payment_status === 'SUCCESS') {
            return {
                event: 'payment.link.paid',
                linkId: payload.data?.link?.link_id,
                status: 'paid',
                metadata: {}
            };
        }
        return null;
    }

    async getPaymentStatus(linkId) {
        try {
            const res = await axios.get(`${this.baseUrl}/links/${linkId}`, { headers: this._headers() });
            const isPaid = res.data.link_status === 'PAID';
            return { status: isPaid ? 'paid' : 'pending', paidAt: null };
        } catch (error) {
            console.error('[CashfreeAdapter] getPaymentStatus error:', error.message);
            throw error;
        }
    }
}

module.exports = CashfreeAdapter;
