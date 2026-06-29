const express = require('express');
const router = express.Router();
const AutomationMessagingService = require('../services/AutomationMessagingService');
const logger = require('../services/logger');

// POST /api/automation/send-link
// Universal provider-agnostic automation entrypoint
router.post('/send-link', async (req, res) => {
    try {
        const { customerPhone, message, demoType, source } = req.body;

        // Resolve API key / Workspace ID from multiple potential incoming locations
        let apiKey = req.query.apiKey || req.body.apiKey;
        let workspaceId = req.query.workspaceId || req.body.workspaceId;

        // Check standard Authorization: Bearer Header
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.split(' ')[1];
            if (token.startsWith('sk_live_') || token.startsWith('sk_test_')) {
                apiKey = token;
            }
        }

        // Check custom API Key header
        const xApiKey = req.headers['x-api-key'];
        if (xApiKey) {
            apiKey = xApiKey;
        }

        // Fallback to Express router request context user if already authenticated via session/JWT
        if (req.user && req.user.workspaceId) {
            workspaceId = req.user.workspaceId;
        }

        const io = req.app.get('io');

        logger.info('[AutomationRoute] Received universal send-link webhook request', {
            source,
            customerPhone,
            demoType,
            hasApiKey: !!apiKey,
            hasWorkspaceId: !!workspaceId
        });

        // Trigger our centralized messaging service
        const result = await AutomationMessagingService.sendLink({
            customerPhone,
            message,
            demoType,
            source,
            apiKey,
            workspaceId
        }, io);

        logger.info('[AutomationRoute] Request resolved with status', {
            status: result.status,
            success: result.success
        });

        // Absolute safe failure: Always return 200 success: true to webhook caller
        return res.status(200).json({ success: true });

    } catch (error) {
        // Safe internal logging: No traces are ever returned or exposed to the public
        logger.error('[AutomationRoute] Silent global route failure occurred and was masked successfully', {
            error: error.message,
            stack: error.stack
        });

        return res.status(200).json({ success: true });
    }
});

module.exports = router;
