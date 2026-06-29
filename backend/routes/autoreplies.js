const express = require('express');
const router = express.Router();
const prisma = require('../prismaClient');
const { authenticate } = require('../middleware/auth'); // Ensure auth is required

// Apply authentication middleware
router.use(authenticate);

// 1. GET all AutoReplies for the logged-in user
router.get('/', async (req, res) => {
    try {
        const autoReplies = await prisma.autoReply.findMany({
            where: { userId: req.user.workspaceId },
            orderBy: { createdAt: 'desc' }
        });
        res.json(autoReplies);
    } catch (error) {
        console.error("Error fetching AutoReplies:", error);
        res.status(500).json({ error: 'Failed to fetch AutoReplies' });
    }
});

// 2. CREATE a new AutoReply
router.post('/', async (req, res) => {
    try {
        const { trigger_keyword, match_type, reply_content, media_url, action_type, template_id, template_name, template_lang, is_active } = req.body;

        if (!trigger_keyword) {
            return res.status(400).json({ error: 'Trigger keyword is required.' });
        }

        const newReply = await prisma.autoReply.create({
            data: {
                userId: req.user.workspaceId,
                trigger_keyword: trigger_keyword.trim(),
                match_type: match_type || 'EXACT',
                reply_content: reply_content || null,
                media_url: media_url || null,
                action_type: action_type || 'TEXT',
                template_id: template_id || null,
                template_name: template_name || null,
                template_lang: template_lang || null,
                is_active: is_active !== undefined ? is_active : true
            }
        });

        res.status(201).json(newReply);
    } catch (error) {
        console.error("Error creating AutoReply:", error);
        res.status(500).json({ error: 'Failed to create AutoReply' });
    }
});

// 3. UPDATE an AutoReply
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { trigger_keyword, match_type, reply_content, media_url, action_type, template_id, template_name, template_lang, is_active } = req.body;

        // Verify ownership
        const existing = await prisma.autoReply.findFirst({
            where: { id: id, userId: req.user.workspaceId }
        });

        if (!existing) {
            return res.status(404).json({ error: 'AutoReply not found' });
        }

        const updatedReply = await prisma.autoReply.update({
            where: { id: id },
            data: {
                trigger_keyword: trigger_keyword !== undefined ? trigger_keyword.trim() : undefined,
                match_type: match_type !== undefined ? match_type : undefined,
                reply_content: reply_content !== undefined ? reply_content : undefined,
                media_url: media_url !== undefined ? media_url : undefined,
                action_type: action_type !== undefined ? action_type : undefined,
                template_id: template_id !== undefined ? template_id : undefined,
                template_name: template_name !== undefined ? template_name : undefined,
                template_lang: template_lang !== undefined ? template_lang : undefined,
                is_active: is_active !== undefined ? is_active : undefined
            }
        });

        res.json(updatedReply);
    } catch (error) {
        console.error("Error updating AutoReply:", error);
        res.status(500).json({ error: 'Failed to update AutoReply' });
    }
});

// 4. DELETE an AutoReply
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // Verify ownership
        const existing = await prisma.autoReply.findFirst({
            where: { id: id, userId: req.user.workspaceId }
        });

        if (!existing) {
            return res.status(404).json({ error: 'AutoReply not found' });
        }

        await prisma.autoReply.delete({
            where: { id: id }
        });

        res.json({ message: 'AutoReply deleted successfully' });
    } catch (error) {
        console.error("Error deleting AutoReply:", error);
        res.status(500).json({ error: 'Failed to delete AutoReply' });
    }
});

module.exports = router;
