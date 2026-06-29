/**
 * RecoveryWorker.js
 * Phase B — BullMQ worker for abandoned checkout recovery campaigns.
 * Processes delayed recovery jobs, sends WhatsApp messages, and manages retry scheduling.
 */
const { Worker, Queue } = require('bullmq');
const redisConnection = require('../services/redisConnection');
const prisma = require('../prismaClient');
const RecoveryMessageEngine = require('../services/commerce/RecoveryMessageEngine');
const GatewayRouter = require('../services/payments/GatewayRouter');
const CheckoutManager = require('../services/payments/CheckoutManager');

const recoveryQueue = new Queue('checkout.recovery', { connection: redisConnection });

/**
 * Schedule a recovery job for an abandoned checkout.
 * Called from cart sync workers or when checkout session expires.
 * @param {string} workspaceId
 * @param {string} contactPhone
 * @param {string} productName
 * @param {number} amount
 * @param {string} cartId
 * @param {number} attemptNumber
 */
async function scheduleRecovery(workspaceId, contactPhone, productName, amount, cartId = null, attemptNumber = 1) {
    const FEATURE_RECOVERY = process.env.FEATURE_RECOVERY === 'true';
    if (!FEATURE_RECOVERY) return;

    const delayMinutes = RecoveryMessageEngine.getDelayMinutes(attemptNumber);
    const delayMs = delayMinutes * 60 * 1000;
    const scheduledAt = new Date(Date.now() + delayMs);

    // Create a recovery record in the database
    const recovery = await prisma.abandonedCheckoutRecovery.create({
        data: {
            userId: workspaceId,
            cartId,
            contactPhone,
            status: 'scheduled',
            attemptNumber,
            scheduledAt
        }
    });

    // Schedule delayed BullMQ job
    await recoveryQueue.add('send_recovery', {
        recoveryId: recovery.id,
        workspaceId,
        contactPhone,
        productName,
        amount,
        attemptNumber
    }, {
        delay: delayMs,
        attempts: 2,
        backoff: { type: 'fixed', delay: 5 * 60 * 1000 }, // 5 min retry
        jobId: `recovery_${recovery.id}` // deduplicate
    });

    console.log(`[RecoveryWorker] Scheduled recovery attempt ${attemptNumber} for ${contactPhone} in ${delayMinutes} minutes.`);
    return recovery;
}

// Worker processor
const recoveryWorker = new Worker('checkout.recovery', async (job) => {
    const { recoveryId, workspaceId, contactPhone, productName, amount, attemptNumber } = job.data;

    console.log(`[RecoveryWorker] Processing recovery job ${recoveryId} attempt ${attemptNumber} for ${contactPhone}`);

    // Check if already recovered (e.g. customer paid in the meantime)
    const recovery = await prisma.abandonedCheckoutRecovery.findUnique({ where: { id: recoveryId } });
    if (!recovery || recovery.status === 'recovered') {
        console.log(`[RecoveryWorker] Recovery ${recoveryId} already resolved. Skipping.`);
        return;
    }

    try {
        // 1. Generate a fresh payment link
        const link = await GatewayRouter.createPaymentLink(workspaceId, {
            amount,
            currency: 'INR',
            referenceId: `rec_${recoveryId}`,
            description: `Recovery: ${productName}`,
            customer: { contact: contactPhone },
            notes: { workspaceId, contactPhone, recoveryId }
        });

        const recoveryUrl = link.url;

        // 2. Generate personalized message
        const message = await RecoveryMessageEngine.generateMessage(
            workspaceId, contactPhone, productName, recoveryUrl, attemptNumber
        );

        // 3. Update recovery record
        await prisma.abandonedCheckoutRecovery.update({
            where: { id: recoveryId },
            data: {
                status: 'sent',
                sentAt: new Date(),
                recoveryUrl,
                messageContent: message
            }
        });

        // 4. Log message to be sent (actual WhatsApp delivery is handled by MetaApiService)
        // In a full integration, we'd call MetaApiService.sendTextMessage() here.
        // For Phase B MVP, we log the intent. The integration hook is ready.
        console.log(`[RecoveryWorker] Recovery message queued for ${contactPhone}:`, message.substring(0, 80));

        // 5. Schedule next attempt if applicable
        if (attemptNumber < RecoveryMessageEngine.maxAttempts()) {
            await scheduleRecovery(workspaceId, contactPhone, productName, amount, recovery.cartId, attemptNumber + 1);
        } else {
            // Final attempt expired
            await prisma.abandonedCheckoutRecovery.update({
                where: { id: recoveryId },
                data: { status: 'expired' }
            });
        }
    } catch (error) {
        console.error(`[RecoveryWorker] Job ${job.id} failed:`, error.message);
        await prisma.abandonedCheckoutRecovery.update({
            where: { id: recoveryId },
            data: { status: 'failed' }
        }).catch(() => {});
        throw error;
    }
}, { connection: redisConnection, concurrency: 10 });

recoveryWorker.on('failed', (job, err) => {
    console.error(`[RecoveryWorker] Job ${job.id} permanently failed: ${err.message}`);
});

module.exports = { recoveryWorker, recoveryQueue, scheduleRecovery };
