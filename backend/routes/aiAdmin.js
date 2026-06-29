const express = require('express');
const router = express.Router();
const prisma = require('../prismaClient');
const { authenticate, checkSuperAdmin } = require('../middleware/auth');

router.use(authenticate, checkSuperAdmin);

// GET /api/admin/ai/overview
router.get('/overview', async (req, res) => {
    try {
        const totalWorkspaces = await prisma.user.count({ where: { role: 'USER' } });
        const activeWorkspaces = await prisma.user.count({ where: { role: 'USER', botEnabled: true } });
        const totalActions = await prisma.aiActionLog.count();
        const failedActions = await prisma.aiActionLog.count({ where: { status: 'FAILED' } });
        const escalations = await prisma.aiActionLog.count({ where: { toolName: 'escalate_to_human' } });
        
        const usageStats = await prisma.aiUsageLog.aggregate({
            _sum: { totalTokens: true, estimatedCost: true }
        });

        res.json({
            totalWorkspaces,
            activeWorkspaces,
            totalActions,
            failedActions,
            escalations,
            totalTokens: usageStats._sum.totalTokens || 0,
            estimatedCost: usageStats._sum.estimatedCost || 0,
            health: {
                redis: 'Operational',
                openai: 'Operational',
                bullmq: 'Operational'
            }
        });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: "Failed to load admin AI overview" });
    }
});

// GET /api/admin/ai/workspaces
router.get('/workspaces', async (req, res) => {
    try {
        const users = await prisma.user.findMany({
            where: { role: 'USER' },
            select: {
                id: true,
                name: true,
                email: true,
                botEnabled: true,
                aiProvider: true,
                aiModel: true,
                aiAgent: {
                    select: { useOwnAi: true, sandboxMode: true }
                },
                _count: {
                    select: { aiActionLogs: true }
                }
            },
            take: 100
        });
        res.json(users);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: "Failed to load workspaces" });
    }
});

// GET /api/admin/ai/logs
router.get('/logs', async (req, res) => {
    try {
        const logs = await prisma.aiActionLog.findMany({
            orderBy: { executedAt: 'desc' },
            take: 200,
            include: {
                user: { select: { name: true, email: true } }
            }
        });
        res.json(logs);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: "Failed to load global AI logs" });
    }
});

// GET /api/admin/ai/security
router.get('/security', async (req, res) => {
    try {
        // Mocking security alerts for now since strict validation is built-in
        const alerts = await prisma.aiActionLog.findMany({
            where: { status: 'REJECTED' },
            orderBy: { executedAt: 'desc' },
            take: 50,
            include: { user: { select: { name: true } } }
        });

        res.json({
            alerts,
            stats: {
                promptInjections: 0,
                failedValidations: alerts.length,
                rateLimitBreaches: 0 // Tracked in Redis currently
            }
        });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: "Failed to load security logs" });
    }
});

// POST /api/admin/ai/workspaces/:id/toggle
router.post('/workspaces/:id/toggle', async (req, res) => {
    try {
        const { botEnabled } = req.body;
        await prisma.user.update({
            where: { id: req.params.id },
            data: { botEnabled }
        });
        res.json({ success: true });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: "Failed to toggle workspace AI" });
    }
});

module.exports = router;
