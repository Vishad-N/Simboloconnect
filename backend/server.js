// server.js
require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

// Initialize Socket.io
const io = new Server(server, {
    cors: {
        origin: '*', // Define properly in production
        methods: ['GET', 'POST']
    }
});

// Middlewares
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Socket.io Connection Logic
io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    // User joins a room specific to their user_id
    socket.on('join_tenant', (userId) => {
        socket.join(`user_${userId}`);
        console.log(`Socket ${socket.id} joined room user_${userId}`);
    });

    socket.on('disconnect', () => {
        console.log(`Socket disconnected: ${socket.id}`);
    });
});

// Make io accessible in routes
app.set('io', io);

// Enhanced health check — includes Redis + BullMQ queue stats
app.get('/health', async (req, res) => {
    try {
        const redis = require('./services/redisConnection');
        const { Queue } = require('bullmq');

        let redisOk = false;
        try { await redis.ping(); redisOk = true; } catch (_) {}

        const cq = new Queue('campaign-queue', { connection: redis });
        const wq = new Queue('webhook.inbound', { connection: redis });

        const [campaignFailed, webhookFailed, campaignActive, webhookActive] = await Promise.all([
            cq.getFailedCount(), wq.getFailedCount(),
            cq.getActiveCount(), wq.getActiveCount(),
        ]);

        await Promise.all([cq.close(), wq.close()]);

        res.status(200).json({
            status: 'OK',
            ts: new Date().toISOString(),
            redis: redisOk ? 'connected' : 'disconnected',
            queues: {
                'campaign-queue': { failed: campaignFailed, active: campaignActive },
                'webhook.inbound': { failed: webhookFailed, active: webhookActive },
            },
        });
    } catch (err) {
        res.status(503).json({ status: 'ERROR', error: err.message });
    }
});

const webhookRoutes = require('./routes/webhooks');
const campaignRoutes = require('./routes/campaigns');
const templateRoutes = require('./routes/templates');
const settingsRoutes = require('./routes/settings');
const chatRoutes = require('./routes/chat');
const contactRoutes = require('./routes/contacts');
const analyticsRoutes = require('./routes/analytics');
const profileRoutes = require('./routes/profile');
const accountRoutes = require('./routes/account');
const staffRoutes = require('./routes/staff');
const chatbotRoutes = require('./routes/chatbot');
const autoRepliesRoutes = require('./routes/autoreplies');
const flowsRoutes = require('./routes/flows');
const adminRoutes = require('./routes/admin');
const smsGatewaysRoutes = require('./routes/smsGateways');
const authRoutes = require('./routes/auth');
const paymentRoutes = require('./routes/payment');
const publicRoutes = require('./routes/public');
const metaAuthRoutes = require('./routes/metaAuth');
const integrationsRoutes = require('./routes/integrations');
const ecommerceRoutes = require('./routes/ecommerce');
const aiRoutes = require('./routes/ai');
const workspacePaymentRoutes = require('./routes/workspacePayments');
const razorpayWebhookRoutes = require('./routes/webhooks/razorpayWebhook');
const automationRoutes = require('./routes/automation');

// Initialize Cron Jobs
require('./cron/expiryCheck');
require('./cron/campaignScheduler');

// Daily Queue Cleanup (2:00 AM server time)
const cron = require('node-cron');
const { runCleanup } = require('./services/queueCleanup');
cron.schedule('0 2 * * *', async () => {
    console.log('[Cron] Running daily queue cleanup...');
    await runCleanup().catch(err => console.error('[Cron] Queue cleanup failed:', err.message));
});


// Initialize Background Workers
// CampaignQueue self-initializes its worker on require
require('./services/CampaignQueue');

// PHASE 1: Start async webhook workers (pass io so they can emit socket events)
const { startWebhookWorker } = require('./services/WebhookWorker');
const { startWebhookReplyWorker } = require('./services/WebhookReplyWorker');
global.webhookWorkerInstance = startWebhookWorker(io);
global.webhookReplyWorkerInstance = startWebhookReplyWorker(io);

