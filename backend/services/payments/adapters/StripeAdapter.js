/**
 * StripeAdapter.js
 * Phase B — Stripe Payment Links adapter implementing BasePaymentGateway.
 * Uses Stripe Payment Links API to generate shareable checkout URLs.
 */
const crypto = require('crypto');
const BasePaymentGateway = require('../BasePaymentGateway');

class StripeAdapter extends BasePaymentGateway {
    constructor(config) {
        super(config);
        this.providerName = 'stripe';
        // Lazy-load stripe to avoid requiring it if not installed
        try {
            const Stripe = require('stripe');
            this.stripe = new Stripe(config.secretKey, { apiVersion: '2024-04-10' });
        } catch (e) {
            throw new Error('Stripe npm package not installed. Run: npm install stripe');
        }
    }

    async createPaymentLink(params) {
        try {
            // Create a price dynamically for this one-time payment
            const price = await this.stripe.prices.create({
                unit_amount: Math.round(params.amount * 100), // convert INR to paise-equivalent
                currency: (params.currency || 'INR').toLowerCase(),
                product_data: {
                    name: params.description || 'Product Payment'
                }
            });

            const paymentLink = await this.stripe.paymentLinks.create({
                line_items: [{ price: price.id, quantity: 1 }],
                metadata: {
                    referenceId: params.referenceId,
                    ...(params.notes || {})
                },
                after_completion: { type: 'redirect', redirect: { url: process.env.PAYMENT_SUCCESS_URL || 'https://example.com/success' } }
            });

            return {
                id: paymentLink.id,
                url: paymentLink.url,
                status: 'created'
            };
        } catch (error) {
            console.error('[StripeAdapter] createPaymentLink error:', error.message);
            throw new Error(`Stripe: ${error.message}`);
        }
    }

    verifyWebhookSignature(rawBody, signature, secret) {
        if (!rawBody || !signature || !secret) return false;
        try {
            // Stripe uses a different format: t=timestamp,v1=signature
            const event = this.stripe.webhooks.constructEvent(rawBody, signature, secret);
            return !!event;
        } catch {
            return false;
        }
    }

    parseWebhookEvent(payload) {
        // Stripe checkout.session.completed
        if (payload.type === 'checkout.session.completed') {
            const session = payload.data?.object;
            if (!session) return null;
            return {
                event: 'payment.link.paid',
                linkId: session.payment_link || session.id,
                status: 'paid',
                metadata: session.metadata || {}
            };
        }
        return null;
    }

    async getPaymentStatus(linkId) {
        try {
            const link = await this.stripe.paymentLinks.retrieve(linkId);
            return { status: link.active ? 'pending' : 'paid', paidAt: null };
        } catch (error) {
            console.error('[StripeAdapter] getPaymentStatus error:', error.message);
            throw error;
        }
    }

    async createSubscriptionPlan(params) {
        try {
            // Create Stripe Product first
            const product = await this.stripe.products.create({
                name: params.name,
                description: params.description || ''
            });

            // Map interval
            let stripeInterval = 'month';
            if (params.interval === 'yearly') stripeInterval = 'year';
            if (params.interval === 'weekly') stripeInterval = 'week';

            // Create Price
            const price = await this.stripe.prices.create({
                product: product.id,
                unit_amount: Math.round(params.amount * 100),
                currency: (params.currency || 'INR').toLowerCase(),
                recurring: {
                    interval: stripeInterval,
                    interval_count: params.intervalCount || 1
                }
            });

            return { externalPlanId: price.id };
        } catch (error) {
            console.error('[StripeAdapter] createSubscriptionPlan error:', error.message);
            throw new Error(`Stripe Plan: ${error.message}`);
        }
    }

    async createSubscription(params) {
        try {
            // Create Stripe Customer
            const customer = await this.stripe.customers.create({
                name: params.customerName || 'Customer',
                email: params.customerEmail || undefined,
                phone: params.customerPhone || undefined,
                metadata: params.metadata || {}
            });

            // Create Checkout Session for subscription
            const session = await this.stripe.checkout.sessions.create({
                customer: customer.id,
                payment_method_types: ['card'],
                line_items: [{
                    price: params.externalPlanId,
                    quantity: 1
                }],
                mode: 'subscription',
                success_url: process.env.PAYMENT_SUCCESS_URL || 'https://example.com/success',
                cancel_url: process.env.PAYMENT_CANCEL_URL || 'https://example.com/cancel',
                metadata: params.metadata || {}
            });

            return {
                externalSubId: session.id, // During checkout, the session acts as placeholder until subscription created
                status: 'incomplete',
                url: session.url
            };
        } catch (error) {
            console.error('[StripeAdapter] createSubscription error:', error.message);
            throw new Error(`Stripe Sub: ${error.message}`);
        }
    }

    async cancelSubscription(externalSubId) {
        try {
            // Stripe cancel sub can be directly triggered via API
            // Check if it's a subscription ID (sub_...) or a session ID (cs_...)
            if (externalSubId.startsWith('sub_')) {
                const sub = await this.stripe.subscriptions.cancel(externalSubId);
                return { status: sub.status };
            }
            return { status: 'cancelled' };
        } catch (error) {
            console.error('[StripeAdapter] cancelSubscription error:', error.message);
            throw new Error(`Stripe Cancel: ${error.message}`);
        }
    }
}

module.exports = StripeAdapter;
