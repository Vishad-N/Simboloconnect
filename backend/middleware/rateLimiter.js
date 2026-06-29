/**
 * rateLimiter.js
 * Phase B — Enterprise Tenant-Level Redis Rate Limiter.
 * Implements sliding window rate limiting per workspace (tenant) and per IP address.
 */
const redis = require('../services/redisConnection');

/**
 * Express rate-limiting middleware factory using Redis sliding window
 * @param {Object} options
 * @param {number} options.windowMs - Timeframe window in milliseconds (default 1 min)
 * @param {number} options.max - Max requests within the window
 * @param {string} options.keyPrefix - Unique prefix for Redis keys
 */
function rateLimiter(options = {}) {
    const windowMs = options.windowMs || 60 * 1000;
    const max = options.max || 100;
    const keyPrefix = options.keyPrefix || 'rl';

    return async (req, res, next) => {
        // Enforce tenant isolation if logged in, fallback to IP address
        const identifier = req.user?.id || req.ip;
        const key = `${keyPrefix}:${identifier}`;
        const now = Date.now();
        const clearBefore = now - windowMs;

        try {
            // Using multi transaction to guarantee atomicity
            const multi = redis.multi();
            multi.zremrangebyscore(key, 0, clearBefore); // remove old requests
            multi.zadd(key, now, now);                  // record current request timestamp
            multi.zcard(key);                           // count total requests in current window
            multi.expire(key, Math.ceil(windowMs / 1000));

            const results = await multi.exec();
            
            // The 3rd result from our multi block represents ZCARD (total request count)
            const requestCount = results[2][1];

            res.setHeader('X-RateLimit-Limit', max);
            res.setHeader('X-RateLimit-Remaining', Math.max(0, max - requestCount));
            res.setHeader('X-RateLimit-Reset', new Date(now + windowMs).toISOString());

            if (requestCount > max) {
                return res.status(429).json({
                    error: 'Too Many Requests',
                    message: 'Rate limit exceeded. Please try again shortly.'
                });
            }

            next();
        } catch (err) {
            // Under Redis failure, log cleanly but fail open to maintain service uptime
            console.error('[RateLimiter] Redis connection error, failing open:', err.message);
            next();
        }
    };
}

module.exports = rateLimiter;
