const { Worker } = require('bullmq');
const VoiceOrchestrator = require('../services/voice/VoiceOrchestrator');

const redisConnection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined
};

class VoiceCallWorker {
  constructor() {
    this.worker = new Worker('voice-outbound-calls', async job => {
      console.log(`[VoiceCallWorker] Processing job ${job.id}`);
      const { userId, contactId, toPhone, context } = job.data;
      
      try {
        const session = await VoiceOrchestrator.initiateCall(userId, contactId, toPhone, context);
        console.log(`[VoiceCallWorker] Call initiated. Session ID: ${session.id}`);
        return session;
      } catch (error) {
        console.error(`[VoiceCallWorker] Job ${job.id} failed:`, error.message);
        throw error;
      }
    }, { connection: redisConnection, concurrency: 10 });

    this.worker.on('completed', job => {
      console.log(`[VoiceCallWorker] Job ${job.id} has completed!`);
    });

    this.worker.on('failed', (job, err) => {
      console.log(`[VoiceCallWorker] Job ${job.id} has failed with ${err.message}`);
    });
  }
}

module.exports = new VoiceCallWorker();
