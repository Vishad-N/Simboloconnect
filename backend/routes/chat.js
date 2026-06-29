const express = require('express');
const router = express.Router();
const prisma = require('../prismaClient');
const { decrypt } = require('../utils/encryption');
const axios = require('axios');
const { convertAudioBufferToOgg } = require('../utils/audioConverter');
const FormData = require('form-data');
const { getMetaConfig } = require('../utils/metaConfig');

const { authenticate } = require('../middleware/auth');
const checkPermission = require('../middleware/rbac');
const { validateBalance, deductCredits } = require('../middleware/walletEngine');

// Fetch distinct contacts the user has messaged or received messages from (FAST version)
router.get('/contacts', authenticate, checkPermission('MANAGE_CHAT'), async (req, res) => {
    const userId = req.user.workspaceId;
    try {
        // Step 1: Get top 200 most recent unique recipients using raw SQL (much faster than groupBy)
        const recentRecipients = await prisma.$queryRaw`
            SELECT DISTINCT ON (LTRIM(recipient, '+')) recipient, timestamp, direction, status, content, "messageId", id
            FROM "MessageLog"
            WHERE "userId" = ${userId} AND "visibleInChat" = true
            ORDER BY LTRIM(recipient, '+'), timestamp DESC
        `;

        if (!recentRecipients || recentRecipients.length === 0) {
            return res.status(200).json([]);
        }

        // Sort by timestamp desc, limit to 200
        recentRecipients.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        const top200 = recentRecipients.slice(0, 200);
        const allRecipients = top200.map(r => r.recipient);

        // Step 2: Batch fetch contacts + unread counts in parallel
        const normalizePhone = (p) => p ? p.toString().replace('+', '') : '';

        const phoneSearches = [];
        allRecipients.forEach(r => {
            const clean = normalizePhone(r);
            if (clean) {
                phoneSearches.push(clean);
                phoneSearches.push('+' + clean);
            }
        });

        const [contacts, unreadGroups] = await Promise.all([
            prisma.contact.findMany({
                where: { userId, phone: { in: phoneSearches } },
                select: { name: true, phone: true, bot_paused_until: true, id: true, internalNotes: true, assignedToId: true, status: true, assignedTo: { select: { name: true, email: true } } }
            }),
            prisma.messageLog.groupBy({
                by: ['recipient'],
                where: { userId, recipient: { in: phoneSearches }, direction: 'INBOUND', status: { not: 'READ' } },
                _count: { id: true }
            })
        ]);

        const contactMap = new Map(contacts.map(c => [normalizePhone(c.phone), c]));
        
        const unreadMap = new Map();
        unreadGroups.forEach(u => {
            const norm = normalizePhone(u.recipient);
            unreadMap.set(norm, (unreadMap.get(norm) || 0) + u._count.id);
        });

        const now = new Date();
        const contactsList = top200.map(log => {
            const normRecipient = normalizePhone(log.recipient);
            const contactInfo = contactMap.get(normRecipient);
            const botPaused = contactInfo?.bot_paused_until && new Date(contactInfo.bot_paused_until) > now;
            return {
                ...log,
                unreadCount: unreadMap.get(normRecipient) || 0,
                name: contactInfo?.name || log.recipient,
                botPaused: !!botPaused,
                contactId: contactInfo?.id,
                contactStatus: contactInfo?.status || 'OPEN',
                internalNotes: contactInfo?.internalNotes || '',
                assignedToId: contactInfo?.assignedToId,
                assignedToName: contactInfo?.assignedTo?.name || contactInfo?.assignedTo?.email
            };
        });

        res.status(200).json(contactsList);
    } catch (e) {
        console.error("Error fetching contacts:", e);
        res.status(500).json({ error: "Failed to fetch chat contacts." });
    }
});

