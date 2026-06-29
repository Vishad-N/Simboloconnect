/**
 * routes/webhooks.js — PHASE 1 UPGRADED
 *
 * This route now ONLY:
 *  1. Verifies Meta webhook subscription (GET)
 *  2. Returns HTTP 200 immediately on POST (prevents Meta retries)
 *  3. Logs raw payload to WebhookLog
 *  4. Enqueues payload to webhook.inbound BullMQ queue
 *
 * ALL processing logic has moved to services/WebhookWorker.js
 * This eliminates the 5-second timeout risk and duplicate message problem.
 *
 * ROLLBACK: To revert to sync processing, remove the webhookQueue.add call
 *           and restore the original processing code from git.
 */

const express = require('express');
const router = express.Router();
const prisma = require('../prismaClient');
const { getMetaConfig } = require('../utils/metaConfig');
const { webhookQueue } = require('../services/queues');

// ── 1. Webhook Verification ───────────────────────────────────────────────
router.get('/', async (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    const { verifyToken } = await getMetaConfig();

    console.log(`[Webhook Verify] Mode: ${mode}, Token: ${token}`);

    if (mode && token) {
        if (mode === 'subscribe' && verifyToken && token === verifyToken) {
            console.log('WEBHOOK_VERIFIED');
            res.status(200).send(challenge);
        } else {
            console.error(`[Webhook Verify] Failed: token '${token}' not allowed`);
            res.sendStatus(403);
        }
    } else {
        res.sendStatus(400);
    }
});

// ── 2. Receive Webhook Events — Async (PHASE 1) ───────────────────────────
router.post('/', async (req, res) => {
    const body = req.body;

    // CRITICAL: Respond to Meta IMMEDIATELY — must be within 5 seconds
    // Processing happens async in WebhookWorker.js
    res.sendStatus(200);

    // Log raw payload (fast DB write)
    try {
        const logEntry = await prisma.webhookLog.create({
            data: { payload: body, source: 'META' },
        });
        console.log(`[Webhook] Logged. ID: ${logEntry.id}`);
    } catch (err) {
        console.error('[Webhook] Failed to log:', err.message);
    }

    // Enqueue for async processing
    if (!body.object) return;

    try {
        const msgId = body.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.id;
        const statusId = body.entry?.[0]?.changes?.[0]?.value?.statuses?.[0]?.id;
        const field = body.entry?.[0]?.changes?.[0]?.field;
        const templateName = body.entry?.[0]?.changes?.[0]?.value?.message_template_name;

        // Build idempotency job ID to prevent duplicate processing on Meta retries
        // BullMQ does not allow ':' in jobIds, so we use '_'
        let jobId;
        if (msgId) {
            jobId = `msg_${msgId}`;
        } else if (statusId) {
            // Status updates: include new status in key (SENT→DELIVERED→READ are different events)
            const newStatus = body.entry?.[0]?.changes?.[0]?.value?.statuses?.[0]?.status;
            jobId = `status_${statusId}_${newStatus}`;
        } else if (field === 'message_template_status_update' && templateName) {
            jobId = `tmpl_${body.entry?.[0]?.id}_${templateName}_${Date.now()}`;
        }

        await webhookQueue.add('process', body, {
            ...(jobId ? { jobId } : {}),
        });
        console.log(`[Webhook] Enqueued${jobId ? ` (jobId: ${jobId})` : ''}`);
    } catch (err) {
        console.error('[Webhook] Failed to enqueue:', err.message);
    }
});

module.exports = router;
