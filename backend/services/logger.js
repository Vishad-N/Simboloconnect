/**
 * STEP 5 & 6: Production Hardening
 * - Structured JSON logger with timestamps and context
 * - Request tracing with requestId propagation
 * - Worker execution timing
 * - Queue timing metrics
 * - Meta response diagnostics
 * - Campaign send analytics helpers
 *
 * Usage:
 *   const logger = require('./services/logger');
 *   logger.info('Message sent', { phoneNumberId, campaignId, responseTime });
 *   logger.error('Meta API failed', { requestId, errCode, status });
 */

const LOG_LEVEL = (process.env.LOG_LEVEL || 'info').toLowerCase();
const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };

function shouldLog(level) {
    return (LEVELS[level] || 1) >= (LEVELS[LOG_LEVEL] || 1);
}

function writeLog(level, message, meta = {}) {
    if (!shouldLog(level)) return;

    const entry = {
        ts: new Date().toISOString(),
        level: level.toUpperCase(),
        msg: message,
        ...meta,
    };

    const output = JSON.stringify(entry);
    if (level === 'error' || level === 'warn') {
        process.stderr.write(output + '\n');
    } else {
        process.stdout.write(output + '\n');
    }
}

const logger = {
    debug: (msg, meta) => writeLog('debug', msg, meta),
    info: (msg, meta) => writeLog('info', msg, meta),
    warn: (msg, meta) => writeLog('warn', msg, meta),
    error: (msg, meta) => writeLog('error', msg, meta),

    /**
     * Create a child logger with pre-filled context (e.g., campaignId, userId).
     * All calls on the child will include the context fields automatically.
     */
    child(context = {}) {
        return {
            debug: (msg, meta) => writeLog('debug', msg, { ...context, ...meta }),
            info: (msg, meta) => writeLog('info', msg, { ...context, ...meta }),
            warn: (msg, meta) => writeLog('warn', msg, { ...context, ...meta }),
            error: (msg, meta) => writeLog('error', msg, { ...context, ...meta }),
        };
    },

    /**
     * Time a function and log how long it took.
     * @param {string} label - Descriptive name for the operation
     * @param {Function} fn - Async function to time
     * @param {object} context - Additional log fields
     */
    async time(label, fn, context = {}) {
        const start = Date.now();
        try {
            const result = await fn();
            const elapsed = Date.now() - start;
            writeLog('info', label, { ...context, elapsed_ms: elapsed });
            return result;
        } catch (err) {
            const elapsed = Date.now() - start;
            writeLog('error', `${label} FAILED`, { ...context, elapsed_ms: elapsed, err: err.message });
            throw err;
        }
    },
};

module.exports = logger;
