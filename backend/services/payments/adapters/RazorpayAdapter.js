/**
 * RazorpayAdapter.js
 * Phase B refactoring of RazorpayService to implement the BasePaymentGateway interface.
 */
const Razorpay = require('razorpay');
const crypto = require('crypto');
const BasePaymentGateway = require('../BasePaymentGateway');

class RazorpayAdapter extends BasePaymentGateway {
    constructor(config) {
        super(config);
        this.providerName = 'razorpay';
        this.instance = new Razorpay({
            key_id: config.keyId,
            key_secret: config.keySecret
        });
    }

    async createPaymentLink(params) {
        try {
            const payload = {
                amount: Math.round(params.amount * 100),
                currency: params.currency || 'INR',
                accept_partial: false,
                reference_id: params.referenceId,
                description: params.description,
                customer: {
                    name: params.customer?.name || 'Customer',
                    contact: params.customer?.contact,
                    email: params.customer?.email
                },
                notify: { sms: false, email: false },
                reminder_enable: false,
                notes: params.notes || {}
            };

            const link = await this.instance.paymentLink.create(payload);
            return { id: link.id, url: link.short_url, status: link.status };
        } catch (error) {
            console.error('[RazorpayAdapter] createPaymentLink error:', error?.error || error.message);
            throw new Error(error?.error?.description || 'Razorpay: Failed to create payment link');
        }
    }

    verifyWebhookSignature(rawBody, signature, secret) {
        if (!rawBody || !signature || !secret) return false;
        try {
            const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
            return expected === signature;
        } catch { return false; }
    }

    parseWebhookEvent(payload) {
        if (payload.event === 'payment.link.paid') {
            const entity = payload.payload?.payment_link?.entity;
            if (!entity) return null;
            return {
                event: 'payment.link.paid',
                linkId: entity.id,
                status: 'paid',
                metadata: entity.notes || {}
            };
        }
        return null;
    }

    async getPaymentStatus(linkId) {
        try {
            const link = await this.instance.paymentLink.fetch(linkId);
            return {
                status: link.status === 'paid' ? 'paid' : 'pending',
                paidAt: link.payments?.[0]?.created_at ? new Date(link.payments[0].created_at * 1000) : null
            };
        } catch (error) {
            console.error('[RazorpayAdapter] getPaymentStatus error:', error.message);
            throw error;
        }
    }

    async createSubscriptionPlan(params) {
        try {
            // Map common intervals to Razorpay expected format
            // Razorpay periods: daily, weekly, monthly, yearly
            let period = 'monthly';
            if (params.interval === 'yearly') period = 'yearly';
            if (params.interval === 'weekly') period = 'weekly';

            const plan = await this.instance.plans.create({
                period: period,
                interval: params.intervalCount || 1,
                item: {
                    name: params.name,
                    amount: Math.round(params.amount * 100), // convert to paise
                    currency: params.currency || 'INR',
                    description: params.description || ''
                }
            });
            return { externalPlanId: plan.id };
        } catch (error) {
            console.error('[RazorpayAdapter] createSubscriptionPlan error:', error);
            throw new Error(error?.error?.description || 'Razorpay: Failed to create plan');
        }
    }

    async createSubscription(params) {
        try {
            const sub = await this.instance.subscriptions.create({
                plan_id: params.externalPlanId,
                total_count: params.totalCount || 12, // default 1 year recurring
                quantity: 1,
                customer_notify: 1,
                addons: [],
                notes: params.metadata || {}
            });
            return {
                externalSubId: sub.id,
                status: sub.status,
                url: sub.short_url || ''
            };
        } catch (error) {
            console.error('[RazorpayAdapter] createSubscription error:', error);
            throw new Error(error?.error?.description || 'Razorpay: Failed to create subscription');
        }
    }

    async cancelSubscription(externalSubId) {
        try {
            const sub = await this.instance.subscriptions.cancel(externalSubId, {
                cancel_at_cycle_end: false // cancel immediately
            });
            return { status: sub.status };
        } catch (error) {
            console.error('[RazorpayAdapter] cancelSubscription error:', error);
            throw new Error(error?.error?.description || 'Razorpay: Failed to cancel subscription');
        }
    }
}

module.exports = RazorpayAdapter;
