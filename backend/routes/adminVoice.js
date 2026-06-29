const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { authenticate, checkSuperAdmin } = require('../middleware/auth');
const VoiceAnalyticsService = require('../services/voice/VoiceAnalyticsService');

// All routes require SUPERADMIN authorization
router.use(authenticate, checkSuperAdmin);

// GET all providers
router.get('/providers', async (req, res) => {
  try {
    const providers = await prisma.voiceProvider.findMany({
      orderBy: { priority: 'asc' }
    });
    res.json(providers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PATCH update provider configuration
router.patch('/providers/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { enabled, priority, sandboxMode, cooldownSeconds } = req.body;
    const data = {};
    if (enabled !== undefined) data.enabled = enabled;
    if (priority !== undefined) data.priority = priority;
    if (sandboxMode !== undefined) data.sandboxMode = sandboxMode;
    if (cooldownSeconds !== undefined) data.cooldownSeconds = cooldownSeconds;
    
    const provider = await prisma.voiceProvider.update({
      where: { id },
      data
    });
    res.json(provider);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET global voice metrics & usage stats
router.get('/usage', async (req, res) => {
  try {
    const stats = await VoiceAnalyticsService.getGlobalAnalytics();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET per-tenant aggregated usage list
router.get('/usage/tenants', async (req, res) => {
  try {
    const data = await prisma.voiceUsage.findMany({
      select: {
        userId: true,
        dailyMinutes: true,
        monthlyMinutes: true,
        totalCalls: true,
        concurrentCalls: true
      }
    });
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
