/**
 * PHASE 2: MetaApiService
 *
 * Centralized service for ALL WhatsApp Cloud API calls.
 * Features:
 *  - Retry with exponential backoff (configurable)
 *  - Timeout handling (10s default)
 *  - Meta 429 (rate limit) detection & special backoff
 *  - Meta 5xx server error retry
 *  - Structured error objects
 *  - Structured logging: requestId, phoneNumberId, campaignId, response time, error code
 *
 * BACKWARD COMPATIBLE: Existing code can continue using axios directly.
 * Migrate gradually by replacing axios calls with MetaApiService calls.
 */

const axios = require('axios');
const { getMetaConfig } = require('../utils/metaConfig');
const logger = require('./logger');
const { randomBytes } = require('crypto');

// ─── Error Classes ────────────────────────────────────────────────────────
class MetaApiError extends Error {
    constructor(message, { code, subCode, type, fbtrace, status, retryable = false } = {}) {
        super(message);
        this.name = 'MetaApiError';
        this.code = code;
        this.subCode = subCode;
        this.type = type;
        this.fbtrace = fbtrace;
        this.status = status;
        this.retryable = retryable;
    }
}

class MetaRateLimitError extends MetaApiError {
    constructor(message, details = {}) {
        super(message, { ...details, retryable: true });
        this.name = 'MetaRateLimitError';
    }
}

// ─── Retry Helper ─────────────────────────────────────────────────────────
async function withRetry(fn, { maxAttempts = 3, baseDelayMs = 2000, context = {} } = {}) {
    let lastError;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await fn();
        } catch (err) {
            lastError = err;
            const isRetryable = err.retryable || (err instanceof MetaRateLimitError);
            const isServerError = err.status >= 500 && err.status < 600;

            if (!isRetryable && !isServerError) {
                // Non-retryable error (e.g. invalid number, bad template) — throw immediately
                throw err;
            }

            if (attempt === maxAttempts) break;

            // Exponential backoff: 2s, 4s, 8s + ±20% jitter
            const delay = baseDelayMs * Math.pow(2, attempt - 1);
            const jitter = delay * (0.8 + Math.random() * 0.4);
            const waitMs = Math.min(Math.round(jitter), 60000);

            logger.warn('Meta API retry', {
                ...context,
                attempt,
                maxAttempts,
                waitMs,
                errCode: err.code,
                errMsg: err.message,
            });

            await new Promise(r => setTimeout(r, waitMs));
        }
    }
    throw lastError;
}

// ─── Core HTTP caller ─────────────────────────────────────────────────────
async function metaPost(url, payload, token, context = {}) {
    const requestId = `req_${randomBytes(4).toString('hex')}`;
    const startTime = Date.now();

    logger.info('Meta API request', { requestId, url, ...context });

    try {
        const response = await axios.post(url, payload, {
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            timeout: 12000,
        });

        const responseTime = Date.now() - startTime;
        logger.info('Meta API success', {
            requestId,
            responseTime,
            messageId: response.data?.messages?.[0]?.id,
            ...context,
        });

        return response.data;

    } catch (err) {
        const responseTime = Date.now() - startTime;
        const status = err.response?.status;
        const metaErr = err.response?.data?.error;

        logger.error('Meta API error', {
            requestId,
            responseTime,
            status,
            errCode: metaErr?.code,
            errSubCode: metaErr?.error_subcode,
            errType: metaErr?.type,
            errMsg: metaErr?.message || err.message,
            fbtrace: metaErr?.fbtrace_id,
            ...context,
        });

        // Classify error
        if (status === 429 || metaErr?.code === 80007 || metaErr?.code === 130429) {
            throw new MetaRateLimitError(metaErr?.message || 'Rate limited by Meta', {
                code: metaErr?.code,
                subCode: metaErr?.error_subcode,
                fbtrace: metaErr?.fbtrace_id,
                status,
            });
        }

        if (status >= 500) {
            throw new MetaApiError(metaErr?.message || 'Meta server error', {
                code: metaErr?.code,
                status,
                retryable: true,
            });
        }

        // 4xx non-rate-limit: not retryable (bad request, invalid token, etc.)
        throw new MetaApiError(metaErr?.message || err.message, {
            code: metaErr?.code,
            subCode: metaErr?.error_subcode,
            type: metaErr?.type,
            fbtrace: metaErr?.fbtrace_id,
            status,
            retryable: false,
        });
    }
}

// ─── PUBLIC API ───────────────────────────────────────────────────────────

/**
 * Send any WhatsApp message payload.
 * @param {object} opts
 * @param {string} opts.phoneNumberId - Sending phone number ID
 * @param {string} opts.token - Decrypted Meta access token
 * @param {object} opts.payload - Full Meta API message payload
 * @param {object} opts.context - Logging context (userId, campaignId, etc.)
 * @param {number} [opts.maxAttempts=3] - Max retry attempts
 * @returns {{ messageId: string }}
 */
async function sendMessage({ phoneNumberId, token, payload, context = {}, maxAttempts = 3 }) {
    const { version } = await getMetaConfig();
    const url = `https://graph.facebook.com/${version}/${phoneNumberId}/messages`;

    const data = await withRetry(
        () => metaPost(url, payload, token, { phoneNumberId, ...context }),
        { maxAttempts, baseDelayMs: 2000, context: { phoneNumberId, ...context } }
    );

    return { messageId: data.messages?.[0]?.id };
}

/**
 * Send a template message.
 */
async function sendTemplate({ phoneNumberId, token, to, templateName, language, components = [], context = {} }) {
    const payload = {
        messaging_product: 'whatsapp',
        to,
        type: 'template',
        template: {
            name: templateName,
            language: { code: language },
            ...(components.length > 0 ? { components } : {}),
        },
    };
    return sendMessage({ phoneNumberId, token, payload, context });
}

/**
 * Send a text message.
 */
async function sendText({ phoneNumberId, token, to, text, context = {} }) {
    const payload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'text',
        text: { body: text },
    };
    return sendMessage({ phoneNumberId, token, payload, context });
}

/**
 * Upload media and return media ID.
 */
async function uploadMedia({ phoneNumberId, token, buffer, filename, mimeType, context = {} }) {
    const FormData = require('form-data');
    const { version } = await getMetaConfig();
    const requestId = `upload_${Date.now()}`;
    const startTime = Date.now();

    const form = new FormData();
    form.append('messaging_product', 'whatsapp');
    form.append('file', buffer, { filename, contentType: mimeType });

    try {
        const response = await axios.post(
            `https://graph.facebook.com/${version}/${phoneNumberId}/media`,
            form,
            {
                headers: { Authorization: `Bearer ${token}`, ...form.getHeaders() },
                timeout: 30000,
            }
        );
        logger.info('Media upload success', { requestId, responseTime: Date.now() - startTime, ...context });
        return { mediaId: response.data.id };
    } catch (err) {
        const status = err.response?.status;
        const metaErr = err.response?.data?.error;
        logger.error('Media upload error', { requestId, status, errMsg: metaErr?.message || err.message, ...context });
        throw new MetaApiError(metaErr?.message || err.message, { code: metaErr?.code, status, retryable: false });
    }
}

module.exports = {
    sendMessage,
    sendTemplate,
    sendText,
    uploadMedia,
    MetaApiError,
    MetaRateLimitError,
};
