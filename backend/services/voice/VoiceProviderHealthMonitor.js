/**
 * VoiceProviderHealthMonitor
 * 
 * Tracks provider health using Redis sliding window failure counts.
 * A provider is marked unhealthy only after 5+ consecutive failures
 * within a 120-second window — prevents false blacklisting from transient errors.
 */
const redis = require('../redisConnection');

const FAILURE_THRESHOLD = 5;   // Mark unhealthy after 5 failures (was 3)
const WINDOW_SECONDS = 120;     // Sliding window: 120 seconds (was 60)
const LATENCY_CACHE_TTL = 300;  // Cache latency for 5 minutes

class VoiceProviderHealthMonitor {
  /**
   * Log a failure event in Redis with a sliding window.
   * @param {string} providerSlug
   */
  static async logFailure(providerSlug) {
    const key = `voice:health:${providerSlug}:failures`;
    try {
      const multi = redis.multi();
      multi.incr(key);
      multi.expire(key, WINDOW_SECONDS);
      await multi.exec();
      console.warn(`[HealthMonitor] Logged failure for provider: ${providerSlug}`);
    } catch (err) {
      // Non-fatal — don't crash call flow if Redis is down
    }
  }

  /**
   * Log a success event — resets the failure counter.
   * @param {string} providerSlug
   * @param {number} latencyMs
   */
  static async logSuccess(providerSlug, latencyMs) {
    const failuresKey = `voice:health:${providerSlug}:failures`;
    const latencyKey = `voice:health:${providerSlug}:latency`;
    try {
      const multi = redis.multi();
      multi.del(failuresKey);  // Reset failures on success
      multi.set(latencyKey, latencyMs.toString(), 'EX', LATENCY_CACHE_TTL);
      await multi.exec();
      console.log(`[HealthMonitor] Logged success for provider: ${providerSlug} (Latency: ${latencyMs}ms)`);
    } catch (err) {
      // Non-fatal
    }
  }

  /**
   * Checks if a provider is considered healthy.
   * Unhealthy = 5+ failures in last 120 seconds.
   * @param {string} providerSlug
   * @returns {Promise<boolean>}
   */
  static async isProviderHealthy(providerSlug) {
    try {
      const key = `voice:health:${providerSlug}:failures`;
      const failures = await redis.get(key);
      const count = failures ? parseInt(failures, 10) : 0;
      return count < FAILURE_THRESHOLD;
    } catch (err) {
      // If Redis is down, assume healthy (don't block calls)
      return true;
    }
  }

  /**
   * Force-reset health failures for a provider (e.g., after config change).
   * @param {string} providerSlug
   */
  static async resetFailures(providerSlug) {
    try {
      await redis.del(`voice:health:${providerSlug}:failures`);
      console.log(`[HealthMonitor] Reset failure count for provider: ${providerSlug}`);
    } catch (err) {
      // Non-fatal
    }
  }

  /**
   * Gets cached latency of a provider.
   * @param {string} providerSlug
   * @returns {Promise<number>} milliseconds
   */
  static async getProviderLatency(providerSlug) {
    try {
      const key = `voice:health:${providerSlug}:latency`;
      const latency = await redis.get(key);
      return latency ? parseInt(latency, 10) : 250; // default 250ms if no metric
    } catch (err) {
      return 250;
    }
  }

  /**
   * Returns health summary for all known providers.
   * @param {string[]} providerSlugs
   * @returns {Promise<Object>} map of slug → { healthy, failureCount, latencyMs }
   */
  static async getHealthSummary(providerSlugs) {
    const summary = {};
    for (const slug of providerSlugs) {
      try {
        const failuresKey = `voice:health:${slug}:failures`;
        const failures = await redis.get(failuresKey);
        const count = failures ? parseInt(failures, 10) : 0;
        const latency = await this.getProviderLatency(slug);
        summary[slug] = {
          healthy: count < FAILURE_THRESHOLD,
          failureCount: count,
          latencyMs: latency
        };
      } catch (err) {
        summary[slug] = { healthy: true, failureCount: 0, latencyMs: 250 };
      }
    }
    return summary;
  }
}

module.exports = VoiceProviderHealthMonitor;
