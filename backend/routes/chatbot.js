const express = require('express');
const router = express.Router();
const prisma = require('../prismaClient');
const { authenticate } = require('../middleware/auth');
const checkPermission = require('../middleware/rbac');
const { enforceBotFlowLimit } = require('../middleware/planLimits');

// --- Chatbot Settings ---

// GET Chatbot Settings
router.get('/settings', authenticate, async (req, res) => {
    const workspaceId = req.user.workspaceId;

    try {
        const userSettings = await prisma.user.findUnique({
            where: { id: workspaceId },
            select: {
                botEnabled: true,
                botPrompt: true,
                aiProvider: true,
                aiApiKey: true,
                aiWebhookUrl: true,
                aiModel: true,
                googleClientId: true,
                googleClientSecret: true,
                googleCalendarId: true
            }
        });

        const maskedKey = userSettings?.aiApiKey ? '••••••••••••••••' : '';
        const maskedGoogleSecret = userSettings?.googleClientSecret ? '••••••••••••••••' : '';

        res.status(200).json({
            botEnabled: userSettings?.botEnabled || false,
            botPrompt: userSettings?.botPrompt || '',
            aiProvider: userSettings?.aiProvider || 'none',
            aiApiKey: maskedKey,
            aiWebhookUrl: userSettings?.aiWebhookUrl || '',
            aiModel: userSettings?.aiModel || '',
            googleClientId: userSettings?.googleClientId || '',
            googleClientSecret: maskedGoogleSecret,
            isGoogleConnected: !!userSettings?.googleCalendarId
        });
    } catch (e) {
        console.error("Error fetching chatbot settings:", e);
        res.status(500).json({ error: "Failed to fetch chatbot settings." });
    }
});

// POST Update Chatbot Settings
router.post('/settings', authenticate, async (req, res) => {
    // Both Admin and Staff (with permissions) could theoretically manage settings, but usually this is an Admin only feature.
    // Assuming ADMIN only for sensitive settings like API keys.
    if (req.user.role !== 'ADMIN') {
        return res.status(403).json({ error: "Only Admins can modify AI Settings." });
    }

    const { botEnabled, botPrompt, aiProvider, aiApiKey, aiWebhookUrl, aiModel, googleClientId, googleClientSecret } = req.body;
    const workspaceId = req.user.workspaceId;

    try {
        const updateData = {
            botEnabled,
            botPrompt,
            aiProvider,
            aiWebhookUrl,
            aiModel,
            googleClientId
        };

        // Only update the key if a new one was actually provided (not the mask)
        if (aiApiKey && aiApiKey !== '••••••••••••••••') {
            updateData.aiApiKey = aiApiKey;
        }
        
        if (googleClientSecret && googleClientSecret !== '••••••••••••••••') {
            updateData.googleClientSecret = googleClientSecret;
        }

        await prisma.user.update({
            where: { id: workspaceId },
            data: updateData
        });

        res.status(200).json({ message: "Chatbot settings saved successfully." });
    } catch (e) {
        console.error("Error saving chatbot settings:", e);
        res.status(500).json({ error: "Failed to save chatbot settings." });
    }
});

// --- Flow Builder Rules ---

// GET all flows
router.get('/flows', authenticate, async (req, res) => {
    const workspaceId = req.user.workspaceId;

    try {
        const flows = await prisma.chatbotFlow.findMany({
            where: { userId: workspaceId },
            orderBy: { createdAt: 'desc' }
        });
        res.status(200).json(flows);
    } catch (e) {
        console.error("Error fetching flows:", e);
        res.status(500).json({ error: "Failed to fetch flow rules." });
    }
});

// POST create or update a flow
router.post('/flows', authenticate, checkPermission('MANAGE_CHATBOT'), async (req, res) => {
    const workspaceId = req.user.workspaceId;
    const { id, trigger, actionType, response } = req.body;

    if (!trigger || !actionType || !response) {
        return res.status(400).json({ error: "Trigger, actionType, and response are required." });
    }

    try {
        let flow;
        if (id) {
            // UPDATE — no limit check needed
            flow = await prisma.chatbotFlow.update({
                where: { id, userId: workspaceId },
                data: { trigger, actionType, response }
            });
        } else {
            // CREATE — enforce limit first
            const { enforceBotFlowLimit: limCheck } = require('../middleware/planLimits');
            const limitRes = await new Promise((resolve) => {
                const mockReq = { user: req.user, headers: req.headers };
                const mockRes = { status: (code) => ({ json: (data) => resolve({ blocked: true, code, data }) }) };
                limCheck(mockReq, mockRes, () => resolve({ blocked: false }));
            });
            if (limitRes.blocked) {
                return res.status(limitRes.code).json(limitRes.data);
            }
            flow = await prisma.chatbotFlow.create({
                data: {
                    userId: workspaceId,
                    trigger,
                    actionType,
                    response
                }
            });
        }
        res.status(200).json(flow);
    } catch (e) {
        console.error("Error saving flow:", e);
        res.status(500).json({ error: "Failed to save flow rule." });
    }
});

