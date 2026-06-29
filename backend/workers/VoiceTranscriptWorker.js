const { Worker } = require('bullmq');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const VoiceTranscriptManager = require('../services/voice/VoiceTranscriptManager');

const redisConnection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined
};

class VoiceTranscriptWorker {
  constructor() {
    this.worker = new Worker('voice-transcripts', async job => {
      console.log(`[VoiceTranscriptWorker] Processing job ${job.id}`);
      const { sessionId, rawTranscript } = job.data;
      
      try {
        // rawTranscript is expected to be an array of { speaker, message }
        if (Array.isArray(rawTranscript)) {
          for (const line of rawTranscript) {
            await VoiceTranscriptManager.addTranscriptLine(sessionId, line.speaker, line.message);
          }
        }

        // Run full summarization, scoring, and billing usage update
        await VoiceTranscriptManager.processAndSummarizeSession(sessionId);

        console.log(`[VoiceTranscriptWorker] Processed transcript for Session ID: ${sessionId}`);
        return { success: true };
      } catch (error) {
        console.error(`[VoiceTranscriptWorker] Job ${job.id} failed:`, error.message);
        throw error;
      }
    }, { connection: redisConnection, concurrency: 5 });
  }
}

module.exports = new VoiceTranscriptWorker();
