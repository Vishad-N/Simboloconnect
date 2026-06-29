const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { authenticate } = require('../middleware/auth');
const VoiceProviderFactory = require('../services/voice/VoiceProviderFactory');
const VoiceTenantIsolationGuard = require('../services/voice/VoiceTenantIsolationGuard');

// List synced agents
router.get('/', authenticate, async (req, res) => {
    const userId = req.user.workspaceId || req.user.id;
    try {
        const agents = await prisma.voiceAgent.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' }
        });
        res.json(agents);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Sync agents from a specific provider
router.post('/sync/:providerSlug', authenticate, async (req, res) => {
    const userId = req.user.workspaceId || req.user.id;
    try {
        const { providerSlug } = req.params;

        const userProvider = await prisma.userVoiceProvider.findFirst({
            where: { userId, provider: { slug: providerSlug } },
            include: { provider: true }
        });

        if (!userProvider) {
            return res.status(404).json({ error: `Provider configuration not found for ${providerSlug}` });
        }

        const decryptedApiKey = VoiceTenantIsolationGuard.decrypt(userProvider.encryptedApiKey);
        if (!decryptedApiKey) {
            return res.status(400).json({ error: 'Invalid API key configuration' });
        }

        const voiceAdapter = VoiceProviderFactory.getProvider(
            providerSlug,
            decryptedApiKey,
            null
        );

        let remoteAgents = [];
        try {
            remoteAgents = await voiceAdapter.syncAgents();
        } catch (err) {
            return res.status(500).json({ error: `Failed to fetch agents from provider: ${err.message}` });
        }

        const syncedAgents = [];
        for (const agent of remoteAgents) {
            const upserted = await prisma.voiceAgent.upsert({
                where: {
                    userId_providerId_providerAgentId: {
                        userId,
                        providerId: userProvider.providerId,
                        providerAgentId: agent.id
                    }
                },
                update: {
                    name: agent.name,
                    voiceName: agent.voice,
                    language: agent.language,
                    status: 'active'
                },
                create: {
                    userId,
                    providerId: userProvider.providerId,
                    providerAgentId: agent.id,
                    name: agent.name,
                    voiceName: agent.voice,
                    language: agent.language,
                    status: 'active'
                }
            });
            syncedAgents.push(upserted);
        }

        res.json({ success: true, count: syncedAgents.length, agents: syncedAgents });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
