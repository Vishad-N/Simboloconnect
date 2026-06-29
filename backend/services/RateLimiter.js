/**
 * PHASE 3: Per-Phone-Number Redis Token Bucket Rate Limiter
 *
 * Meta's limits (standard tier): ~80 messages/sec per phone number.
 * We use 60/sec as our safe cap (25% below Meta's limit).
 *
 * Uses Redis MULTI/EXEC for atomic token bucket operations.
 * Each phoneNumberId gets its own bucket key in Redis.
 *
 * BACKWARD COMPATIBLE: Purely additive — call consume() before sending.
 */

const redis = require('./redisConnection');

const DEFAULT_POINTS = 60;      // Max messages per window
const DEFAULT_DURATION = 1000;  // Window in milliseconds (1 second)
const BLOCK_DURATION = 2000;    // How long to block when exceeded (ms)

/**
 * Consume N tokens from the bucket for a phoneNumberId.
 * Returns { allowed: boolean, retryAfterMs: number }
 */
async function consume(phoneNumberId, count = 1) {
    const key = `ratelimit:${phoneNumberId}`;
    const now = Date.now();
    const windowStart = Math.floor(now / DEFAULT_DURATION) * DEFAULT_DURATION;
    const bucketKey = `${key}:${windowStart}`;

    try {
        // Lua script for atomic increment + TTL set
        // Returns: current count after increment
        const result = await redis.eval(
            `
            local current = redis.call('INCRBY', KEYS[1], ARGV[1])
            if current == tonumber(ARGV[1]) then
                redis.call('PEXPIRE', KEYS[1], ARGV[2])
            end
            return current
            `,
            1,               // Number of keys
            bucketKey,       // KEYS[1]
            count,           // ARGV[1] - tokens to consume
            DEFAULT_DURATION + 500  // ARGV[2] - TTL (window + buffer)
        );

        if (result > DEFAULT_POINTS) {
            // Bucket exceeded
            const retryAfterMs = windowStart + DEFAULT_DURATION - now + 50;
            return { allowed: false, retryAfterMs: Math.max(retryAfterMs, 100) };
        }

        return { allowed: true, retryAfterMs: 0 };
    } catch (err) {
        // If Redis fails, allow the message (fail-open for availability)
        console.error('[RateLimiter] Redis error, allowing message:', err.message);
        return { allowed: true, retryAfterMs: 0 };
    }
}

/**
 * Wait until a token is available (blocking with timeout).
 * Will wait up to maxWaitMs before giving up.
 */
async function waitForToken(phoneNumberId, maxWaitMs = 5000) {
    const startTime = Date.now();
    while (Date.now() - startTime < maxWaitMs) {
        const { allowed, retryAfterMs } = await consume(phoneNumberId, 1);
        if (allowed) return true;
        await new Promise(r => setTimeout(r, Math.min(retryAfterMs, 200)));
    }
    return false; // Could not get token within timeout
}

/**
 * Get current usage for a phone number (for monitoring).
 */
async function getCurrentUsage(phoneNumberId) {
    const windowStart = Math.floor(Date.now() / DEFAULT_DURATION) * DEFAULT_DURATION;
    const key = `ratelimit:${phoneNumberId}:${windowStart}`;
    const current = parseInt(await redis.get(key) || '0', 10);
    return { current, max: DEFAULT_POINTS, remaining: Math.max(0, DEFAULT_POINTS - current) };
}

module.exports = { consume, waitForToken, getCurrentUsage };
