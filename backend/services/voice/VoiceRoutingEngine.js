const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const VoiceProviderHealthMonitor = require('./VoiceProviderHealthMonitor');
const VoiceTenantIsolationGuard = require('./VoiceTenantIsolationGuard');
const VoiceProviderFactory = require('./VoiceProviderFactory');
const WorkingHoursService = require('./WorkingHoursService');

class VoiceRoutingEngine {
  /**
   * Retrieves a ranked list of all healthy active voice providers, shifted for alternating turn-by-turn round-robin.
   */
  static async getRankedProviders(userId) {
    // 1. Fetch user configs mapped with enabled global providers
    const userProviders = await prisma.userVoiceProvider.findMany({
      where: {
        userId,
        active: true,
        provider: { enabled: true }
      },
      include: { provider: true }
    });

    if (!userProviders || userProviders.length === 0) {
      throw new Error('No active voice providers configured or enabled for this workspace.');
    }

    // 2. Rank providers by health, priority, and latency
    const scoredProviders = [];
    for (const userConfig of userProviders) {
      const slug = userConfig.provider.slug;
      const isHealthy = await VoiceProviderHealthMonitor.isProviderHealthy(slug);
      
      if (isHealthy) {
        const latency = await VoiceProviderHealthMonitor.getProviderLatency(slug);
        const score = (userConfig.provider.priority * 1000) + latency;
        scoredProviders.push({ userConfig, score });
      }
    }

    // Sort by final score ascending (highest priority & lowest latency first)
    scoredProviders.sort((a, b) => a.score - b.score);

    // If ALL providers are unhealthy, still include them as last-resort fallbacks
    // This prevents a single health monitor blip from permanently blocking all calls
    if (scoredProviders.length === 0) {
      console.warn(`[VoiceRoutingEngine] ⚠️ All providers are marked unhealthy for workspace ${userId} — trying them anyway as fallback`);
      for (const userConfig of userProviders) {
        const slug = userConfig.provider.slug;
        const latency = await VoiceProviderHealthMonitor.getProviderLatency(slug);
        const score = (userConfig.provider.priority * 1000) + latency;
        scoredProviders.push({ userConfig, score });
      }
      scoredProviders.sort((a, b) => a.score - b.score);
    }

    let ranked = scoredProviders.map(p => p.userConfig);

    // 3. Apply round-robin shift if multiple providers are configured
    if (ranked.length > 1) {
      try {
        const redis = require('../redisConnection');
        const rrKey = `voice_provider_round_robin:${userId}`;
        const countStr = await redis.get(rrKey);
        const count = countStr ? parseInt(countStr, 10) : 0;
        
        // Shift the list by count % ranked.length
        const shiftAmount = count % ranked.length;
        if (shiftAmount > 0) {
          ranked = [...ranked.slice(shiftAmount), ...ranked.slice(0, shiftAmount)];
        }
      } catch (err) {
        console.error('[VoiceRoutingEngine] Failed to apply round-robin shift:', err.message);
      }
    }

    // 4. Map to initialized adapters
    const adapters = ranked.map(userConfig => {
      const apiKey = VoiceTenantIsolationGuard.decrypt(userConfig.encryptedApiKey);
      const agentId = VoiceTenantIsolationGuard.decrypt(userConfig.encryptedAgentId);
      const voiceId = userConfig.encryptedVoiceId ? VoiceTenantIsolationGuard.decrypt(userConfig.encryptedVoiceId) : null;

      const adapter = VoiceProviderFactory.getProvider(
        userConfig.provider.slug,
        apiKey,
        agentId,
        {
          ...(userConfig.provider.configSchema || {}),
          voiceId,
          userId
        }
      );

      return {
        adapter,
        providerSlug: userConfig.provider.slug
      };
    });

    return adapters;
  }

  /**
   * Determines the best provider for a specific user and returns the initialized adapter.
   */
  static async getOptimalProvider(userId) {
    const providers = await this.getRankedProviders(userId);
    return providers[0];
  }

  /**
   * Retrieves a specific configured provider by ID for testing purposes.
   */
  static async getSpecificProvider(userId, providerId) {
    const userConfig = await prisma.userVoiceProvider.findFirst({
      where: {
        userId,
        providerId
      },
      include: { provider: true }
    });

    if (!userConfig) {
      throw new Error('This provider is not configured yet. Please save the configuration first.');
    }

    const apiKey = VoiceTenantIsolationGuard.decrypt(userConfig.encryptedApiKey);
    const agentId = VoiceTenantIsolationGuard.decrypt(userConfig.encryptedAgentId);
    const voiceId = userConfig.encryptedVoiceId ? VoiceTenantIsolationGuard.decrypt(userConfig.encryptedVoiceId) : null;

    const adapter = VoiceProviderFactory.getProvider(
      userConfig.provider.slug,
      apiKey,
      agentId,
      {
        ...(userConfig.provider.configSchema || {}),
        voiceId,
        userId
      }
    );

    return { adapter, providerSlug: userConfig.provider.slug };
  }
}

module.exports = VoiceRoutingEngine;
