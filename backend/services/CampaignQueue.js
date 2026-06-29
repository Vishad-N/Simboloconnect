/**
 * CampaignQueue — UPGRADED (Phase 2 + Phase 3)
 *
 * Changes from original:
 *  - Uses MetaApiService (retry + backoff + structured logging) instead of raw axios
 *  - Uses RateLimiter (per-phone token bucket) before every send
 *  - Uses DelayEngine (randomized human-like delays) between messages
 *  - Uses shared redisConnection singleton
 *  - generateActualComponents moved here (was duplicated in campaigns.js)
 *  - concurrency reduced to 5 (was 10) — safer with rate limiter handling the throughput
 *  - Proper BullMQ retry config (was missing)
 *
 * BACKWARD COMPATIBLE: Same export { campaignQueue }, same job data shape.
 */

const { Queue, Worker } = require('bullmq');
const prisma = require('../prismaClient');
const { getMetaConfig } = require('../utils/metaConfig');
const { decrypt } = require('../utils/encryption');
const { refundCredits } = require('../middleware/walletEngine');
const redis = require('./redisConnection');
const MetaApiService = require('./MetaApiService');
const RateLimiter = require('./RateLimiter');
const { humanDelay } = require('./DelayEngine');
const crypto = require('crypto');

// ─── Queue (same name — backward compatible) ──────────────────────────────
const campaignQueue = new Queue('campaign-queue', {
    connection: redis,
    defaultJobOptions: {
        priority: 5,               // Medium — below chat (1) and bot-reply (3)
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: { count: 1000 },
        removeOnFail: { count: 500 },
    },
});

// Helper to resolve a template variable value from variablesConfig and contact data
function resolveVariableValue(config, contact, defaultValue = '') {
    if (!config) return defaultValue;
    if (config.type === 'contact_name') {
        return contact.name || 'Customer';
    }
    if (config.type === 'contact_phone') {
        return contact.phone || '';
    }
    if (config.type === 'custom_field' || config.type === 'customField') {
        const key = config.value;
        if (!key) return defaultValue;
        const fields = contact.customFields || {};
        if (fields[key] !== undefined && fields[key] !== null) {
            return String(fields[key]);
        }
        // Try case-insensitive search and strip non-alphanumeric (like underscores) to match snake_case / camelCase
        const cleanKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
        const foundKey = Object.keys(fields).find(k => k.toLowerCase().replace(/[^a-z0-9]/g, '') === cleanKey);
        if (foundKey) {
            return String(fields[foundKey]);
        }
        return '';
    }
    return config.value !== undefined && config.value !== null ? String(config.value) : defaultValue;
}

// ─── Component builder (single source of truth) ───────────────────────────
function generateActualComponents(componentsJson, contact, variablesConfig = {}, mediaUrl = null) {
    if (!componentsJson) return [];
    let comps = [];
    try {
        comps = typeof componentsJson === 'string' ? JSON.parse(componentsJson) : (componentsJson || []);
    } catch (_) { return []; }

    const built = [];
    let varIndex = 0;

    comps.forEach(comp => {
        let parameters = [];
        const textToMatch = comp.text || '';
        const varCount = (textToMatch.match(/\{\{\d+\}\}/g) || []).length;

        if (comp.type === 'HEADER' && comp.format === 'TEXT') {
            for (let i = 0; i < varCount; i++) {
                const config = variablesConfig[varIndex] || { type: 'custom', value: 'Notice' };
                const val = resolveVariableValue(config, contact, 'Notice');
                parameters.push({ type: 'text', text: val });
                varIndex++;
            }
            if (parameters.length > 0) built.push({ type: 'header', parameters });

        } else if (comp.type?.toUpperCase() === 'HEADER' && ['IMAGE', 'DOCUMENT', 'VIDEO'].includes(comp.format?.toUpperCase())) {
            const mediaType = comp.format.toLowerCase();
            let finalUrl = mediaUrl;
            if (!finalUrl) {
                if (mediaType === 'image') finalUrl = 'https://upload.wikimedia.org/wikipedia/commons/a/a9/Example.jpg';
                else if (mediaType === 'document') finalUrl = 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf';
                else if (mediaType === 'video') finalUrl = 'http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4';
            }
            const isId = /^\d+$/.test(finalUrl);
            if (mediaType === 'image') parameters.push({ type: 'image', image: { [isId ? 'id' : 'link']: finalUrl } });
            else if (mediaType === 'document') parameters.push({ type: 'document', document: { [isId ? 'id' : 'link']: finalUrl } });
            else if (mediaType === 'video') parameters.push({ type: 'video', video: { [isId ? 'id' : 'link']: finalUrl } });
            built.push({ type: 'header', parameters });
        }

        if (comp.type === 'BODY') {
            for (let i = 0; i < varCount; i++) {
                const config = variablesConfig[varIndex] || { type: 'custom', value: 'Update' };
                const val = resolveVariableValue(config, contact, 'Update');
                parameters.push({ type: 'text', text: val });
                varIndex++;
            }
            if (parameters.length > 0) built.push({ type: 'body', parameters });
        }

        if (comp.type === 'BUTTONS' && comp.buttons) {
            comp.buttons.forEach((btn, idx) => {
                if (btn.type === 'URL' && btn.url && btn.url.includes('{{1}}')) {
                    const config = variablesConfig[varIndex] || { type: 'custom', value: 'visit' };
                    const val = resolveVariableValue(config, contact, 'visit');
                    built.push({ type: 'button', sub_type: 'url', index: idx.toString(), parameters: [{ type: 'text', text: val }] });
                    varIndex++;
                }
            });
        }
    });

    return built;
}

