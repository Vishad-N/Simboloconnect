/**
 * PHASE 1 + 2: WebhookReplyWorker
 * Sends bot auto-replies asynchronously after the webhook is processed.
 * Uses MetaApiService for all sends (retry + backoff + rate limit).
 */

const { Worker } = require('bullmq');
const prisma = require('../prismaClient');
const { decrypt } = require('../utils/encryption');
const { validateBalance, deductCredits } = require('../middleware/walletEngine');
const MetaApiService = require('./MetaApiService');
const redis = require('./redisConnection');

function startWebhookReplyWorker(io) {
    const worker = new Worker('webhook.reply', async (job) => {
        const { userId, phoneNumberId, from, replyText, replyTemplate, replyMediaUrl } = job.data;

        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user || !user.metaToken) {
            console.warn(`[ReplyWorker] No user/token for userId=${userId}`);
            return;
        }

        const token = decrypt(user.metaToken);
        const rateCategory = replyTemplate ? 'MARKETING' : 'SERVICE';

        try {
            await validateBalance(userId, rateCategory, 1);
        } catch (e) {
            console.warn(`[ReplyWorker] Insufficient balance for ${userId}: ${e.message}`);
            return; // Don't fail the job — user has no credits
        }

        let payload = {};
        let dbContent = {};

        if (replyTemplate) {
            payload = {
                messaging_product: 'whatsapp',
                recipient_type: 'individual',
                to: from,
                type: 'template',
                template: { name: replyTemplate.templateName, language: { code: replyTemplate.templateLanguage } },
            };
            dbContent = { text: `[Sent Template: ${replyTemplate.templateName}]` };
        } else if (replyMediaUrl) {
            const isVideo = replyMediaUrl.toLowerCase().endsWith('.mp4');
            const isDoc = replyMediaUrl.toLowerCase().endsWith('.pdf') || replyMediaUrl.toLowerCase().endsWith('.doc');
            const mediaType = isVideo ? 'video' : (isDoc ? 'document' : 'image');
            payload = {
                messaging_product: 'whatsapp',
                recipient_type: 'individual',
                to: from,
                type: mediaType,
                [mediaType]: { link: replyMediaUrl, ...(replyText ? { caption: replyText } : {}) },
            };
            dbContent = { type: mediaType, mediaUrl: replyMediaUrl, caption: replyText || '' };
        } else {
            payload = {
                messaging_product: 'whatsapp',
                recipient_type: 'individual',
                to: from,
                type: 'text',
                text: { body: replyText },
            };
            dbContent = { text: replyText };
        }

        // PHASE 2: Use MetaApiService with retry + backoff
        const result = await MetaApiService.sendMessage({
            phoneNumberId,
            token,
            payload,
            context: { userId, type: 'bot-reply', recipient: from },
        });

        await deductCredits(userId, rateCategory, 1, `Bot auto-reply to ${from}`);

        const botLog = await prisma.messageLog.create({
            data: {
                userId,
                messageId: result.messageId,
                recipient: from,
                direction: 'OUTBOUND',
                status: 'SENT',
                content: dbContent,
            },
        });

        if (io) io.to(`user_${userId}`).emit('new_message', botLog);

    }, {
        connection: redis,
        concurrency: 3,
    });

    worker.on('failed', (job, err) => console.error(`[ReplyWorker] Job ${job?.id} failed:`, err.message));
    worker.on('error', (err) => console.error('[ReplyWorker] Error:', err.message));

    console.log('[ReplyWorker] Started — processing webhook.reply queue');
    return worker;
}

module.exports = { startWebhookReplyWorker };
