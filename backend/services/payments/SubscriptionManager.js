/**
 * SubscriptionManager.js
 * Phase B — Enterprise Subscription and Recurring Billing Manager.
 * Orchestrates subscription cycles, invoice lifecycle, upgrades, downgrades, and dunning attempts.
 */
const prisma = require('../../prismaClient');
const { GatewayFactory } = require('./GatewayFactory');
const { logAudit } = require('../../middleware/auditTrail');

class SubscriptionManager {
    /**
     * Create a Subscription Plan inside DB and sync to the gateway
     */
    static async createPlan(workspaceId, params) {
        const { name, description, amount, currency, interval, intervalCount, gatewayId } = params;

        // Fetch the gateway
        const gatewayRecord = await prisma.paymentGateway.findFirst({
            where: { id: gatewayId, userId: workspaceId, isActive: true }
        });

        if (!gatewayRecord) {
            throw new Error('Payment gateway not found or inactive.');
        }

        const adapter = GatewayFactory.fromGatewayRecord(gatewayRecord);
        const { externalPlanId } = await adapter.createSubscriptionPlan({
            name,
            description,
            amount: Number(amount),
            currency,
            interval,
            intervalCount
        });

        const plan = await prisma.subscriptionPlan.create({
            data: {
                userId: workspaceId,
                name,
                description,
                amount: Number(amount),
                currency,
                interval,
                intervalCount,
                isActive: true,
                metadata: { gatewayId, externalPlanId, provider: gatewayRecord.provider }
            }
        });

        await logAudit({
            userId: workspaceId,
            actor: 'system',
            action: 'subscription_plan_created',
            entityType: 'SubscriptionPlan',
            entityId: plan.id,
            after: plan
        });

        return plan;
    }

    /**
     * Initialize a new subscription checkout flow
     */
    static async createSubscription(workspaceId, planId, customerData) {
        const { phone, email, name } = customerData;

        const plan = await prisma.subscriptionPlan.findFirst({
            where: { id: planId, userId: workspaceId, isActive: true }
        });

        if (!plan) {
            throw new Error('Active subscription plan not found.');
        }

        const planMeta = plan.metadata || {};
        const gatewayId = planMeta.gatewayId;

        const gatewayRecord = await prisma.paymentGateway.findFirst({
            where: { id: gatewayId, userId: workspaceId }
        });

        if (!gatewayRecord) {
            throw new Error('Gateway associated with this plan is missing.');
        }

        const adapter = GatewayFactory.fromGatewayRecord(gatewayRecord);
        const { externalSubId, status, url } = await adapter.createSubscription({
            externalPlanId: planMeta.externalPlanId,
            customerPhone: phone,
            customerEmail: email,
            customerName: name,
            metadata: { workspaceId, planId }
        });

        const subscription = await prisma.subscription.create({
            data: {
                userId: workspaceId,
                planId,
                customerPhone: phone,
                customerEmail: email,
                customerName: name,
                externalSubId,
                provider: gatewayRecord.provider,
                status: 'pending', // Wait for payment confirmation
                metadata: { checkoutUrl: url }
            }
        });

        await logAudit({
            userId: workspaceId,
            actor: phone,
            action: 'subscription_initiated',
            entityType: 'Subscription',
            entityId: subscription.id,
            after: subscription
        });

        return { subscription, checkoutUrl: url };
    }

    /**
     * Pause / Resume an active subscription
     */
    static async updateStatus(workspaceId, subId, newStatus) {
        if (!['active', 'paused', 'cancelled'].includes(newStatus)) {
            throw new Error('Invalid status transition.');
        }

        const sub = await prisma.subscription.findFirst({
            where: { id: subId, userId: workspaceId }
        });

        if (!sub) throw new Error('Subscription not found.');

        const before = { ...sub };

        // Gateway Sync
        if (newStatus === 'cancelled' && sub.externalSubId) {
            const gateway = await prisma.paymentGateway.findFirst({
                where: { userId: workspaceId, provider: sub.provider, isActive: true }
            });
            if (gateway) {
                const adapter = GatewayFactory.fromGatewayRecord(gateway);
                await adapter.cancelSubscription(sub.externalSubId).catch(() => {});
            }
        }

        const updated = await prisma.subscription.update({
            where: { id: subId },
            data: {
                status: newStatus,
                cancelledAt: newStatus === 'cancelled' ? new Date() : null
            }
        });

        await logAudit({
            userId: workspaceId,
            actor: 'api',
            action: `subscription_${newStatus}`,
            entityType: 'Subscription',
            entityId: subId,
            before,
            after: updated
        });

        return updated;
    }

    /**
     * Process subscription renewal and invoicing
     */
    static async recordPayment(externalSubId, externalInvoiceId, amount, status = 'paid') {
        const sub = await prisma.subscription.findFirst({
            where: { externalSubId }
        });

        if (!sub) {
            console.warn(`[SubscriptionManager] Sub not found for externalSubId: ${externalSubId}`);
            return;
        }

        // Calculate next period
        const now = new Date();
        let nextPeriodEnd = new Date(now);
        nextPeriodEnd.setMonth(now.getMonth() + 1); // default 1 month

        await prisma.$transaction(async (tx) => {
            // Update sub state
            await tx.subscription.update({
                where: { id: sub.id },
                data: {
                    status: 'active',
                    currentPeriodStart: now,
                    currentPeriodEnd: nextPeriodEnd,
                    dunningAttempts: 0,
                    nextRetryAt: null
                }
            });

            // Log invoice
            await tx.subscriptionInvoice.upsert({
                where: { externalInvoiceId },
                update: { status, paidAt: status === 'paid' ? now : null },
                create: {
                    subscriptionId: sub.id,
                    userId: sub.userId,
                    externalInvoiceId,
                    amount,
                    status,
                    billingReason: 'subscription_cycle',
                    dueDate: now,
                    paidAt: status === 'paid' ? now : null
                }
            });
        });

        await logAudit({
            userId: sub.userId,
            actor: 'webhook',
            action: 'subscription_renewal_paid',
            entityType: 'Subscription',
            entityId: sub.id,
            metadata: { invoiceId: externalInvoiceId, amount }
        });
    }

    /**
     * Handle failed payment recurring attempts (Dunning Flow trigger)
     */
    static async recordFailure(externalSubId, externalInvoiceId, amount) {
        const sub = await prisma.subscription.findFirst({
            where: { externalSubId }
        });

        if (!sub) return;

        // Transition to past_due
        const updated = await prisma.subscription.update({
            where: { id: sub.id },
            data: {
                status: 'past_due',
                dunningAttempts: { increment: 1 }
            }
        });

        // Upsert dynamic unpaid invoice
        await prisma.subscriptionInvoice.upsert({
            where: { externalInvoiceId },
            update: { status: 'open' },
            create: {
                subscriptionId: sub.id,
                userId: sub.userId,
                externalInvoiceId,
                amount,
                status: 'open',
                billingReason: 'dunning_retry',
                dueDate: new Date()
            }
        });

        await logAudit({
            userId: sub.userId,
            actor: 'webhook',
            action: 'subscription_payment_failed',
            entityType: 'Subscription',
            entityId: sub.id,
            metadata: { invoiceId: externalInvoiceId, attempts: updated.dunningAttempts }
        });

        // Enqueue into Dunning Queue
        const { dunningQueue } = require('../../workers/DunningWorker');
        if (dunningQueue) {
            await dunningQueue.add('dunning_attempt', {
                subscriptionId: sub.id,
                invoiceId: externalInvoiceId,
                attemptNumber: updated.dunningAttempts
            });
        }
    }
}

module.exports = SubscriptionManager;