// Fetch chat history for a specific recipient (V1 supports cursor-based pagination)
router.get('/:recipient', authenticate, checkPermission('MANAGE_CHAT'), async (req, res) => {
    const userId = req.user.workspaceId;
    const recipient = req.params.recipient;
    const isV1 = req.originalUrl.startsWith('/api/v1');

    try {
        const cleanRecipient = recipient.startsWith('+') ? recipient.substring(1) : recipient;
        const recipientVariants = [cleanRecipient, '+' + cleanRecipient];

        // Mark all unread messages as READ
        await prisma.messageLog.updateMany({
            where: {
                userId: userId,
                recipient: { in: recipientVariants },
                direction: 'INBOUND',
                status: 'DELIVERED'
            },
            data: { status: 'READ' }
        });

        if (isV1) {
            const cursor = req.query.cursor;
            const limit = parseInt(req.query.limit, 10) || 50;

            const queryOptions = {
                where: {
                    userId: userId,
                    recipient: { in: recipientVariants },
                    visibleInChat: true
                },
                orderBy: {
                    timestamp: 'desc'
                },
                take: limit + 1
            };

            if (cursor && cursor !== 'null' && cursor !== '') {
                queryOptions.cursor = { id: cursor };
                queryOptions.skip = 1;
            }

            const messages = await prisma.messageLog.findMany(queryOptions);
            const hasNextPage = messages.length > limit;
            const results = hasNextPage ? messages.slice(0, limit) : messages;
            const nextCursor = hasNextPage ? results[results.length - 1].id : null;

            return res.status(200).json({
                success: true,
                data: {
                    messages: results.reverse(),
                    nextCursor,
                    hasNextPage
                },
                error: null,
                timestamp: new Date().toISOString()
            });
        }

        const messages = await prisma.messageLog.findMany({
            where: {
                userId: userId,
                recipient: { in: recipientVariants },
                visibleInChat: true
            },
            orderBy: {
                timestamp: 'desc'
            },
            take: 100
        });

        res.status(200).json(messages.reverse());
    } catch (e) {
        console.error("Error fetching message history:", e);
        if (isV1) {
            return res.status(500).json({
                success: false,
                data: null,
                error: "Failed to fetch message history.",
                timestamp: new Date().toISOString()
            });
        }
        res.status(500).json({ error: "Failed to fetch message history." });
    }
});

// Delete chat history for a specific recipient
router.delete('/:recipient', authenticate, checkPermission('MANAGE_CHAT'), async (req, res) => {
    const userId = req.user.workspaceId;
    const recipient = req.params.recipient;

    try {
        const cleanRecipient = recipient.startsWith('+') ? recipient.substring(1) : recipient;
        const recipientVariants = [cleanRecipient, '+' + cleanRecipient];

        await prisma.messageLog.updateMany({
            where: {
                userId: userId,
                recipient: { in: recipientVariants }
            },
            data: {
                visibleInChat: false
            }
        });

        res.status(200).json({ message: "Chat history deleted successfully." });
    } catch (e) {
        console.error("Error deleting chat history:", e);
        res.status(500).json({ error: "Failed to delete chat history." });
    }
});

