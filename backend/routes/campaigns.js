const express = require('express');
const router = express.Router();
const prisma = require('../prismaClient');
const axios = require('axios');
const { decrypt } = require('../utils/encryption');
const checkPermission = require('../middleware/rbac');
const { getMetaConfig } = require('../utils/metaConfig');
const { campaignQueue, generateActualComponents } = require('../services/CampaignQueue');

const { authenticate } = require('../middleware/auth');
const { validateBalance, deductCredits, refundCredits } = require('../middleware/walletEngine');
const { enforceCampaignLimit } = require('../middleware/planLimits');
const { estimateCampaignDuration } = require('../services/DelayEngine');

const multer = require('multer');
const storage = multer.memoryStorage();
const upload = multer({ storage: storage, limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB limit

// generateActualComponents is now in CampaignQueue.js (single source of truth)

router.get('/', authenticate, checkPermission('MANAGE_CAMPAIGNS'), async (req, res) => {
    const userId = req.user.workspaceId;
    try {
        // Fetch campaigns + message status counts in PARALLEL
        // IMPORTANT: Do NOT use include: { messages: true } — it loads ALL message rows into RAM
        const [campaigns, messageStatusCounts] = await Promise.all([
            prisma.campaign.findMany({
                where: { userId: userId },
                include: { template: true },  // template is small, ok to include
                orderBy: { createdAt: 'desc' }
            }),
            // Single groupBy query to count messages by campaignId + status
            prisma.messageLog.groupBy({
                by: ['campaignId', 'status'],
                where: { userId: userId, campaignId: { not: null } },
                _count: { id: true }
            })
        ]);

        // Build a map: { campaignId: { SENT: N, DELIVERED: N, READ: N, FAILED: N, total: N } }
        const statsMap = {};
        for (const row of messageStatusCounts) {
            if (!row.campaignId) continue;
            if (!statsMap[row.campaignId]) {
                statsMap[row.campaignId] = { SENT: 0, DELIVERED: 0, READ: 0, FAILED: 0, PENDING: 0 };
            }
            statsMap[row.campaignId][row.status] = row._count.id;
        }

        const formattedCampaigns = campaigns.map(c => {
            const s = statsMap[c.id] || { SENT: 0, DELIVERED: 0, READ: 0, FAILED: 0, PENDING: 0 };
            const total = Object.values(s).reduce((a, b) => a + b, 0);
            const sent = (s.SENT || 0) + (s.DELIVERED || 0) + (s.READ || 0);
            const delivered = (s.DELIVERED || 0) + (s.READ || 0);
            const read = s.READ || 0;
            const failed = s.FAILED || 0;
            const estimatedCost = (total * 0.8).toFixed(2);

            return {
                id: c.id,
                name: c.name,
                templateName: c.template?.name || 'Unknown',
                status: c.status,
                createdAt: c.createdAt,
                scheduledAt: c.scheduledAt,
                stats: { total, sent, delivered, read, failed },
                estimatedCost
            };
        });

        res.status(200).json(formattedCampaigns);
    } catch (e) {
        console.error("Error fetching campaigns:", e);
        res.status(500).json({ error: "Failed to fetch campaigns" });
    }
});

// Create and execute a campaign
router.post('/create', authenticate, checkPermission('MANAGE_CAMPAIGNS'), enforceCampaignLimit, async (req, res) => {
    const { name, templateId, tags, targetPhones, variablesConfig, mediaUrl, scheduledAt, enableClickTracking } = req.body;
    const userId = req.user.workspaceId;

    try {
        // 1. Get credentials
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user?.wabaId || !user?.metaToken || !user?.phoneNumberId) {
            return res.status(400).json({ error: "Meta credentials not configured." });
        }
        const decryptedToken = decrypt(user.metaToken);

        // 2. Validate template
        const template = await prisma.template.findFirst({
            where: { id: templateId, userId: userId }
        });
        if (!template) return res.status(404).json({ error: "Template not found" });

        // 3. Fetch contacts
        let contactFilter = { userId: userId, optOut: false };
        if (targetPhones && targetPhones.length > 0) {
            // Normalize phone numbers: MessageLog stores recipients without '+' (digits only),
            // but the Contact table stores phones WITH '+' (e.g. +919876543210).
            // We normalize here so both formats resolve to the correct contacts.
            const normalizedPhones = targetPhones.map(p => {
                const digits = p.toString().replace(/[^\d]/g, '');
                return digits ? '+' + digits : p;
            });
            contactFilter.phone = { in: normalizedPhones };
        } else if (tags && tags.length > 0) {
            // Find contacts that have at least one of the tags
            contactFilter.tags = {
                hasSome: tags
            };
        }
        const contacts = await prisma.contact.findMany({ where: contactFilter });
        if (contacts.length === 0) return res.status(400).json({ error: "No contacts match the criteria." });

        // 4. Wallet Check and Bulk Deduction
        const rateCategory = template.category ? template.category.toUpperCase() : 'MARKETING';
        try {
            await validateBalance(userId, rateCategory, contacts.length);
        } catch (walletErr) {
            return res.status(403).json({ error: walletErr.message });
        }
        await deductCredits(userId, rateCategory, contacts.length, `Campaign bulk deduction (${contacts.length} contacts)`);

        // 5. Create Campaign Record
        const isScheduled = scheduledAt && new Date(scheduledAt) > new Date();
        const campaign = await prisma.campaign.create({
            data: {
                userId,
                name: name || `Campaign ${new Date().toISOString()}`,
                templateId,
                status: isScheduled ? 'SCHEDULED' : 'COMPLETED', // Use SCHEDULED for future, COMPLETED for instant (queueing logic follows)
                scheduledAt: isScheduled ? new Date(scheduledAt) : null,
                variablesConfig: variablesConfig || null,
                mediaUrl: mediaUrl || null,
                targetTags: tags || [],
                targetPhones: targetPhones || [],
                enableClickTracking: enableClickTracking || false
            },
            include: { template: true }
        });

        // 6. If Scheduled, Return early
        if (isScheduled) {
            return res.status(200).json({
                message: "Campaign scheduled successfully.",
                campaignId: campaign.id,
                totalContacts: contacts.length,
                status: "SCHEDULED"
            });
        }

        // 7. Send messages via Meta API (Enqueued to BullMQ) for Instant Campaigns
        // PHASE 3: Pass batchIndex so DelayEngine can calculate pacing
        for (let i = 0; i < contacts.length; i++) {
            await campaignQueue.add('send_campaign_message', {
                contact: contacts[i],
                template,
                user: {
                    phoneNumberId: user.phoneNumberId,
                    decryptedToken: decryptedToken
                },
                campaignId: campaign.id,
                userId: userId,
                variablesConfig,
                mediaUrl,
                batchIndex: i,  // PHASE 3: Used by DelayEngine
                enableClickTracking: campaign.enableClickTracking
            });
        }

        const { estimatedSeconds, messagesPerMinute } = estimateCampaignDuration(contacts.length);

        res.status(200).json({
            message: "Campaign queued successfully. Processing in background.",
            campaignId: campaign.id,
            totalContacts: contacts.length,
            successCount: contacts.length,
            failCount: 0,
            estimatedSeconds,       // Frontend can show ETA
            messagesPerMinute,
        });

    } catch (e) {
        console.error("Error creating campaign:", e);
        res.status(e.message && e.message.includes('Insufficient') ? 402 : 500).json({ error: e.message || "Internal server error" });
    }
});

// GET specific campaign with detailed message logs
router.get('/:id', authenticate, checkPermission('MANAGE_CAMPAIGNS'), async (req, res) => {
    const userId = req.user.workspaceId;
    const campaignId = req.params.id;

    try {
        const campaign = await prisma.campaign.findUnique({
            where: { id: campaignId, userId: userId },
            include: {
                template: true,
                messages: {
                    orderBy: { timestamp: 'desc' }
                }
            }
        });

        if (!campaign) {
            return res.status(404).json({ error: "Campaign not found" });
        }

        res.status(200).json(campaign);
    } catch (e) {
        console.error("Error fetching campaign details:", e);
        res.status(500).json({ error: "Failed to fetch campaign details" });
    }
});

// Cancel a scheduled campaign
router.post('/:id/cancel', authenticate, checkPermission('MANAGE_CAMPAIGNS'), async (req, res) => {
    const userId = req.user.workspaceId;
    const campaignId = req.params.id;

    try {
        const campaign = await prisma.campaign.findUnique({
            where: { id: campaignId, userId: userId },
            include: { template: true }
        });

        if (!campaign) {
            return res.status(404).json({ error: "Campaign not found" });
        }

        if (campaign.status !== 'SCHEDULED') {
            return res.status(400).json({ error: "Only scheduled campaigns can be cancelled." });
        }

        // Fetch how many contacts were targeted to refund credits
        let contactFilter = { userId: userId, optOut: false };
        if (campaign.targetPhones && campaign.targetPhones.length > 0) {
            contactFilter.phone = { in: campaign.targetPhones };
        } else if (campaign.targetTags && campaign.targetTags.length > 0) {
            contactFilter.tags = { hasSome: campaign.targetTags };
        }
        const contacts = await prisma.contact.count({ where: contactFilter });

        // Update status to CANCELLED
        await prisma.campaign.update({
            where: { id: campaignId },
            data: { status: 'CANCELLED' }
        });

        // Refund credits
        if (contacts > 0) {
            const rateCategory = campaign.template?.category ? campaign.template.category.toUpperCase() : 'MARKETING';
            await refundCredits(userId, rateCategory, contacts, `Refund for cancelled scheduled campaign (${contacts} contacts)`);
        }

        res.status(200).json({ message: "Campaign cancelled successfully and credits refunded." });
    } catch (e) {
        console.error("Error cancelling campaign:", e);
        res.status(500).json({ error: "Failed to cancel campaign" });
    }
});

// Upload Media for Campaigns (Drag and Drop)
router.post('/upload', authenticate, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: "No file uploaded" });
        }

        const userId = req.user?.workspaceId || req.user?.id;
        const user = await prisma.user.findUnique({ where: { id: userId } });
        const mockUrl = `https://whatchamp.com/mock-media/${encodeURIComponent(req.file.originalname || 'video.mp4')}`;
        const mockId = "media_" + Date.now();

        if (!user || !user.metaToken || !user.phoneNumberId) {
            return res.status(200).json({ mediaId: mockId, mediaUrl: mockUrl, url: mockUrl });
        }

        const decryptedToken = decrypt(user.metaToken);
        const { uploadMedia } = require('../services/MetaApiService');
        const uploadRes = await uploadMedia({
            phoneNumberId: user.phoneNumberId,
            token: decryptedToken,
            buffer: req.file.buffer,
            filename: req.file.originalname,
            mimeType: req.file.mimetype
        });

        res.status(200).json({ 
            mediaId: uploadRes.mediaId, 
            mediaUrl: uploadRes.mediaUrl || `https://whatchamp.com/media/${uploadRes.mediaId}`,
            url: uploadRes.mediaUrl || `https://whatchamp.com/media/${uploadRes.mediaId}`
        });
    } catch (err) {
        console.error("Campaign media upload exception:", err.response?.data || err.message);
        const errorMsg = err.response?.data?.error?.message || err.message || "Failed to upload media to Meta.";
        res.status(400).json({ error: errorMsg });
    }
});