// PHASE A AI COMMERCE: Start Payment Event Worker
require('./workers/PaymentEventWorker');

// PHASE B COMMERCE: Start Recovery Worker (feature-flagged)
if (process.env.FEATURE_RECOVERY === 'true') {
    require('./workers/RecoveryWorker');
    console.log('[Server] Recovery Worker started (FEATURE_RECOVERY=true)');
}

// PHASE B COMMERCE: Start Subscription Dunning Worker (feature-flagged)
if (process.env.FEATURE_SUBSCRIPTIONS === 'true') {
    require('./workers/DunningWorker');
    console.log('[Server] Dunning Worker started (FEATURE_SUBSCRIPTIONS=true)');
}

// PHASE B COMMERCE: Start Delivery Tracking Worker (feature-flagged)
if (process.env.FEATURE_DELIVERY === 'true') {
    require('./workers/DeliveryTrackingWorker');
    console.log('[Server] Delivery Tracking Worker started (FEATURE_DELIVERY=true)');
}

// AI VOICE CALLING INFRASTRUCTURE: Start Voice Workers
if (process.env.ENABLE_AI_VOICE_CALLING === 'true') {
    require('./workers/VoiceCallWorker');
    require('./workers/VoiceTranscriptWorker');
    require('./workers/VoiceAnalyticsWorker');
    require('./workers/VoiceHealthWorker');
    require('./workers/voiceCampaignWorker');
    console.log('[Server] AI Voice Workers (Call, Transcript, Analytics, Health, Campaign) started (ENABLE_AI_VOICE_CALLING=true)');
}

app.use('/api/webhooks', webhookRoutes);
app.use('/api/metrics', require('./routes/metrics'));
app.use('/api/campaigns', campaignRoutes);
app.use('/api/templates', templateRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/contacts', contactRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/account', accountRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/chatbot', chatbotRoutes); // Maps to /api/chatbot/flows, /api/chatbot/settings
app.use('/api/autoreplies', autoRepliesRoutes);
app.use('/api/visual-flows', flowsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/admin/sms-gateways', smsGatewaysRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/meta-auth', metaAuthRoutes);
app.use('/api/integrations', integrationsRoutes);
app.use('/api/ecommerce', ecommerceRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/admin/ai', require('./routes/aiAdmin'));
app.use('/api/admin/voice', require('./routes/adminVoice'));
app.use('/api/voice', require('./routes/voice'));
app.use('/api/voice-agents', require('./routes/voiceAgents'));
app.use('/api/voice-campaigns', require('./routes/voiceCampaigns'));
app.use('/api/voice-reports', require('./routes/voiceReports'));
app.use('/api/workspace/payments', workspacePaymentRoutes);
app.use('/api/webhooks/razorpay', razorpayWebhookRoutes);
app.use('/api/webhooks/voice', require('./routes/webhooks/voiceWebhooks'));
app.use('/api/automation', automationRoutes);
app.use('/api/t', require('./routes/tracking'));

// REGISTER CENTRALIZED API V1 VERSIONING PREFIX FOR MOBILE API
const v1Router = express.Router();
v1Router.use('/auth', authRoutes);
v1Router.use('/chat', chatRoutes);
v1Router.use('/contacts', contactRoutes);
v1Router.use('/campaigns', campaignRoutes);
v1Router.use('/settings', settingsRoutes);
v1Router.use('/analytics', analyticsRoutes);
v1Router.use('/profile', profileRoutes);
v1Router.use('/account', accountRoutes);
v1Router.use('/staff', staffRoutes);
v1Router.use('/chatbot', chatbotRoutes);
v1Router.use('/autoreplies', autoRepliesRoutes);
v1Router.use('/visual-flows', flowsRoutes);
v1Router.use('/admin', adminRoutes);
v1Router.use('/payment', paymentRoutes);
v1Router.use('/meta-auth', metaAuthRoutes);
v1Router.use('/integrations', integrationsRoutes);
v1Router.use('/ecommerce', ecommerceRoutes);
v1Router.use('/ai', aiRoutes);
v1Router.use('/workspace/payments', workspacePaymentRoutes);
app.use('/api/v1', v1Router);

// Hardcoding PORT to 5005 to bypass any conflicting shell env variables (like locally exported PORT=5001)
const PORT = 5005;
server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});