// Send a chat message via Meta
router.post('/send', authenticate, checkPermission('MANAGE_CHAT'), async (req, res) => {
    const userId = req.user.workspaceId;
    const { recipient, to, phone, message, mediaBase64, fileName, mimeType } = req.body;
    let targetRecipient = recipient || to || phone;
    if (targetRecipient) {
        targetRecipient = targetRecipient.toString().replace(/^\+/, '');
    }
    const io = req.app.get('io');

    if (!targetRecipient) {
        return res.status(400).json({ error: "Missing recipient. Please provide 'to', 'phone', or 'recipient' in the request body." });
    }


    try {
        const user = await prisma.user.findUnique({
            where: { id: userId }
        });

        if (!user || !user.phoneNumberId || !user.metaToken) {
            return res.status(400).json({ error: "Missing Meta API credentials. Please configure Settings." });
        }

        const token = decrypt(user.metaToken);

        let mediaId = null;
        if (mediaBase64 && fileName && mimeType) {
            try {
                const base64Data = mediaBase64.split(',')[1];
                let buffer = Buffer.from(base64Data, 'base64');
                let finalMimeType = mimeType;
                let finalFileName = fileName;

                if (mimeType && mimeType.includes('audio/')) {
                    const converted = await convertAudioBufferToOgg(buffer, mimeType);
                    buffer = converted.buffer;
                    finalMimeType = converted.mimeType;
                    if (finalMimeType === 'audio/ogg') {
                        finalFileName = (fileName || 'audio').replace(/\.[^/.]+$/, "") + ".ogg";
                    }
                }

                const formData = new FormData();
                formData.append('messaging_product', 'whatsapp');
                formData.append('file', buffer, { filename: finalFileName, contentType: finalMimeType });

                const { version } = await getMetaConfig();
                const uploadRes = await axios.post(
                    `https://graph.facebook.com/${version}/${user.phoneNumberId}/media`,
                    formData,
                    {
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            ...formData.getHeaders()
                        }
                    }
                );

                const uploadData = uploadRes.data;
                mediaId = uploadData.id;
            } catch (err) {
                console.error("Media upload exception:", err);
                return res.status(500).json({ error: "Exception while uploading media" });
            }
        }

        const payload = {
            messaging_product: "whatsapp",
            recipient_type: "individual",
            to: targetRecipient
        };

        let dbContent = null;

        if (mediaId) {
            let type = 'document';
            if (mimeType.startsWith('image/')) type = 'image';
            else if (mimeType.startsWith('video/')) type = 'video';
            else if (mimeType.startsWith('audio/')) type = 'audio';

            payload.type = type;
            payload[type] = { id: mediaId };

            if (message && message.trim()) {
                payload[type].caption = message.trim();
                dbContent = { type, caption: message.trim(), fileName, mediaUrl: mediaBase64 };
            } else {
                dbContent = { type, fileName, mediaUrl: mediaBase64 };
            }
        } else {
            payload.type = "text";
            payload.text = { body: message };
            dbContent = { text: message };
        }

        // 1. Verify Wallet Balance for SERVICE message (default for manual chat)
        try {
            await validateBalance(userId, 'SERVICE', 1);
        } catch (walletErr) {
            return res.status(403).json({ error: walletErr.message });
        }

        const { version } = await getMetaConfig();
        const response = await axios.post(
            `https://graph.facebook.com/${version}/${user.phoneNumberId}/messages`,
            payload,
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        const messageId = response.data.messages[0].id;

        // Save outbound message to DB temporarily as 'SENT', Meta webhooks will update to delivered/read
        const log = await prisma.messageLog.create({
            data: {
                userId: userId,
                messageId: messageId,
                recipient: targetRecipient,
                direction: 'OUTBOUND',
                status: 'SENT',
                content: dbContent
            }
        });

        // 3. Deduct from wallet
        await deductCredits(userId, 'SERVICE', 1, `Manual chat to ${targetRecipient}`);

        // Emit newly created manual outbound message back to UI instantly
        if (io) {
            io.to(`user_${userId}`).emit('new_message', log);
        }

        res.status(200).json({ success: true, messageId, data: log });

    } catch (error) {
        console.error("Meta API Send Error:", error.response?.data || error.message);
        res.status(500).json({ error: error.response?.data?.error?.message || "Failed to send message via Meta API" });
    }
});

// Manually Toggle Bot ON/OFF for a specific contact
router.put('/:recipient/bot', authenticate, checkPermission('MANAGE_CHAT'), async (req, res) => {
    const userId = req.user.workspaceId;
    const recipient = req.params.recipient;
    const { enabled } = req.body; // true = ON (nullify pause), false = OFF (pause 24h)

    try {
        const pausedUntil = enabled ? null : new Date(Date.now() + 24 * 60 * 60 * 1000);
        const cleanRecipient = recipient.startsWith('+') ? recipient.substring(1) : recipient;
        const recipientVariants = [cleanRecipient, '+' + cleanRecipient];

        const contacts = await prisma.contact.findMany({
            where: {
                userId: userId,
                phone: { in: recipientVariants }
            }
        });

        if (contacts.length > 0) {
            await prisma.contact.updateMany({
                where: {
                    userId: userId,
                    phone: { in: recipientVariants }
                },
                data: {
                    bot_paused_until: pausedUntil
                }
            });
        } else {
            const standardPhone = '+' + cleanRecipient;
            await prisma.contact.create({
                data: {
                    userId: userId,
                    phone: standardPhone,
                    name: standardPhone,
                    bot_paused_until: pausedUntil
                }
            });
        }

        res.status(200).json({ message: `Bot ${enabled ? 'enabled' : 'paused'} for this contact.`, pausedUntil });
    } catch (error) {
        console.error("Error toggling bot:", error);
        res.status(500).json({ error: "Failed to toggle bot status" });
    }
});

