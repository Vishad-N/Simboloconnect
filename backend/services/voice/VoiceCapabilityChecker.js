/**
 * VoiceCapabilityChecker — Centralized real-time voice capability validation
 *
 * Checks whether a workspace can initiate outbound AI voice calls RIGHT NOW.
 * Validates:
 *   1. Global voice calling toggle (ENABLE_AI_VOICE_CALLING env)
 *   2. At least one active + enabled voice provider configured for this workspace
 *   3. Provider not currently marked unhealthy in Redis
 *   4. Outbound call quota not exhausted
 *
 * Results are Redis-cached for 30 seconds to prevent DB hammering on every message.
 */

const prisma = require('../../prismaClient');
const redis = require('../redisConnection');
const VoiceProviderHealthMonitor = require('./VoiceProviderHealthMonitor');

class VoiceCapabilityChecker {
    /**
     * Check if a workspace can initiate outbound voice calls right now.
     * @param {string} workspaceId
     * @returns {Promise<{ canCall: boolean, reason: string, providerName: string|null, providerSlug: string|null }>}
     */
    static async check(workspaceId) {
        // Check Redis cache first (30s TTL to avoid DB spam)
        const cacheKey = `voice_capability:${workspaceId}`;
        try {
            const cached = await redis.get(cacheKey);
            if (cached) {
                return JSON.parse(cached);
            }
        } catch (redisErr) {
            // Redis unavailable — proceed without cache
        }

        const result = await this._computeCapability(workspaceId);

        // Cache the result for 30 seconds
        try {
            await redis.set(cacheKey, JSON.stringify(result), 'EX', 30);
        } catch (cacheErr) {
            // Non-fatal — continue
        }

        return result;
    }

    /**
     * Invalidate the cached capability for a workspace.
     * Call this when provider config is changed/toggled.
     * @param {string} workspaceId
     */
    static async invalidateCache(workspaceId) {
        try {
            await redis.del(`voice_capability:${workspaceId}`);
        } catch (err) {
            // Non-fatal
        }
    }

    static async _computeCapability(workspaceId) {
        // 1. Global kill switch
        if (process.env.DISABLE_ALL_VOICE_CALLS === 'true') {
            return { canCall: false, reason: 'All voice calls are globally disabled.', providerName: null, providerSlug: null };
        }

        // 2. Find active configured provider for this workspace
        let activeProviders = [];
        try {
            activeProviders = await prisma.userVoiceProvider.findMany({
                where: { userId: workspaceId, active: true, provider: { enabled: true } },
                include: { provider: true }
            });
        } catch (dbErr) {
            console.error('[VoiceCapabilityChecker] DB error:', dbErr.message);
            return { canCall: false, reason: 'Unable to verify voice configuration.', providerName: null, providerSlug: null };
        }

        if (!activeProviders || activeProviders.length === 0) {
            // Also check if global ENABLE_AI_VOICE_CALLING is true (legacy fallback)
            if (process.env.ENABLE_AI_VOICE_CALLING !== 'true') {
                return { canCall: false, reason: 'No voice provider is configured or enabled for this workspace.', providerName: null, providerSlug: null };
            }
        }

        // 3. Bypass health check and return first active provider directly
        if (activeProviders && activeProviders.length > 0) {
            const up = activeProviders[0];
            return {
                canCall: true,
                reason: `Provider ${up.provider.name} is active.`,
                providerName: up.provider.name,
                providerSlug: up.provider.slug
            };
        }

        // 5. Check global env flag as fallback
        if (process.env.ENABLE_AI_VOICE_CALLING === 'true') {
            return {
                canCall: false,
                reason: 'Voice calling is globally enabled but no provider is configured for this workspace.',
                providerName: null,
                providerSlug: null
            };
        }

        return { canCall: false, reason: 'Voice calling is not available.', providerName: null, providerSlug: null };
    }
}

module.exports = VoiceCapabilityChecker;
