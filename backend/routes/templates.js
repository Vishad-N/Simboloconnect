const express = require('express');
const router = express.Router();
const prisma = require('../prismaClient');
const axios = require('axios');
const { decrypt } = require('../utils/encryption');
const { getMetaConfig } = require('../utils/metaConfig');

const { authenticate } = require('../middleware/auth');
const checkPermission = require('../middleware/rbac');

router.post('/sync', authenticate, checkPermission('MANAGE_TEMPLATES'), async (req, res) => {
    const userId = req.user.workspaceId;

    try {
        // 1. Get User's API Credentials
        const user = await prisma.user.findUnique({
            where: { id: userId }
        });

        if (!user || !user.wabaId || !user.metaToken) {
            return res.status(400).json({ error: "WhatsApp Business Account ID or Meta Token not configured." });
        }

        const decryptedToken = decrypt(user.metaToken);
        const wabaId = user.wabaId;

        // 2. Fetch templates from Meta Graph API
        const { version } = await getMetaConfig();
        const response = await axios.get(`https://graph.facebook.com/${version}/${wabaId}/message_templates`, {
            headers: {
                Authorization: `Bearer ${decryptedToken}`
            }
        });

        const templates = response.data.data;

        if (!templates || templates.length === 0) {
            return res.status(200).json({ message: "No templates found on Meta.", synced: 0 });
        }

        // 3. Upsert Templates into Database ensuring customer_id (userId) isolation
        let syncedCount = 0;
        for (const t of templates) {
            // Check if template already exists
            const existing = await prisma.template.findFirst({
                where: {
                    userId: userId,
                    name: t.name,
                    language: t.language
                }
            });

            const templateData = {
                userId: userId,
                name: t.name,
                language: t.language,
                category: t.category,
                body: t.components.find(c => c.type === 'BODY')?.text || '',
                status: t.status,
                components: t.components
            };

            if (existing) {
                // Update
                await prisma.template.update({
                    where: { id: existing.id },
                    data: templateData
                });
            } else {
                // Create
                await prisma.template.create({
                    data: templateData
                });
            }

            // Also update matching EcomTemplate status
            try {
                await prisma.ecomTemplate.updateMany({
                    where: {
                        userId: userId,
                        name: t.name,
                        language: t.language
                    },
                    data: {
                        status: t.status
                    }
                });
            } catch (ecomSyncErr) {
                console.warn(`[Templates Sync] Failed to sync EcomTemplate status for ${t.name}:`, ecomSyncErr.message);
            }

            syncedCount++;
        }

        res.status(200).json({
            message: "Templates synced successfully",
            synced: syncedCount
        });

    } catch (e) {
        console.error("Error syncing templates:", e.response?.data || e.message);
        res.status(500).json({ error: "Failed to sync templates from Meta" });
    }
});
// Fetch User Templates from DB
router.get('/', authenticate, checkPermission('MANAGE_TEMPLATES'), async (req, res) => {
    const userId = req.user.workspaceId;
    console.log(`[Templates] Fetching for user: ${userId} (${req.user.email})`);
    try {
        const templates = await prisma.template.findMany({
            where: { userId: userId },
            orderBy: { createdAt: 'desc' }
        });
        console.log(`[Templates] Found ${templates.length} templates.`);
        res.status(200).json(templates);
    } catch (e) {
        console.error("Error fetching templates:", e);
        res.status(500).json({ error: "Failed to fetch templates" });
    }
});

