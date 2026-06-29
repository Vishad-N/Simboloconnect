const Razorpay = require('razorpay');
const crypto = require('crypto');

class RazorpayService {
    /**
     * Initializes a Razorpay instance
     * @param {string} keyId - Decrypted Razorpay Key ID
     * @param {string} keySecret - Decrypted Razorpay Key Secret
     */
    constructor(keyId, keySecret) {
        this.instance = new Razorpay({
            key_id: keyId,
            key_secret: keySecret
        });
    }

    /**
     * Creates a Razorpay Payment Link
     * @param {Object} params
     * @param {number} params.amount - Amount in whole rupees (will be converted to paise)
     * @param {string} params.currency - Defaults to INR
     * @param {string} params.referenceId - Your internal CheckoutSession ID
     * @param {string} params.description - Product/Payment description
     * @param {Object} params.customer - { name, contact, email }
     * @param {Object} params.notes - Metadata to attach (e.g. workspaceId)
     */
    async createPaymentLink(params) {
        try {
            const payload = {
                amount: Math.round(params.amount * 100), // Convert to paise
                currency: params.currency || "INR",
                accept_partial: false,
                reference_id: params.referenceId,
                description: params.description,
                customer: {
                    name: params.customer.name || "Customer",
                    contact: params.customer.contact, // e.g. "+919876543210"
                    email: params.customer.email
                },
                notify: {
                    sms: false,
                    email: false
                },
                reminder_enable: false,
                notes: params.notes || {}
            };

            const paymentLink = await this.instance.paymentLink.create(payload);
            return {
                id: paymentLink.id,
                url: paymentLink.short_url,
                status: paymentLink.status
            };
        } catch (error) {
            console.error("[RazorpayService] createPaymentLink Error:", error);
            throw new Error(error?.error?.description || "Failed to create payment link");
        }
    }

    /**
     * Verifies the Razorpay Webhook Signature
     * @param {string} body - The raw request body as string
     * @param {string} signature - The x-razorpay-signature header
     * @param {string} secret - The webhook secret configured in Razorpay dashboard
     * @returns {boolean}
     */
    static verifyWebhookSignature(body, signature, secret) {
        if (!body || !signature || !secret) return false;
        try {
            const expectedSignature = crypto
                .createHmac('sha256', secret)
                .update(body)
                .digest('hex');
            return expectedSignature === signature;
        } catch (error) {
            console.error("[RazorpayService] verifyWebhookSignature Error:", error);
            return false;
        }
    }
}

module.exports = RazorpayService;