// GET /api/campaigns/media/:mediaId - Proxy download from Meta Graph API
router.get('/media/:mediaId', authenticate, async (req, res) => {
    const { mediaId } = req.params;
    const userId = req.user?.workspaceId || req.user?.id;

    if (!mediaId || mediaId.startsWith('media_')) {
        // Return a default/fallback image if it's a mock ID
        return res.redirect('https://upload.wikimedia.org/wikipedia/commons/a/a9/Example.jpg');
    }

    try {
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user || !user.metaToken || !user.phoneNumberId) {
            return res.status(400).json({ error: "Meta credentials not found." });
        }

        const decryptedToken = decrypt(user.metaToken);
        const { getMetaConfig } = require('../utils/metaConfig');
        const { version } = await getMetaConfig();

        // 1. Get media URL from Meta Graph API
        const mediaMetadataRes = await axios.get(
            `https://graph.facebook.com/${version}/${mediaId}`,
            {
                headers: { 'Authorization': `Bearer ${decryptedToken}` }
            }
        );

        const { url: downloadUrl, mime_type: mimeType } = mediaMetadataRes.data;

        if (!downloadUrl) {
            return res.status(404).json({ error: "Media URL not found on Meta." });
        }

        // 2. Download raw media binary stream
        const mediaStreamRes = await axios.get(downloadUrl, {
            headers: { 'Authorization': `Bearer ${decryptedToken}` },
            responseType: 'stream'
        });

        // 3. Set content type and pipe stream to response
        res.setHeader('Content-Type', mimeType || 'application/octet-stream');
        mediaStreamRes.data.pipe(res);
    } catch (err) {
        console.error("Error proxying Meta media:", err.response?.data || err.message);
        res.status(500).json({ error: "Failed to download media from Meta." });
    }
});


