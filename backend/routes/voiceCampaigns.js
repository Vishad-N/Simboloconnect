const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { authenticate } = require('../middleware/auth');
const { campaignQueue } = require('../workers/voiceCampaignWorker');

// List campaigns
router.get('/', authenticate, async (req, res) => {
    const userId = req.user.workspaceId || req.user.id;
    try {
        const campaigns = await prisma.voiceCampaign.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            include: { user: { select: { name: true } } }
        });
        res.json(campaigns);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create campaign
router.post('/', authenticate, async (req, res) => {
    const userId = req.user.workspaceId || req.user.id;
    try {
        const { name, provider, agentId, targetTags, targetPhones, scheduledAt, settings } = req.body;
        const { retryEnabled, retryCount, retryDelay, concurrency } = settings || {};

        const campaign = await prisma.voiceCampaign.create({
            data: {
                userId,
                name,
                provider,
                agentId,
                status: scheduledAt ? 'SCHEDULED' : 'DRAFT',
                targetTags: targetTags || [],
                targetPhones: targetPhones || [],
                scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
                retryEnabled: !!retryEnabled,
                retryCount: retryCount !== undefined ? parseInt(retryCount, 10) : 0,
                retryDelay: retryDelay !== undefined ? parseInt(retryDelay, 10) : 0,
                concurrentCalls: concurrency !== undefined ? parseInt(concurrency, 10) : 1
            }
        });

        // If it's a send now (not scheduled and not draft), start it
        if (!scheduledAt && req.body.startNow) {
            await campaignQueue.add(`process-${campaign.id}`, {
                type: 'PROCESS_CAMPAIGN',
                payload: { campaignId: campaign.id }
            });
            await prisma.voiceCampaign.update({
                where: { id: campaign.id },
                data: { status: 'RUNNING' }
            });
        }

        res.json({ success: true, campaign });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Start Campaign
router.post('/:id/start', authenticate, async (req, res) => {
    const userId = req.user.workspaceId || req.user.id;
    try {
        const campaign = await prisma.voiceCampaign.findFirst({
            where: { id: req.params.id, userId }
        });

        if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

        await campaignQueue.add(`process-${campaign.id}`, {
            type: 'PROCESS_CAMPAIGN',
            payload: { campaignId: campaign.id }
        });

        const updated = await prisma.voiceCampaign.update({
            where: { id: campaign.id },
            data: { status: 'RUNNING' }
        });

        res.json({ success: true, campaign: updated });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Cancel Campaign
router.post('/:id/cancel', authenticate, async (req, res) => {
    const userId = req.user.workspaceId || req.user.id;
    try {
        const campaign = await prisma.voiceCampaign.update({
            where: { id: req.params.id },
            data: { status: 'CANCELLED' }
        });
        res.json({ success: true, campaign });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get campaign call-level detail (all calls made in this campaign)
router.get('/:id/calls', authenticate, async (req, res) => {
    const userId = req.user.workspaceId || req.user.id;
    try {
        const campaign = await prisma.voiceCampaign.findFirst({
            where: { id: req.params.id, userId }
        });
        if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

        const calls = await prisma.voiceCallSession.findMany({
            where: { campaignId: req.params.id },
            orderBy: { createdAt: 'asc' }
        });

        // Enrich with contact info
        const contactIds = calls.map(c => c.contactId).filter(Boolean);
        const contacts = await prisma.contact.findMany({
            where: { id: { in: contactIds } },
            select: { id: true, name: true, phone: true, tags: true }
        });
        const contactMap = {};
        contacts.forEach(c => contactMap[c.id] = c);

        const enriched = calls.map(c => ({
            id: c.id,
            contactId: c.contactId,
            contactName: contactMap[c.contactId]?.name || 'Unknown',
            phone: contactMap[c.contactId]?.phone || '',
            tags: contactMap[c.contactId]?.tags || [],
            status: c.status,
            direction: c.direction,
            durationSeconds: c.durationSeconds || 0,
            durationFormatted: c.durationSeconds ? `${Math.floor(c.durationSeconds/60)}m ${c.durationSeconds%60}s` : '0s',
            recordingUrl: c.recordingUrl,
            externalCallId: c.externalCallId,
            summary: c.summary,
            calledAt: c.createdAt,
            provider: c.provider
        }));

        // Summary stats
        const stats = {
            total: enriched.length,
            completed: enriched.filter(c => c.status === 'COMPLETED').length,
            answered: enriched.filter(c => c.durationSeconds > 5).length,
            noAnswer: enriched.filter(c => c.status === 'NO_ANSWER').length,
            failed: enriched.filter(c => c.status === 'FAILED').length,
            busy: enriched.filter(c => c.status === 'BUSY').length,
            ringing: enriched.filter(c => c.status === 'RINGING').length,
            initiated: enriched.filter(c => c.status === 'INITIATED').length,
            totalDuration: enriched.reduce((sum, c) => sum + (c.durationSeconds || 0), 0)
        };

        res.json({ campaign, calls: enriched, stats });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Download campaign calls as CSV
router.get('/:id/download-csv', authenticate, async (req, res) => {
    const userId = req.user.workspaceId || req.user.id;
    try {
        const campaign = await prisma.voiceCampaign.findFirst({
            where: { id: req.params.id, userId }
        });
        if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

        const calls = await prisma.voiceCallSession.findMany({
            where: { campaignId: req.params.id },
            orderBy: { createdAt: 'asc' }
        });

        const contactIds = calls.map(c => c.contactId).filter(Boolean);
        const contacts = await prisma.contact.findMany({
            where: { id: { in: contactIds } },
            select: { id: true, name: true, phone: true, tags: true }
        });
        const contactMap = {};
        contacts.forEach(c => contactMap[c.id] = c);

        // Build CSV
        const headers = ['S.No', 'Contact Name', 'Phone', 'Tags', 'Call Status', 'Duration (sec)', 'Duration', 'Called At', 'Provider', 'External Call ID', 'Summary'];
        
        const rows = calls.map((c, i) => {
            const contact = contactMap[c.contactId] || {};
            const dur = c.durationSeconds || 0;
            const durFmt = dur ? `${Math.floor(dur/60)}m ${dur%60}s` : '0s';
            const calledAt = c.createdAt ? new Date(c.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : '';
            const summary = (c.summary || '').replace(/"/g, '""');
            return [
                i + 1,
                `"${contact.name || 'Unknown'}"`,
                contact.phone || '',
                `"${(contact.tags || []).join(', ')}"`,
                c.status || 'INITIATED',
                dur,
                durFmt,
                calledAt,
                c.provider || '',
                c.externalCallId || '',
                `"${summary}"`
            ].join(',');
        });

        const csv = [headers.join(','), ...rows].join('\n');
        const filename = `campaign_${campaign.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`;

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send('\uFEFF' + csv); // BOM for Excel UTF-8
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Retarget campaign — re-run on failed/unanswered contacts
router.post('/:id/retarget', authenticate, async (req, res) => {
    const userId = req.user.workspaceId || req.user.id;
    try {
        const { statuses = ['FAILED', 'NO_ANSWER', 'BUSY'] } = req.body;

        const campaign = await prisma.voiceCampaign.findFirst({
            where: { id: req.params.id, userId }
        });
        if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

        // Find calls with the specified statuses
        const failedCalls = await prisma.voiceCallSession.findMany({
            where: { campaignId: req.params.id, status: { in: statuses } }
        });

        const contactIds = [...new Set(failedCalls.map(c => c.contactId).filter(Boolean))];
        if (contactIds.length === 0) return res.json({ success: true, message: 'No contacts to retarget', count: 0 });

        // Create a new retarget campaign
        const newCampaign = await prisma.voiceCampaign.create({
            data: {
                userId,
                name: `${campaign.name} (Retarget)`,
                provider: campaign.provider,
                agentId: campaign.agentId,
                status: 'RUNNING',
                targetTags: campaign.targetTags,
                targetPhones: campaign.targetPhones,
                audienceCount: contactIds.length,
                startedAt: new Date()
            }
        });

        // Queue calls for retargeted contacts
        const contacts = await prisma.contact.findMany({
            where: { id: { in: contactIds } },
            select: { id: true, phone: true }
        });

        const { campaignQueue } = require('../workers/voiceCampaignWorker');
        for (const contact of contacts) {
            await campaignQueue.add(`retarget-call-${contact.id}`, {
                type: 'PROCESS_CALL',
                payload: {
                    campaignId: newCampaign.id,
                    contactId: contact.id,
                    phone: contact.phone,
                    userId,
                    provider: campaign.provider,
                    agentId: campaign.agentId
                }
            }, {
                jobId: `retarget-${newCampaign.id}-${contact.id}`,
                attempts: 1
            });
        }

        res.json({ success: true, newCampaignId: newCampaign.id, count: contacts.length, message: `Retargeting ${contacts.length} contacts` });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;