// Update CRM details (Assignee and Notes)
router.put('/:recipient/crm', authenticate, checkPermission('MANAGE_CHAT'), async (req, res) => {
    const userId = req.user.workspaceId;
    const recipient = req.params.recipient;
    const { assignedToId, internalNotes, name } = req.body;
    const io = req.app.get('io');

    try {
        const cleanRecipient = recipient.startsWith('+') ? recipient.substring(1) : recipient;
        const recipientVariants = [cleanRecipient, '+' + cleanRecipient];

        // Get current contact to check previous assignee
        const contacts = await prisma.contact.findMany({
            where: { userId, phone: { in: recipientVariants } }
        });
        const existing = contacts[0];
        const previousAssignee = existing?.assignedToId;

        const updateData = {};
        if (assignedToId !== undefined) updateData.assignedToId = assignedToId === '' ? null : assignedToId;
        if (internalNotes !== undefined) updateData.internalNotes = internalNotes;
        if (name !== undefined) updateData.name = name;

        let updatedContact;
        if (contacts.length > 0) {
            await prisma.contact.updateMany({
                where: { userId, phone: { in: recipientVariants } },
                data: updateData
            });
            updatedContact = await prisma.contact.findFirst({
                where: { userId, phone: { in: recipientVariants } }
            });
        } else {
            const standardPhone = '+' + cleanRecipient;
            updatedContact = await prisma.contact.create({
                data: { userId, phone: standardPhone, name: name || standardPhone, ...updateData }
            });
        }

        // If assignee changed and is set to a real user, create notification for them
        const newAssigneeId = updateData.assignedToId;
        if (newAssigneeId && newAssigneeId !== previousAssignee) {
            // Get assigner name
            const assigner = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
            const assignerName = assigner?.name || 'Your team';

            const notification = await prisma.notification.create({
                data: {
                    userId: newAssigneeId,
                    title: 'Conversation Assigned to You',
                    message: `${assignerName} assigned the conversation with ${recipient} to you.`
                }
            });

            // Emit real-time notification to the assigned team member
            if (io) {
                io.to(`user_${newAssigneeId}`).emit('new_notification', notification);
            }
        }

        res.status(200).json({ message: "CRM details updated successfully.", contact: updatedContact });
    } catch (error) {
        console.error("Error updating CRM details:", error);
        res.status(500).json({ error: "Failed to update CRM details" });
    }
});

