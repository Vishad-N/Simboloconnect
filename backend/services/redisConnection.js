const IORedis = require('ioredis');

const connectionOptions = {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    retryStrategy: (times) => {
        if (process.env.NODE_ENV === 'test') {
            if (times > 1) return null; // Fail fast in tests to prevent process hang
            return 50;
        }
        if (process.env.NODE_ENV === 'development') {
            if (times > 3) return null; // Limit spam in development mode
            return Math.min(times * 500, 2000);
        }
        return Math.min(times * 200, 5000); // Production default retry strategy
    }
};

const redisUrl = process.env.REDIS_URL || process.env.REDIS_URI;
let redisConnection;

if (redisUrl) {
    redisConnection = new IORedis(redisUrl, connectionOptions);
} else {
    redisConnection = new IORedis({
        host: process.env.REDIS_HOST || '127.0.0.1', // Default to 127.0.0.1 for local dev outside docker compose
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        password: process.env.REDIS_PASSWORD || undefined,
        ...connectionOptions
    });
}

let loggedError = false;
redisConnection.on('connect', () => {
    console.log('[Redis] Connected successfully');
    loggedError = false;
});

redisConnection.on('error', (err) => {
    if (process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development') {
        if (!loggedError) {
            console.warn(`[Redis Warning] Redis is not available (${err.message}). AI will continue in non-cache mode, queues initialized gracefully.`);
            loggedError = true;
        }
    } else {
        console.error('[Redis] Error:', err.message);
    }
});

module.exports = redisConnection;