// Create a new template and send to Meta
router.post('/create', authenticate, checkPermission('MANAGE_TEMPLATES'), async (req, res) => {
    const userId = req.user.workspaceId;
    const { name, category, language, components } = req.body;

    try {
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user || !user.wabaId || !user.metaToken) {
            return res.status(400).json({ error: "Meta API credentials not configured." });
        }

        const decryptedToken = decrypt(user.metaToken);

        // 2. Upload media if present
        if (req.body.headerFile && req.body.headerFileName && req.body.headerMimeType) {
            try {
                const base64Data = req.body.headerFile.split(',')[1];
                const buffer = Buffer.from(base64Data, 'base64');
                const { version } = await getMetaConfig();
                
                let targetAppId = user.metaAppId;
                if (!targetAppId) {
                    const platformSetting = await prisma.systemSetting.findUnique({ where: { key: 'DEFAULT_META_APP_ID' } });
                    targetAppId = platformSetting ? platformSetting.value : null;
                }

                if (!targetAppId) {
                    return res.status(400).json({ error: "Meta App ID is missing. Please configure your Meta App ID in Settings to upload media templates." });
                }

                // 1. Create Upload Session
                const sessionRes = await axios.post(
                    `https://graph.facebook.com/${version}/${targetAppId}/uploads?file_length=${buffer.length}&file_type=${req.body.headerMimeType}`,
                    {},
                    { headers: { Authorization: `Bearer ${decryptedToken}` } }
                );

                const sessionData = sessionRes.data;

                // 2. Upload Binary Bytes
                const uploadRes = await axios.post(
                    `https://graph.facebook.com/${version}/${sessionData.id}`,
                    buffer,
                    {
                        headers: {
                            Authorization: `OAuth ${decryptedToken}`,
                            'file_offset': 0,
                            'Content-Type': 'application/octet-stream'
                        }
                    }
                );

                const uploadData = uploadRes.data;

                // Attach example handle to component
                const headerComp = components.find(c => c.type === 'HEADER');
                if (headerComp) {
                    headerComp.example = {
                        header_handle: [uploadData.h]
                    };
                }
            } catch (err) {
                console.error("Media upload exception for template:", err.response?.data || err.message);
                const metaErrMsg = err.response?.data?.error?.message || err.message;
                return res.status(500).json({ error: `Meta Media Upload Failed: ${metaErrMsg}` });
            }
        }

        const payload = {
            name: name,
            category: category,
            language: language,
            components: components // The exact JSON structure generated by the UI
        };

        // Send to Meta API
        const { version } = await getMetaConfig();
        await axios.post(
            `https://graph.facebook.com/${version}/${user.wabaId}/message_templates`,
            payload,
            { headers: { Authorization: `Bearer ${decryptedToken}` } }
        );

        // Find BODY text for summary purposes in DB
        const bodyText = components?.find(c => c.type === 'BODY')?.text || '';

        // Save placeholder in local DB as PENDING
        const newTemplate = await prisma.template.create({
            data: {
                userId: userId,
                name: name,
                category: category,
                language: language,
                body: bodyText,
                status: 'PENDING',
                components: components
            }
        });

        res.status(200).json({ success: true, data: newTemplate });

    } catch (error) {
        console.error("Meta Template Creation Error:", error.response?.data || error.message);
        
        let errorMessage = "Failed to create template";
        if (error.response && error.response.data && error.response.data.error) {
            const metaErr = error.response.data.error;
            errorMessage = metaErr.error_user_msg || metaErr.message || metaErr.error_user_title || "Unknown Meta API error";
            
            if (metaErr.details) {
                errorMessage += `\nDetails: ${metaErr.details}`;
            }
        } else if (error.message) {
            errorMessage = error.message;
        }

        res.status(500).json({ error: errorMessage });
    }
});

// Delete a template
router.delete('/:name', authenticate, checkPermission('MANAGE_TEMPLATES'), async (req, res) => {
    const userId = req.user.workspaceId;
    const templateName = req.params.name;

    try {
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user || !user.wabaId || !user.metaToken) {
            return res.status(400).json({ error: "Meta API credentials not configured." });
        }

        const decryptedToken = decrypt(user.metaToken);
        const { version } = await getMetaConfig();

        // Delete from Meta API
        try {
            await axios.delete(
                `https://graph.facebook.com/${version}/${user.wabaId}/message_templates?name=${templateName}`,
                { headers: { Authorization: `Bearer ${decryptedToken}` } }
            );
        } catch (metaErr) {
            console.warn("Could not delete from Meta API (might be already deleted or not exist). proceeding to local deletion.", metaErr.response?.data || metaErr.message);
        }

        // Delete from local DB
        await prisma.template.deleteMany({
            where: {
                userId: userId,
                name: templateName
            }
        });

        res.status(200).json({ success: true, message: "Template deleted successfully" });
    } catch (error) {
        console.error("Meta Template Deletion Error:", error);
        res.status(500).json({ error: "Failed to delete template" });
    }
});

module.exports = router;
