/**
 * UPIQRAdapter.js
 * Phase B — UPI QR Code abstraction implementing BasePaymentGateway.
 * Generates UPI deep links and QR codes using the standard UPI URI scheme.
 * No payment gateway SDK needed — uses standard UPI protocol.
 */
const crypto = require('crypto');
const BasePaymentGateway = require('../BasePaymentGateway');

class UPIQRAdapter extends BasePaymentGateway {
    constructor(config) {
        super(config);
        this.providerName = 'upi';
        this.vpa = config.vpa;        // e.g. "merchant@upi" or "merchant@paytm"
        this.merchantName = config.merchantName || 'Merchant';
    }

    async createPaymentLink(params) {
        // UPI URI standard: upi://pay?pa=VPA&pn=NAME&am=AMOUNT&tn=DESCRIPTION&tr=REF
        const transactionRef = params.referenceId?.substring(0, 35) || `TXN${Date.now()}`;
        const upiUri = [
            `upi://pay`,
            `?pa=${encodeURIComponent(this.vpa)}`,
            `&pn=${encodeURIComponent(this.merchantName)}`,
            `&am=${params.amount}`,
            `&cu=${params.currency || 'INR'}`,
            `&tn=${encodeURIComponent(params.description || 'Payment')}`,
            `&tr=${encodeURIComponent(transactionRef)}`
        ].join('');

        // QR code image URL using Google Charts API (no API key needed, free)
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(upiUri)}`;

        return {
            id: `upi_${transactionRef}`,
            url: upiUri,     // Direct deep link for mobile
            qrUrl,           // QR code image URL for WhatsApp image message
            status: 'created'
        };
    }

    verifyWebhookSignature(rawBody, signature, secret) {
        // UPI QR is typically verified via polling or callback; basic HMAC check
        if (!rawBody || !signature || !secret) return false;
        try {
            const body = typeof rawBody === 'string' ? rawBody : JSON.stringify(rawBody);
            const expected = crypto.createHmac('sha256', secret).update(body).digest('hex');
            return expected === signature;
        } catch { return false; }
    }

    parseWebhookEvent(payload) {
        // UPI callbacks vary by payment processor; normalize common patterns
        const status = payload.status || payload.txnStatus;
        if (status === 'SUCCESS' || status === 'COMPLETED') {
            return {
                event: 'payment.link.paid',
                linkId: payload.txnRef || payload.referenceId,
                status: 'paid',
                metadata: payload
            };
        }
        return null;
    }

    async getPaymentStatus(linkId) {
        // UPI QR status is typically polled via the underlying processor
        // Return unknown since UPI QR doesn't have a universal status API
        return { status: 'unknown', paidAt: null };
    }
}

module.exports = UPIQRAdapter;
