/**
 * ObservabilityManager.js
 * Phase B — Enterprise Observability, Telemetry, and PII Masking Service.
 * Registers Prometheus metrics for checkout latency, webhook tracing, AI agent executions, and queue sizes.
 */
const client = require('prom-client');

// Initialize Prometheus Registry
const registry = new client.Registry();
client.collectDefaultMetrics({ register: registry });

// 1. Payment Latency Histogram
const paymentLatency = new client.Histogram({
    name: 'commerce_payment_processing_duration_seconds',
    help: 'Time spent processing payment links and checkouts',
    labelNames: ['provider', 'status', 'workspace_id'],
    buckets: [0.1, 0.5, 1, 2, 5, 10]
});
registry.registerMetric(paymentLatency);

// 2. AI Execution Counter & Duration
const aiExecutionDuration = new client.Histogram({
    name: 'ai_tool_execution_duration_seconds',
    help: 'Duration of AI tool execution per workspace',
    labelNames: ['tool_name', 'status', 'workspace_id'],
    buckets: [0.1, 0.5, 1, 3, 5, 10]
});
registry.registerMetric(aiExecutionDuration);

// 3. Webhook Scrape Counters
const webhookCounter = new client.Counter({
    name: 'commerce_webhook_events_total',
    help: 'Total processed commerce webhooks',
    labelNames: ['provider', 'event_type', 'status']
});
registry.registerMetric(webhookCounter);

// 4. Active Queue Sizes Gauge
const queueBacklogGauge = new client.Gauge({
    name: 'commerce_queue_backlog_size',
    help: 'Number of active jobs in BullMQ queues',
    labelNames: ['queue_name']
});
registry.registerMetric(queueBacklogGauge);

class ObservabilityManager {
    /**
     * Measure payment transaction duration
     */
    static startPaymentTimer(provider, workspaceId) {
        return paymentLatency.startTimer({ provider, workspaceId });
    }

    /**
     * Track AI Tool Execution Telemetry
     */
    static trackAiTool(toolName, status, workspaceId, durationMs) {
        aiExecutionDuration.observe({ tool_name: toolName, status, workspace_id: workspaceId }, durationMs / 1000);
    }

    /**
     * Record Webhook Success/Failure telemetry
     */
    static recordWebhook(provider, eventType, status) {
        webhookCounter.inc({ provider, event_type: eventType, status });
    }

    /**
     * Refresh BullMQ active queues sizes metric
     */
    static updateQueueSize(queueName, size) {
        queueBacklogGauge.set({ queue_name: queueName }, size);
    }

    /**
     * Fetch all metrics in Prometheus format for scraper
     */
    static async getMetrics() {
        return registry.metrics();
    }

    static getContentType() {
        return registry.contentType;
    }

    /**
     * Enterprise PII and Secret Scrubbing Logger
     */
    static logStructured(level, message, metadata = {}) {
        const scrubbedMetadata = ObservabilityManager._scrubPii(metadata);
        const logPayload = {
            timestamp: new Date().toISOString(),
            level: level.toUpperCase(),
            message,
            ...scrubbedMetadata
        };
        console.log(JSON.stringify(logPayload));
    }

    /**
     * Deeply scrub metadata to prevent PII leaks
     */
    static _scrubPii(obj) {
        if (!obj || typeof obj !== 'object') return obj;
        const scrubbed = Array.isArray(obj) ? [] : {};

        for (const [key, value] of Object.entries(obj)) {
            const normalizedKey = key.toLowerCase();
            
            // Mask secrets, keys, and tokens
            if (
                normalizedKey.includes('secret') || 
                normalizedKey.includes('key') || 
                normalizedKey.includes('token') || 
                normalizedKey.includes('password')
            ) {
                scrubbed[key] = '*** MASKED_SECRET ***';
            } 
            // Mask customer phone numbers and emails
            else if (normalizedKey.includes('phone') || normalizedKey.includes('contact')) {
                scrubbed[key] = value ? `${String(value).substring(0, 4)}******` : value;
            } 
            else if (normalizedKey.includes('email')) {
                scrubbed[key] = '*** MASKED_EMAIL ***';
            } 
            // Recurse into child objects
            else if (typeof value === 'object') {
                scrubbed[key] = ObservabilityManager._scrubPii(value);
            } 
            else {
                scrubbed[key] = value;
            }
        }
        return scrubbed;
    }
}

module.exports = ObservabilityManager;