// Update conversation status (OPEN, RESOLVED, PENDING)
router.put('/:recipient/status', authenticate, checkPermission('MANAGE_CHAT'), async (req, res) => {
    const userId = req.user.workspaceId;
    const recipient = req.params.recipient;
    const { status } = req.body;

    if (!['OPEN', 'RESOLVED', 'PENDING'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status. Must be OPEN, RESOLVED, or PENDING.' });
    }

    try {
        const cleanRecipient = recipient.startsWith('+') ? recipient.substring(1) : recipient;
        const recipientVariants = [cleanRecipient, '+' + cleanRecipient];

        const contacts = await prisma.contact.findMany({
            where: { userId, phone: { in: recipientVariants } }
        });

        let contact;
        if (contacts.length > 0) {
            await prisma.contact.updateMany({
                where: { userId, phone: { in: recipientVariants } },
                data: { status }
            });
            contact = await prisma.contact.findFirst({
                where: { userId, phone: { in: recipientVariants } }
            });
        } else {
            const standardPhone = '+' + cleanRecipient;
            contact = await prisma.contact.create({
                data: { userId, phone: standardPhone, name: standardPhone, status }
            });
        }
        res.status(200).json({ message: 'Status updated.', contact });
    } catch (error) {
        console.error('Error updating status:', error);
        res.status(500).json({ error: 'Failed to update status' });
    }
});

// Get comments for a conversation
router.get('/:recipient/comments', authenticate, checkPermission('MANAGE_CHAT'), async (req, res) => {
    const userId = req.user.workspaceId;
    const recipient = req.params.recipient;

    try {
        const comments = await prisma.conversationComment.findMany({
            where: { userId, contactPhone: recipient },
            include: { author: { select: { name: true, email: true } } },
            orderBy: { createdAt: 'asc' }
        });
        res.status(200).json(comments);
    } catch (error) {
        console.error('Error fetching comments:', error);
        res.status(500).json({ error: 'Failed to fetch comments' });
    }
});

// Post a comment on a conversation
router.post('/:recipient/comments', authenticate, checkPermission('MANAGE_CHAT'), async (req, res) => {
    const userId = req.user.workspaceId;
    const authorId = req.user.id;
    const recipient = req.params.recipient;
    const { text } = req.body;
    const io = req.app.get('io');

    if (!text || !text.trim()) {
        return res.status(400).json({ error: 'Comment text is required.' });
    }

    try {
        const comment = await prisma.conversationComment.create({
            data: { userId, contactPhone: recipient, authorId, text: text.trim() },
            include: { author: { select: { name: true, email: true } } }
        });

        // Emit to all workspace members in real time
        if (io) {
            io.to(`user_${userId}`).emit('new_comment', { recipient, comment });
        }

        res.status(201).json(comment);
    } catch (error) {
        console.error('Error posting comment:', error);
        res.status(500).json({ error: 'Failed to post comment' });
    }
});

// Bulk Delete Chats
router.post('/bulk-delete', authenticate, checkPermission('MANAGE_CHAT'), async (req, res) => {
    const userId = req.user.workspaceId;
    const { recipients } = req.body; // Array of phone numbers

    if (!Array.isArray(recipients) || recipients.length === 0) {
        return res.status(400).json({ error: "No recipients provided for deletion." });
    }

    try {
        await prisma.messageLog.updateMany({
            where: { userId, recipient: { in: recipients } },
            data: { visibleInChat: false }
        });
        res.status(200).json({ message: `${recipients.length} chats deleted successfully.` });
    } catch (e) {
        console.error("Error bulk deleting chats:", e);
        res.status(500).json({ error: "Failed to delete selected chats." });
    }
});

// Bulk Toggle Bot
router.post('/bulk-bot', authenticate, checkPermission('MANAGE_CHAT'), async (req, res) => {
    const userId = req.user.workspaceId;
    const { recipients, enabled } = req.body; // enabled: true = ON, false = OFF

    if (!Array.isArray(recipients) || recipients.length === 0) {
        return res.status(400).json({ error: "No recipients provided." });
    }

    try {
        const pausedUntil = enabled ? null : new Date(Date.now() + 24 * 60 * 60 * 1000);

        for (const recipient of recipients) {
            const cleanRecipient = recipient.startsWith('+') ? recipient.substring(1) : recipient;
            const recipientVariants = [cleanRecipient, '+' + cleanRecipient];

            const contacts = await prisma.contact.findMany({
                where: { userId, phone: { in: recipientVariants } }
            });

            if (contacts.length > 0) {
                await prisma.contact.updateMany({
                    where: { userId, phone: { in: recipientVariants } },
                    data: { bot_paused_until: pausedUntil }
                });
            } else {
                const standardPhone = '+' + cleanRecipient;
                await prisma.contact.create({
                    data: { userId, phone: standardPhone, name: standardPhone, bot_paused_until: pausedUntil }
                });
            }
        }

        res.status(200).json({ message: `Bot ${enabled ? 'enabled' : 'paused'} for ${recipients.length} contacts.` });
    } catch (e) {
        console.error("Error bulk toggling bot:", e);
        res.status(500).json({ error: "Failed to toggle bot for selected contacts." });
    }
});

// Send an approved WhatsApp template from Live Chat (to re-open 24hr window)
router.post('/send-template', authenticate, checkPermission('MANAGE_CHAT'), async (req, res) => {
    const userId = req.user.workspaceId;
    const { recipient, templateName, templateLanguage } = req.body;
    const io = req.app.get('io');

    if (!recipient || !templateName) {
        return res.status(400).json({ error: "recipient and templateName are required." });
    }

    try {
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user || !user.phoneNumberId || !user.metaToken) {
            return res.status(400).json({ error: "Missing Meta API credentials. Please configure Settings." });
        }

        const token = decrypt(user.metaToken);

        // Find template in DB to get components
        const template = await prisma.template.findFirst({
            where: { userId, name: templateName }
        });

        const templatePayload = {
            name: templateName,
            language: { code: templateLanguage || template?.language || 'en' }
        };

        // Only include static (non-variable) components
        if (template?.components) {
            const comps = typeof template.components === 'string'
                ? JSON.parse(template.components)
                : template.components;
            const staticComps = comps.filter(c =>
                ['HEADER', 'BODY', 'FOOTER'].includes(c.type) &&
                c.text && !c.text.includes('{{')
            );
            if (staticComps.length > 0) {
                templatePayload.components = staticComps.map(c => ({
                    type: c.type.toLowerCase(),
                    parameters: []
                }));
            }
        }

        // Validate wallet balance (MARKETING category for template)
        try {
            await validateBalance(userId, 'MARKETING', 1);
        } catch (walletErr) {
            return res.status(403).json({ error: walletErr.message });
        }

        const { version } = await getMetaConfig();
        const cleanPhone = recipient.toString().replace(/^\+/, '');

        const response = await axios.post(
            `https://graph.facebook.com/${version}/${user.phoneNumberId}/messages`,
            {
                messaging_product: "whatsapp",
                to: cleanPhone,
                type: "template",
                template: templatePayload
            },
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        const messageId = response.data.messages[0].id;

        const log = await prisma.messageLog.create({
            data: {
                userId,
                messageId,
                recipient: cleanPhone,
                direction: 'OUTBOUND',
                status: 'SENT',
                content: {
                    type: 'template',
                    templateName,
                    resolvedBody: template?.components
                        ? (typeof template.components === 'string'
                            ? JSON.parse(template.components)
                            : template.components).find(c => c.type === 'BODY')?.text || ''
                        : '',
                    components: typeof template?.components === 'string'
                        ? JSON.parse(template.components)
                        : (template?.components || [])
                }
            }
        });

        // Deduct credits
        await deductCredits(userId, 'MARKETING', 1, `Template "${templateName}" sent to ${recipient} from Live Chat`);

        if (io) {
            io.to(`user_${userId}`).emit('new_message', log);
        }

        res.status(200).json({ success: true, messageId, data: log });

    } catch (error) {
        console.error("Template Send Error:", error.response?.data || error.message);
        res.status(500).json({ error: error.response?.data?.error?.message || "Failed to send template." });
    }
});

// Centralized helper for standardized responses in chat.js
const sendV1ChatResponse = (res, status, data = null, error = null) => {
    return res.status(status).json({
        success: error === null,
        data,
        error,
        timestamp: new Date().toISOString()
    });
};

const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB limit

// POST /api/v1/chat/upload - Centralized media upload API
router.post('/upload', authenticate, upload.single('file'), async (req, res) => {
    if (!req.file) {
        return sendV1ChatResponse(res, 400, null, "No file uploaded.");
    }

    try {
        const base64Data = req.file.buffer.toString('base64');
        const mediaUrl = `data:${req.file.mimetype};base64,${base64Data}`;

        return sendV1ChatResponse(res, 200, {
            fileName: req.file.originalname,
            mimeType: req.file.mimetype,
            size: req.file.size,
            mediaUrl: mediaUrl
        });
    } catch (e) {
        console.error("Upload error:", e);
        return sendV1ChatResponse(res, 500, null, "Failed to process and upload media.");
    }
});

module.exports = router;

