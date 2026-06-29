const { Worker } = require('bullmq');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const VoiceProviderFactory = require('../services/voice/VoiceProviderFactory');
const VoiceProviderHealthMonitor = require('../services/voice/VoiceProviderHealthMonitor');

const redisConnection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined
};

class VoiceHealthWorker {
  constructor() {
    this.worker = new Worker('voice-health-checks', async job => {
      console.log(`[VoiceHealthWorker] Processing job ${job.id}`);
      
      try {
        // Fetch globally enabled providers
        const providers = await prisma.voiceProvider.findMany({
          where: { enabled: true }
        });

        for (const provider of providers) {
          // Use fake test credentials to verify api ping or lightweight network connection
          try {
            const tempApiKey = 'ping-test-key';
            const adapter = VoiceProviderFactory.getProvider(provider.slug, tempApiKey, 'test-agent-id');
            const result = await adapter.testConnection();
            
            // If the provider returned a structured auth error but the endpoint did respond, it means the API is reachable (provider is healthy)
            if (result.success || (result.message && !result.message.includes('ENOTFOUND') && !result.message.includes('ECONNREFUSED'))) {
              await VoiceProviderHealthMonitor.logSuccess(provider.slug, result.latencyMs);
            } else {
              await VoiceProviderHealthMonitor.logFailure(provider.slug);
            }
          } catch (err) {
            console.error(`[VoiceHealthWorker] Health check error for ${provider.slug}:`, err.message);
            await VoiceProviderHealthMonitor.logFailure(provider.slug);
          }
        }

        return { success: true };
      } catch (error) {
        console.error(`[VoiceHealthWorker] Job ${job.id} failed:`, error.message);
        throw error;
      }
    }, { connection: redisConnection, concurrency: 1 });
  }
}

module.exports = new VoiceHealthWorker();
