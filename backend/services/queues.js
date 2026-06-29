/**
 * PHASE 1: Webhook Queue
 * Inbound webhook payloads are pushed here instantly and processed async.
 * Queue priorities: chat.send=10, webhook.reply=7, campaign.send=5
 */
const { Queue } = require('bullmq');
const redis = require('./redisConnection');

// Inbound webhook events from Meta (messages, statuses, template updates)
const webhookQueue = new Queue('webhook.inbound', {
    connection: redis,
    defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: { count: 500 },
        removeOnFail: { count: 200 },
    },
});

// Outbound message queues — separate by priority
const chatSendQueue = new Queue('chat.send', {
    connection: redis,
    defaultJobOptions: {
        priority: 1,           // Highest — manual agent replies
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: { count: 500 },
        removeOnFail: { count: 200 },
    },
});

const webhookReplyQueue = new Queue('webhook.reply', {
    connection: redis,
    defaultJobOptions: {
        priority: 3,           // High — bot auto-replies
        attempts: 3,
        backoff: { type: 'exponential', delay: 1500 },
        removeOnComplete: { count: 500 },
        removeOnFail: { count: 200 },
    },
});

// campaign.send queue stays in CampaignQueue.js (already working)
// We only re-export it here for reference

module.exports = { webhookQueue, chatSendQueue, webhookReplyQueue };
