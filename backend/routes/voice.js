const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { authenticate } = require('../middleware/auth');
const checkPermission = require('../middleware/rbac');
const VoiceTenantIsolationGuard = require('../services/voice/VoiceTenantIsolationGuard');
const WorkingHoursService = require('../services/voice/WorkingHoursService');
const VoiceAnalyticsService = require('../services/voice/VoiceAnalyticsService');
const VoiceSandboxSimulator = require('../services/voice/VoiceSandboxSimulator');
const VoiceOrchestrator = require('../services/voice/VoiceOrchestrator');
const VoiceRoutingEngine = require('../services/voice/VoiceRoutingEngine');
const VoiceProviderHealthMonitor = require('../services/voice/VoiceProviderHealthMonitor');

// Get allowed providers configured with user encrypted configurations
router.get('/providers', authenticate, async (req, res) => {
  const userId = req.user.workspaceId || req.user.id;
  try {
    const providers = await prisma.voiceProvider.findMany({
      where: { enabled: true }
    });
    
    const userConfigs = await prisma.userVoiceProvider.findMany({
      where: { userId }
    });

    // Also fetch agent counts per provider for this user
    const agents = await prisma.voiceAgent.findMany({
      where: { userId }
    });

    const merged = providers.map(p => {
      const config = userConfigs.find(uc => uc.providerId === p.id);
      const providerAgents = agents.filter(a => a.providerId === p.id);
      let decryptedApiKey = '';
      let decryptedAgentId = '';
      let decryptedVoiceId = '';
      if (config) {
        try {
          decryptedApiKey = VoiceTenantIsolationGuard.decrypt(config.encryptedApiKey);
          decryptedAgentId = VoiceTenantIsolationGuard.decrypt(config.encryptedAgentId);
          if (config.encryptedVoiceId) {
            decryptedVoiceId = VoiceTenantIsolationGuard.decrypt(config.encryptedVoiceId);
          }
        } catch {}
      }
      return {
        ...p,
        userConfig: config ? {
          id: config.id,
          active: config.active,
          apiKeyConfigured: !!decryptedApiKey,
          apiKey: '',
          agentId: decryptedAgentId,
          voiceId: decryptedVoiceId
        } : null,
        agentCount: providerAgents.length,
        lastSyncAt: providerAgents.length > 0 
            ? new Date(Math.max(...providerAgents.map(a => new Date(a.updatedAt).getTime()))).toISOString() 
            : null
      };
    });

    res.json(merged);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Save user provider config with encryption
router.post('/providers/:providerId/config', authenticate, async (req, res) => {
  const userId = req.user.workspaceId || req.user.id;
  try {
    const { providerId } = req.params;
    const { apiKey, agentId, voiceId, active } = req.body;

    const encryptedAgentId = VoiceTenantIsolationGuard.encrypt(agentId);
    const encryptedVoiceId = voiceId ? VoiceTenantIsolationGuard.encrypt(voiceId) : null;
    
    let config = await prisma.userVoiceProvider.findFirst({
      where: { userId, providerId }
    });

    if (config) {
      const updateData = {
        active: active ?? true
      };

      if (encryptedAgentId) updateData.encryptedAgentId = encryptedAgentId;
      if (encryptedVoiceId) updateData.encryptedVoiceId = encryptedVoiceId;
      if (apiKey && apiKey.trim() !== '') {
        updateData.encryptedApiKey = VoiceTenantIsolationGuard.encrypt(apiKey);
      }

      config = await prisma.userVoiceProvider.update({
        where: { id: config.id },
        data: updateData
      });
    } else {
      if (!apiKey || apiKey.trim() === '') {
        return res.status(400).json({ error: 'A valid API Key is required for new configurations.' });
      }
      config = await prisma.userVoiceProvider.create({
        data: {
          userId,
          providerId,
          encryptedApiKey: VoiceTenantIsolationGuard.encrypt(apiKey),
          encryptedAgentId,
          encryptedVoiceId,
          active: active ?? true
        }
      });
    }

    res.json({ success: true, message: 'Provider configured and encrypted successfully.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete user provider config
router.delete('/providers/:providerId/config', authenticate, async (req, res) => {
  const userId = req.user.workspaceId || req.user.id;
  try {
    const { providerId } = req.params;
    await prisma.userVoiceProvider.deleteMany({
      where: { userId, providerId }
    });
    res.json({ success: true, message: 'Provider configuration removed.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Test call for a specific voice provider
router.post('/providers/:providerId/test-call', authenticate, async (req, res) => {
  const userId = req.user.workspaceId || req.user.id;
  try {
    const { providerId } = req.params;
    const { phone } = req.body;
    if (!phone) {
      return res.status(400).json({ error: 'Phone number is required for test call.' });
    }

    // Format phone to E.164 (with leading +)
    let formattedPhone = (phone || '').trim();
    if (formattedPhone && !formattedPhone.startsWith('+')) {
      const digitsOnly = formattedPhone.replace(/\D/g, '');
      if (digitsOnly) {
        formattedPhone = '+' + digitsOnly;
      }
    }

    // 1. Get specific provider adapter
    const { adapter, providerSlug } = await VoiceRoutingEngine.getSpecificProvider(userId, providerId);

    // 2. Resolve / Create contact for log reference
    let contact = await prisma.contact.findFirst({
      where: { userId, phone: formattedPhone }
    });
    if (!contact) {
      contact = await prisma.contact.create({
        data: {
          userId,
          phone: formattedPhone,
          name: 'Manual Voice Tester'
        }
      });
    }

    const context = {
      name: contact.name,
      intent: 'Manual Call Test',
      summary: 'This is a manual testing outbound call triggered by workspace admin to verify API credentials and Voice Agent connectivity.',
      userId
    };

    // 3. Initiate API Call via specific adapter
    const startTime = Date.now();
    const response = await adapter.initiateCall(formattedPhone, null, context);

    // 4. Log Session in database
    const session = await prisma.voiceCallSession.create({
      data: {
        userId,
        contactId: contact.id,
        provider: providerSlug,
        externalCallId: response.externalCallId,
        direction: 'OUTBOUND',
        status: response.status || 'INITIATED',
        metadata: {
          ...context,
          initiatedAt: new Date().toISOString()
        }
      }
    });

    // 5. Log provider success
    await VoiceProviderHealthMonitor.logSuccess(providerSlug, Date.now() - startTime);

    res.json({ success: true, message: 'Test call initiated successfully!', session });
  } catch (error) {
    console.error('[Voice test-call] Failed:', error.message);
    const details = error.response?.data?.message || error.response?.data?.error || error.response?.data || error.message;
    res.status(500).json({ error: typeof details === 'object' ? JSON.stringify(details) : details });
  }
});

// Working Hours Configuration
router.get('/working-hours', authenticate, async (req, res) => {
  const userId = req.user.workspaceId || req.user.id;
  try {
    const config = await WorkingHoursService.getConfig(userId);
    res.json(config);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/working-hours', authenticate, async (req, res) => {
  const userId = req.user.workspaceId || req.user.id;
  try {
    const config = await WorkingHoursService.saveConfig(userId, req.body);
    res.json({ success: true, config });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Sandbox Outbound Call Simulator
router.post('/sandbox/call', authenticate, async (req, res) => {
  const userId = req.user.workspaceId || req.user.id;
  try {
    const { toPhone, simulateAction, productCategory, contactId } = req.body;
    const result = await VoiceSandboxSimulator.simulateCall(userId, toPhone, {
      simulateAction,
      productCategory,
      contactId
    });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get real calling analytics
router.get('/analytics', authenticate, async (req, res) => {
  const userId = req.user.workspaceId || req.user.id;
  try {
    const analytics = await VoiceAnalyticsService.getTenantAnalytics(userId);
    res.json(analytics);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get Billing Usage and quota details
router.get('/billing', authenticate, async (req, res) => {
  const userId = req.user.workspaceId || req.user.id;
  try {
    const quota = await prisma.voiceQuota.findUnique({ where: { userId } });
    const usage = await prisma.voiceUsage.findUnique({ where: { userId } });
    res.json({ quota, usage });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Demo Assets Configuration (GET, POST, DELETE)
router.get('/demo-assets', authenticate, async (req, res) => {
  const userId = req.user.workspaceId || req.user.id;
  try {
    const assets = await prisma.demoAsset.findMany({
      where: { userId }
    });
    res.json(assets);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/demo-assets', authenticate, async (req, res) => {
  const userId = req.user.workspaceId || req.user.id;
  try {
    const { name, productCategory, url, type } = req.body;
    const asset = await prisma.demoAsset.create({
      data: {
        userId,
        name,
        productCategory,
        url,
        type: type || 'video'
      }
    });
    res.json({ success: true, asset });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/demo-assets/:id', authenticate, async (req, res) => {
  const userId = req.user.workspaceId || req.user.id;
  try {
    await prisma.demoAsset.delete({
      where: { id: req.params.id, userId }
    });
    res.json({ success: true, message: 'Demo asset deleted.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Trigger Onboarding Call
router.post('/onboarding-call', authenticate, async (req, res) => {
  const userId = req.user.workspaceId || req.user.id;
  try {
    const { phone } = req.body;
    if (!phone) {
      return res.status(400).json({ error: 'Phone number is required.' });
    }

    // Check / Create a dummy contact if not exists for onboarding
    let contact = await prisma.contact.findFirst({
      where: { userId, phone }
    });
    if (!contact) {
      contact = await prisma.contact.create({
        data: {
          userId,
          phone,
          name: 'Onboarding Tester'
        }
      });
    }

    const session = await VoiceOrchestrator.initiateCall(userId, contact.id, phone, {
      name: 'Onboarding Tester',
      intent: 'onboarding_welcome',
      summary: 'This is an onboarding test call to demonstrate Enterprise AI voice calling capability.'
    });

    res.json({ success: true, message: 'Onboarding call initiated successfully.', session });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get call logs
router.get('/calls', authenticate, async (req, res) => {
  const userId = req.user.workspaceId || req.user.id;
  try {
    const calls = await prisma.voiceCallSession.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20
    });

    if (!calls.length) return res.json([]);

    // Manually fetch contacts to join since the Prisma relation might be missing
    const contactIds = calls.map(c => c.contactId).filter(Boolean);
    const contacts = await prisma.contact.findMany({
      where: { id: { in: contactIds } },
      select: { id: true, name: true, phone: true }
    });
    
    const contactMap = {};
    contacts.forEach(c => contactMap[c.id] = c);

    const enrichedCalls = calls.map(c => ({
      ...c,
      contact: contactMap[c.contactId] || null
    }));

    res.json(enrichedCalls);
  } catch (error) {
    console.error("Error fetching voice calls:", error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/voice/calls/:id/simulate-complete - Transitions an active call log to Completed with mock stats
router.post('/calls/:id/simulate-complete', authenticate, async (req, res) => {
  const userId = req.user.workspaceId || req.user.id;
  try {
    const { id } = req.params;
    const call = await prisma.voiceCallSession.findFirst({
      where: { id, userId }
    });
    if (!call) {
      return res.status(404).json({ error: 'Call session not found.' });
    }

    const duration = Math.floor(Math.random() * 90) + 30; // 30s to 120s
    const mockTranscripts = [
      { speaker: 'AI', message: 'Hello! I am calling from Customer Assistance. Thanks for showing interest in our platform.' },
      { speaker: 'CUSTOMER', message: 'Hi! Yes, I wanted to see if I can integrate this with my WhatsApp store.' },
      { speaker: 'AI', message: 'Absolutely! I am sending a complete integration guide directly to your WhatsApp now.' },
      { speaker: 'CUSTOMER', message: 'Great, I received it. Thank you so much!' },
      { speaker: 'AI', message: 'Awesome! Let me know if you need anything else. Have a wonderful day!' }
    ];
    const summary = 'Simulated successful sales assisting call. WhatsApp demo links sent and received successfully.';

    const updated = await prisma.voiceCallSession.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        durationSeconds: duration,
        summary,
        transcript: mockTranscripts
      }
    });

    res.json({ success: true, call: updated });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── TwiML Endpoint for Twilio Voice ───────────────────────────────────────
// Twilio calls this URL when a call connects to get instructions.
// No auth required — Twilio hits this from their servers.
router.get('/twiml', (req, res) => {
  const customerName = req.query.customerName || 'there';
  const intent = req.query.intent || '';
  const summary = req.query.summary || '';

  const greeting = intent
    ? `Hello ${customerName}! I'm your AI assistant calling regarding your recent inquiry about ${intent}.`
    : `Hello ${customerName}! I'm your AI assistant calling to help you with your recent inquiry.`;

  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Amy" language="en-GB">${greeting} How can I assist you today?</Say>
  <Pause length="1"/>
  <Gather input="speech" timeout="5" action="/api/voice/twiml/respond" method="POST" language="en-IN">
    <Say voice="Polly.Amy">Please go ahead and speak, I'm listening.</Say>
  </Gather>
  <Say voice="Polly.Amy">I didn't catch that. Please call us back or reach out via WhatsApp. Have a great day!</Say>
</Response>`;

  res.set('Content-Type', 'text/xml');
  res.send(twiml);
});

// ─── Voice Capability Check (for frontend) ─────────────────────────────────
router.get('/capability', authenticate, async (req, res) => {
  const userId = req.user.workspaceId || req.user.id;
  try {
    const VoiceCapabilityChecker = require('../services/voice/VoiceCapabilityChecker');
    const capability = await VoiceCapabilityChecker.check(userId);
    res.json(capability);
  } catch (err) {
    res.status(500).json({ canCall: false, reason: err.message });
  }
});

module.exports = router;
