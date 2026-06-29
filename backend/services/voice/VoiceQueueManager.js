const { Queue } = require('bullmq');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Connect to existing Redis
const redisConnection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined
};

class VoiceQueueManager {
  static callQueue = new Queue('voice-outbound-calls', { connection: redisConnection });

  /**
   * Enqueue a new outbound AI call request.
   * Handles concurrency checks and daily minute quotas.
   */
  static async enqueueCall(userId, contactId, toPhone, context, delayMs = 0) {
    // 1. Check Global Kill Switch
    if (process.env.DISABLE_ALL_VOICE_CALLS === 'true') {
      throw new Error('All AI Voice Calls are currently disabled globally.');
    }

    // 2. Check Quota / Abuse Protection
    let quota = await prisma.voiceQuota.findUnique({ where: { userId } });
    if (!quota) {
      quota = await prisma.voiceQuota.create({
        data: {
          userId,
          maxDailyMinutes: 60,
          maxMonthlyMinutes: 1800,
          maxConcurrent: 2,
          isHardStopActive: false
        }
      });
    }

    let usage = await prisma.voiceUsage.findUnique({ where: { userId } });
    if (!usage) {
      usage = await prisma.voiceUsage.create({
        data: {
          userId,
          dailyMinutes: 0,
          monthlyMinutes: 0,
          totalCalls: 0,
          concurrentCalls: 0
        }
      });
    }

    if (quota.isHardStopActive) {
      throw new Error('Hard stop active. Voice quota billing limits reached.');
    }
    if (delayMs === 0 && usage.concurrentCalls >= quota.maxConcurrent) {
      throw new Error(`Concurrency limit reached. Active: ${usage.concurrentCalls}/${quota.maxConcurrent}`);
    }
    if (usage.dailyMinutes >= quota.maxDailyMinutes) {
      throw new Error(`Daily minute limit reached. Used: ${usage.dailyMinutes}/${quota.maxDailyMinutes}`);
    }
    if (usage.monthlyMinutes >= quota.maxMonthlyMinutes) {
      throw new Error(`Monthly minute limit reached. Used: ${usage.monthlyMinutes}/${quota.maxMonthlyMinutes}`);
    }

    // 3. Add to BullMQ
    const job = await this.callQueue.add('initiate-call', {
      userId,
      contactId,
      toPhone,
      context
    }, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      ...(delayMs > 0 ? { delay: delayMs } : {})
    });

    console.log(`[QueueManager] Call enqueued successfully. Job ID: ${job.id}${delayMs > 0 ? ` with delay of ${delayMs}ms` : ''}`);
    return job;
  }
}

module.exports = VoiceQueueManager;
