const { Worker } = require('bullmq');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const redisConnection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined
};

class VoiceAnalyticsWorker {
  constructor() {
    this.worker = new Worker('voice-analytics', async job => {
      console.log(`[VoiceAnalyticsWorker] Processing job ${job.id}`);
      const { action } = job.data;
      
      try {
        if (action === 'RESET_QUOTAS') {
          // Reset daily/monthly limits if threshold is hit
          const now = new Date();
          await prisma.voiceUsage.updateMany({
            data: {
              dailyMinutes: 0,
              concurrentCalls: 0,
              lastResetAt: now
            }
          });
          console.log('[VoiceAnalyticsWorker] Successfully reset daily voice usage minutes.');
        }
        return { success: true };
      } catch (error) {
        console.error(`[VoiceAnalyticsWorker] Job ${job.id} failed:`, error.message);
        throw error;
      }
    }, { connection: redisConnection, concurrency: 2 });
  }
}

module.exports = new VoiceAnalyticsWorker();