// ─── Worker ───────────────────────────────────────────────────────────────
const worker = new Worker('campaign-queue', async (job) => {
    const { contact, template, user, campaignId, ecomCampaignId, userId, variablesConfig, mediaUrl, batchIndex = 0 } = job.data;

    // PHASE 3: Human-like delay before each send
    const delayUsed = await humanDelay(batchIndex);

    // PHASE 3: Per-phone rate limit check (wait up to 5s for a token)
    const allowed = await RateLimiter.waitForToken(user.phoneNumberId, 5000);
    if (!allowed) {
        // Re-throw so BullMQ retries with backoff
        throw Object.assign(new Error('Rate limit timeout — will retry'), { retryable: true });
    }

    const cleanPhone = contact.phone.replace(/[^\d]/g, '');

    const dynamicComponents = generateActualComponents(template.components, contact, variablesConfig, mediaUrl);

    // Click Tracking interception
    if (job.data.enableClickTracking) {
        for (const comp of dynamicComponents) {
            if (comp.type === 'button' && comp.sub_type === 'url' && comp.parameters && comp.parameters.length > 0) {
                const originalUrl = comp.parameters[0].text;
                const shortCode = crypto.randomBytes(4).toString('hex');
                
                try {
                    await prisma.linkClick.create({
                        data: {
                            shortCode,
                            originalUrl,
                            campaignId: campaignId || null,
                            contactId: contact.id,
                        }
                    });
                    comp.parameters[0].text = shortCode;
                } catch (e) {
                    console.error("[CampaignQueue] Error creating LinkClick tracking:", e);
                }
            }
        }
    }

    try {
        // PHASE 2: Use MetaApiService (retry + backoff + structured logging)
        const result = await MetaApiService.sendTemplate({
            phoneNumberId: user.phoneNumberId,
            token: user.decryptedToken,
            to: cleanPhone,
            templateName: template.name,
            language: template.language,
            components: dynamicComponents,
            context: { userId, campaignId, ecomCampaignId, recipient: cleanPhone, batchIndex, delayUsed },
        });

        // Build resolved body for display
        let resolvedBody = '';
        try {
            const rawComps = typeof template.components === 'string' ? JSON.parse(template.components) : (template.components || []);
            const bodyComp = rawComps.find(c => c.type === 'BODY');
            if (bodyComp?.text) {
                const bodyApiComp = dynamicComponents.find(c => c.type === 'body');
                resolvedBody = bodyComp.text;
                if (bodyApiComp?.parameters) {
                    bodyApiComp.parameters.forEach((param, i) => {
                        resolvedBody = resolvedBody.replace(`{{${i + 1}}}`, param.text || '');
                    });
                }
            }
        } catch (_) {}

        await prisma.messageLog.create({
            data: {
                userId,
                messageId: result.messageId,
                recipient: cleanPhone,
                direction: 'OUTBOUND',
                status: 'SENT',
                content: {
                    type: 'template',
                    templateName: template.name,
                    resolvedBody,
                    components: typeof template.components === 'string' ? JSON.parse(template.components) : template.components,
                },
                campaignId: campaignId || null,
                ecomCampaignId: ecomCampaignId || null,
            },
        });

    } catch (err) {
        const errorReason = err.message || 'Unknown error';
        console.error(`[CampaignWorker] Failed to send to ${contact.phone}:`, errorReason);

        await prisma.messageLog.create({
            data: {
                userId,
                messageId: `failed-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                recipient: contact.phone,
                direction: 'OUTBOUND',
                status: 'FAILED',
                content: { text: `Error: ${errorReason}` },
                campaignId: campaignId || null,
                ecomCampaignId: ecomCampaignId || null,
            },
        });

        const rateCategory = template.category ? template.category.toUpperCase() : 'MARKETING';
        await refundCredits(userId, rateCategory, 1, `Refund for failed campaign send to ${contact.phone}`);

        // If retryable (429, 5xx), re-throw so BullMQ retries
        if (err.retryable) throw err;
        // Otherwise, swallow — don't block other jobs for non-retryable errors
    }
}, {
    connection: redis,
    concurrency: 5,  // Reduced from 10 — rate limiter now handles throughput safely
    // No BullMQ-level limiter needed — RateLimiter handles per-number pacing
});

worker.on('completed', (job) => {
    // Uncomment for debug: console.log(`[CampaignWorker] Job ${job.id} completed`);
});

worker.on('failed', (job, err) => {
    console.error(`[CampaignWorker] Job ${job?.id} permanently failed:`, err.message);
});

worker.on('error', (err) => {
    console.error('[CampaignWorker] Worker error:', err.message);
});

module.exports = { campaignQueue, generateActualComponents };