// DELETE a flow
router.delete('/flows/:id', authenticate, checkPermission('MANAGE_CHATBOT'), async (req, res) => {
    const workspaceId = req.user.workspaceId;
    const flowId = req.params.id;

    try {
        await prisma.chatbotFlow.delete({
            where: { id: flowId, userId: workspaceId }
        });
        res.status(200).json({ message: "Rule deleted successfully." });
    } catch (e) {
        console.error("Error deleting flow:", e);
        res.status(500).json({ error: "Failed to delete flow rule." });
    }
});

// --- AI Brain: Optimizations & Knowledge Base ---

router.post('/prompt-optimize', authenticate, checkPermission('MANAGE_CHATBOT'), async (req, res) => {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: "No prompt provided." });

    const workspaceId = req.user.workspaceId;
    const userSettings = await prisma.user.findUnique({ where: { id: workspaceId }});

    if (userSettings?.aiProvider !== 'openai' || !userSettings?.aiApiKey) {
        return res.status(400).json({ error: "Please configure your OpenAI API Key in the settings below to use the AI Optimizer." });
    }

    try {
        const { OpenAI } = require('openai');
        const openai = new OpenAI({ apiKey: userSettings.aiApiKey });

        const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: 'You are an expert AI Prompt Engineer. Rewrite the following user prompt into a highly effective, clear, and structured system prompt for a WhatsApp customer service bot. Ensure it defines the persona, tone, rules, and boundaries clearly. Return ONLY the rewritten prompt.' },
                { role: 'user', content: prompt }
            ],
            temperature: 0.7
        });

        res.status(200).json({ optimizedPrompt: response.choices[0].message.content.trim() });
    } catch (e) {
        console.error("Error optimizing prompt:", e);
        res.status(500).json({ error: e.message || "Failed to optimize prompt." });
    }
});

const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } }); // 5MB
const pdfParse = require('pdf-parse');
const cheerio = require('cheerio');
const axios = require('axios');

router.post('/knowledge/upload', authenticate, checkPermission('MANAGE_CHATBOT'), upload.single('document'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No file uploaded." });
    if (req.file.mimetype !== 'application/pdf') return res.status(400).json({ error: "Only PDF files are supported." });

    try {
        const data = await pdfParse(req.file.buffer);
        const textContent = data.text.replace(/\s+/g, ' ').trim();

        if (!textContent) return res.status(400).json({ error: "Could not extract text from PDF." });

        const doc = await prisma.knowledgeDocument.create({
            data: {
                userId: req.user.workspaceId,
                type: 'PDF',
                name: req.file.originalname,
                content: textContent.substring(0, 50000) // 50k char safety limit
            }
        });

        res.status(200).json(doc);
    } catch (e) {
        console.error("Error parsing PDF:", e);
        res.status(500).json({ error: "Failed to process PDF document." });
    }
});

router.post('/knowledge/crawl', authenticate, checkPermission('MANAGE_CHATBOT'), async (req, res) => {
    const { url } = req.body;
    if (!url || !url.startsWith('http')) return res.status(400).json({ error: "Invalid URL provided." });

    try {
        const response = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' }});
        const $ = cheerio.load(response.data);
        $('script, style, nav, footer, header').remove();
        const textContent = $('body').text().replace(/\s+/g, ' ').trim();

        if (!textContent) return res.status(400).json({ error: "Could not extract text from website." });

        const doc = await prisma.knowledgeDocument.create({
            data: {
                userId: req.user.workspaceId,
                type: 'URL',
                name: url,
                content: textContent.substring(0, 50000)
            }
        });

        res.status(200).json(doc);
    } catch (e) {
        console.error("Error crawling URL:", e);
        res.status(500).json({ error: "Failed to crawl website." });
    }
});

router.get('/knowledge', authenticate, async (req, res) => {
    const workspaceId = req.user.workspaceId;
    try {
        const docs = await prisma.knowledgeDocument.findMany({
            where: { userId: workspaceId },
            select: { id: true, type: true, name: true, createdAt: true },
            orderBy: { createdAt: 'desc' }
        });
        res.status(200).json(docs);
    } catch (e) {
        res.status(500).json({ error: "Failed to fetch knowledge base." });
    }
});

router.delete('/knowledge/:id', authenticate, checkPermission('MANAGE_CHATBOT'), async (req, res) => {
    try {
        await prisma.knowledgeDocument.delete({
            where: { id: req.params.id, userId: req.user.workspaceId }
        });
        res.status(200).json({ message: "Document deleted." });
    } catch (e) {
        res.status(500).json({ error: "Failed to delete document." });
    }
});

module.exports = router;
