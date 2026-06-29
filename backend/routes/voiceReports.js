const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { authenticate } = require('../middleware/auth');

router.get('/dashboard', authenticate, async (req, res) => {
    const userId = req.user.workspaceId || req.user.id;
    try {
        const campaigns = await prisma.voiceCampaign.findMany({
            where: { userId }
        });

        const calls = await prisma.voiceCallSession.findMany({
            where: { userId }
        });

        const totalCampaigns = campaigns.length;
        const totalCalls = campaigns.reduce((sum, c) => sum + (c.dialedCount || 0), 0) || calls.length;
        const answeredCalls = campaigns.reduce((sum, c) => sum + (c.answeredCount || 0), 0) || calls.filter(c => ['in-progress', 'completed', 'answered'].includes(c.status)).length;
        const completedCalls = campaigns.reduce((sum, c) => sum + (c.completedCount || 0), 0) || calls.filter(c => c.status === 'completed').length;
        const totalMinutes = campaigns.reduce((sum, c) => sum + (c.totalMinutes || 0), 0) || Math.floor(calls.reduce((s, c) => s + (c.durationSeconds || 0), 0) / 60);
        const totalCost = campaigns.reduce((sum, c) => sum + Number(c.totalCost || 0), 0);
        const failedCalls = campaigns.reduce((sum, c) => sum + (c.failedCount || 0), 0) || calls.filter(c => ['failed', 'busy', 'no-answer'].includes(c.status)).length;

        // Calls by Day
        const callsByDayMap = {};
        calls.forEach(call => {
            const date = new Date(call.createdAt).toISOString().split('T')[0];
            callsByDayMap[date] = (callsByDayMap[date] || 0) + 1;
        });
        const callsByDay = Object.keys(callsByDayMap).sort().slice(-7).map(date => ({
            name: new Date(date).toLocaleDateString('en-US', { weekday: 'short' }),
            calls: callsByDayMap[date]
        }));

        // Provider Usage
        const providerUsageMap = {};
        calls.forEach(call => {
            const p = call.provider;
            providerUsageMap[p] = (providerUsageMap[p] || 0) + 1;
        });
        const providerUsage = Object.keys(providerUsageMap).map(p => ({
            name: p.charAt(0).toUpperCase() + p.slice(1),
            value: providerUsageMap[p]
        }));

        // Success Rate Pie Chart
        const successRateChart = [
            { name: 'Completed', value: completedCalls },
            { name: 'Failed', value: failedCalls },
            { name: 'Other', value: totalCalls - completedCalls - failedCalls }
        ].filter(i => i.value > 0);

        res.json({
            totalCampaigns,
            totalCalls,
            answeredCalls,
            completedCalls,
            failedCalls,
            totalMinutes,
            totalCost,
            successRate: totalCalls > 0 ? ((completedCalls / totalCalls) * 100).toFixed(2) : 0,
            charts: {
                callsByDay: callsByDay.length ? callsByDay : [{name: 'Mon', calls: 0}],
                providerUsage: providerUsage.length ? providerUsage : [{name: 'None', value: 1}],
                successRateChart: successRateChart.length ? successRateChart : [{name: 'No Data', value: 1}]
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/campaign/:id', authenticate, async (req, res) => {
    const userId = req.user.workspaceId || req.user.id;
    try {
        const campaign = await prisma.voiceCampaign.findFirst({
            where: { id: req.params.id, userId },
            include: { calls: true }
        });

        if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

        res.json(campaign);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