// Test a template campaign on a single number
router.post('/test', authenticate, async (req, res) => {
    const { templateId, testNumber, variablesConfig, mediaUrl } = req.body;

    // DEBUG LOGGING
    console.log(`[Campaign Test] Request User:`, JSON.stringify(req.user, null, 2));

    const userId = req.user?.workspaceId || req.user?.id;

    if (!userId) {
        console.error("[Campaign Test] User ID missing from request object");
        return res.status(500).json({ error: "User context missing" });
    }

    if (!templateId || !testNumber) {
        return res.status(400).json({ error: "Template and Test Number are required." });
    }

    try {
        const user = await prisma.user.findUnique({ where: { id: userId } });

        if (!user) {
            console.error(`[Campaign Test] User not found in DB: ${userId}`);
            return res.status(404).json({ error: "User record not found" });
        }

        if (!user.wabaId || !user.metaToken || !user.phoneNumberId) {
            console.error(`[Campaign Test] Meta credentials missing for user: ${userId}`);
            return res.status(400).json({ error: "Meta credentials not configured." });
        }
        const decryptedToken = decrypt(user.metaToken);

        const template = await prisma.template.findFirst({
            where: { id: templateId, userId: userId }
        });
        if (!template) return res.status(404).json({ error: "Template not found" });

        // Ensure we don't send duplicate `+` like `++91`
        const cleanPhone = testNumber.replace(/[^\d]/g, ''); // Strip ALL non-digits, including any existing `+`

        const { version } = await getMetaConfig();
        
        const templatePayload = {
            name: template.name,
            language: { code: template.language }
        };
        
        const dynamicComponents = generateActualComponents(template.components, { name: "Test User" }, variablesConfig, mediaUrl);
        if (dynamicComponents.length > 0) {
            templatePayload.components = dynamicComponents;
        }

        const response = await axios.post(
            `https://graph.facebook.com/${version}/${user.phoneNumberId}/messages`,
            {
                messaging_product: "whatsapp",
                to: cleanPhone, // Send pure number string without `+` prefixes
                type: "template",
                template: templatePayload
            },
            { headers: { Authorization: `Bearer ${decryptedToken}` } }
        );

        const messageId = response.data.messages[0].id;

        res.status(200).json({ message: "Test message sent successfully", messageId });

    } catch (e) {
        console.error("Error sending test message:", e.response?.data || e.message);
        res.status(500).json({ error: e.response?.data?.error?.message || "Failed to send test message" });
    }
});

module.exports = router;
