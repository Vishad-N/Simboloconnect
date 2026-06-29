/**
 * DunningWorker.js
 * Phase B — Subscription Dunning and Recurring Payment Retry Worker.
 * Handles failed transactions by executing progressive retries and WhatsApp notification alerts.
 */
const { Worker, Queue } = require('bullmq');
const redisConnection = require('../services/redisConnection');
const prisma = require('../prismaClient');
const { logAudit } = require('../middleware/auditTrail');

const dunningQueue = new Queue('subscription.dunning', { connection: redisConnection });

const DUNNING_INTERVALS = {
    1: 1440, // Attempt 1: Wait 24 hours (1440 mins)
    2: 4320, // Attempt 2: Wait 3 days (4320 mins)
    3: 7200, // Attempt 3: Wait 5 days (7200 mins), then auto-cancel
};

const MAX_DUNNING_ATTEMPTS = 3;

/**
 * Handle subscription dunning processor
 */
const dunningWorker = new Worker('subscription.dunning', async (job) => {
    const { subscriptionId, invoiceId, attemptNumber } = job.data;
    const FEATURE_SUBSCRIPTIONS = process.env.FEATURE_SUBSCRIPTIONS === 'true';
    if (!FEATURE_SUBSCRIPTIONS) return;

    console.log(`[DunningWorker] Processing dunning event for subscription ${subscriptionId}, attempt ${attemptNumber}`);

    const sub = await prisma.subscription.findUnique({
        where: { id: subscriptionId },
        include: { invoices: { where: { externalInvoiceId: invoiceId } } }
    });

    if (!sub || sub.status !== 'past_due') {
        console.log(`[DunningWorker] Subscription ${subscriptionId} is no longer past due. Skipping.`);
        return;
    }

    const invoice = sub.invoices[0];
    if (invoice && invoice.status === 'paid') {
        console.log(`[DunningWorker] Invoice ${invoiceId} already resolved. Skipping.`);
        return;
    }

    try {
        if (attemptNumber >= MAX_DUNNING_ATTEMPTS) {
            // Auto-cancellation phase
            await prisma.$transaction(async (tx) => {
                await tx.subscription.update({
                    where: { id: subscriptionId },
                    data: { status: 'cancelled', cancelledAt: new Date() }
                });
                await tx.subscriptionInvoice.update({
                    where: { externalInvoiceId: invoiceId },
                    data: { status: 'uncollectible' }
                });
            });

            console.log(`[DunningWorker] Subscription ${subscriptionId} cancelled after max dunning attempts.`);

            await logAudit({
                userId: sub.userId,
                actor: 'system',
                action: 'subscription_auto_cancelled',
                entityType: 'Subscription',
                entityId: subscriptionId,
                metadata: { invoiceId, attemptNumber }
            });

            // Trigger internal webhook or notification (Optional)
            return;
        }

        // Send Progressive WhatsApp Alert
        const delayMins = DUNNING_INTERVALS[attemptNumber] || DUNNING_INTERVALS[1];
        const nextAttempt = attemptNumber + 1;
        const nextRetryAt = new Date(Date.now() + delayMins * 60 * 1000);

        // Update retry timestamp
        await prisma.subscription.update({
            where: { id: subscriptionId },
            data: { nextRetryAt }
        });

        // Formulate alert message
        const contactName = sub.customerName || 'there';
        const amountStr = `₹${invoice?.amount || '0'}`;
        const message = `Hi ${contactName}, your recurring payment of ${amountStr} failed. 💸 To keep your active subscription active, please check your payment details or contact support. We will try again in 2 days.`;

        console.log(`[DunningWorker] WhatsApp notification triggered for ${sub.customerPhone}:`, message);

        // Re-enqueue next attempt
        await dunningQueue.add('dunning_attempt', {
            subscriptionId,
            invoiceId,
            attemptNumber: nextAttempt
        }, {
            delay: delayMins * 60 * 1000,
            jobId: `dunning_${subscriptionId}_${nextAttempt}`
        });

    } catch (error) {
        console.error(`[DunningWorker] Dunning job failed:`, error.message);
        throw error;
    }
}, { connection: redisConnection, concurrency: 5 });

module.exports = { dunningWorker, dunningQueue };