// ==========================================
// PHASE 5: GRACEFUL SHUTDOWN
// ==========================================
const redisConnection = require('./services/redisConnection');

async function gracefulShutdown(signal) {
    console.log(`\n[Shutdown] Received ${signal}, starting graceful shutdown...`);

    // 1. Stop accepting new connections
    server.close(() => {
        console.log('[Shutdown] HTTP Server closed.');
    });

    try {
        // 2. Stop workers (wait for active jobs to finish)
        console.log('[Shutdown] Stopping BullMQ workers...');
        const { campaignQueue } = require('./services/CampaignQueue');
        if (campaignQueue.workers) {
            await Promise.all(campaignQueue.workers.map(w => w.close()));
        }
        
        // Ensure webhook workers are gracefully closed if they exported the instances
        if (global.webhookWorkerInstance) await global.webhookWorkerInstance.close();
        if (global.webhookReplyWorkerInstance) await global.webhookReplyWorkerInstance.close();

        // Close Payment Event Worker gracefully
        const { paymentEventWorker } = require('./workers/PaymentEventWorker');
        if (paymentEventWorker) {
            await paymentEventWorker.close();
        }

        // Close Phase B Workers gracefully
        if (process.env.FEATURE_RECOVERY === 'true') {
            const { recoveryWorker } = require('./workers/RecoveryWorker');
            if (recoveryWorker) await recoveryWorker.close().catch(() => {});
        }
        if (process.env.FEATURE_SUBSCRIPTIONS === 'true') {
            const { dunningWorker } = require('./workers/DunningWorker');
            if (dunningWorker) await dunningWorker.close().catch(() => {});
        }
        if (process.env.FEATURE_DELIVERY === 'true') {
            const { deliveryTrackingWorker } = require('./workers/DeliveryTrackingWorker');
            if (deliveryTrackingWorker) await deliveryTrackingWorker.close().catch(() => {});
        }

        // Close Voice Workers
        if (process.env.ENABLE_AI_VOICE_CALLING === 'true') {
            const voiceCallWorker = require('./workers/VoiceCallWorker');
            if (voiceCallWorker && voiceCallWorker.worker) await voiceCallWorker.worker.close().catch(() => {});
            
            const voiceTranscriptWorker = require('./workers/VoiceTranscriptWorker');
            if (voiceTranscriptWorker && voiceTranscriptWorker.worker) await voiceTranscriptWorker.worker.close().catch(() => {});

            const voiceAnalyticsWorker = require('./workers/VoiceAnalyticsWorker');
            if (voiceAnalyticsWorker && voiceAnalyticsWorker.worker) await voiceAnalyticsWorker.worker.close().catch(() => {});

            const voiceHealthWorker = require('./workers/VoiceHealthWorker');
            if (voiceHealthWorker && voiceHealthWorker.worker) await voiceHealthWorker.worker.close().catch(() => {});

            const voiceCampaignWorker = require('./workers/voiceCampaignWorker');
            if (voiceCampaignWorker && voiceCampaignWorker.campaignWorker) await voiceCampaignWorker.campaignWorker.close().catch(() => {});
        }

        // 3. Close Redis connection
        console.log('[Shutdown] Closing Redis connections...');
        await redisConnection.quit();
        
        // 4. Close Prisma
        const prisma = require('./prismaClient');
        await prisma.$disconnect();

        console.log('[Shutdown] All services stopped safely. Exiting.');
        process.exit(0);
    } catch (err) {
        console.error('[Shutdown] Error during graceful shutdown:', err);
        process.exit(1);
    }
}

// Listen for termination signals
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

process.on('uncaughtException', (err) => {
    console.error('[Fatal] Uncaught Exception:', err);
    // Don't exit immediately, let pm2/docker restart it after logging
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('[Fatal] Unhandled Rejection at:', promise, 'reason:', reason);
});
