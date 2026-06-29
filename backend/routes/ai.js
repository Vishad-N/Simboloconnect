const express = require('express');
const router = express.Router();
const prisma = require('../prismaClient');
const { authenticate } = require('../middleware/auth');
const axios = require('axios');

router.use(authenticate);

// GET /api/ai/settings
router.get('/settings', async (req, res) => {
    try {
        const workspaceId = req.user.workspaceId;
        
        let agent = await prisma.aiAgent.findUnique({
            where: { userId: workspaceId }
        });

        if (!agent) {
            agent = await prisma.aiAgent.create({
                data: {
                    userId: workspaceId,
                    name: "Workspace Assistant",
                    toolsEnabled: JSON.stringify(["search_products", "create_payment_link", "search_customer", "get_order_status", "escalate_to_human"]),
                    isActive: true,
                    useOwnAi: false
                }
            });
        }

        const user = await prisma.user.findUnique({ where: { id: workspaceId } });

        res.json({
            agent,
            userSettings: {
                aiProvider: user.aiProvider,
                aiModel: user.aiModel,
                botEnabled: user.botEnabled,
                hasAiApiKey: !!user.aiApiKey,
                updatedAt: user.updatedAt
                // NEVER return aiApiKey
            }
        });

    } catch (e) {
        console.error(e);
        res.status(500).json({ error: "Failed to load AI settings" });
    }
});

// POST /api/ai/settings
router.post('/settings', async (req, res) => {
    try {
        const workspaceId = req.user.workspaceId;
        const { agentSettings, userSettings, apiKey } = req.body;

        if (agentSettings) {
            let aiErrorResponses = agentSettings.aiErrorResponses;
            if (typeof aiErrorResponses === 'string') {
                try {
                    aiErrorResponses = JSON.parse(aiErrorResponses);
                } catch (e) {
                    console.error("[AI Router] Invalid JSON for aiErrorResponses:", e.message);
                }
            }

            let signupAutomation = agentSettings.signupAutomation;
            if (typeof signupAutomation === 'string') {
                try {
                    signupAutomation = JSON.parse(signupAutomation);
                } catch (e) {
                    console.error("[AI Router] Invalid JSON for signupAutomation:", e.message);
                }
            }

            let finalAgentSettings = { ...agentSettings };
            if (agentSettings.systemPrompt !== undefined) {
                let updatedPrompt = agentSettings.systemPrompt;
                if (updatedPrompt && updatedPrompt.trim().length > 0) {
                    if (!updatedPrompt.includes('[PROMPT_SOURCE: CUSTOM]') && !updatedPrompt.includes('[PROMPT_SOURCE: AUTO]')) {
                        updatedPrompt = updatedPrompt.trim() + '\n\n[PROMPT_SOURCE: CUSTOM]';
                    }
                }
                finalAgentSettings.systemPrompt = updatedPrompt;
            }

            await prisma.aiAgent.upsert({
                where: { userId: workspaceId },
                update: {
                    ...finalAgentSettings,
                    toolsEnabled: finalAgentSettings.toolsEnabled ? JSON.stringify(finalAgentSettings.toolsEnabled) : undefined,
                    aiErrorResponses: aiErrorResponses !== undefined ? aiErrorResponses : undefined,
                    signupAutomation: signupAutomation !== undefined ? signupAutomation : undefined
                },
                create: {
                    userId: workspaceId,
                    ...finalAgentSettings,
                    toolsEnabled: finalAgentSettings.toolsEnabled ? JSON.stringify(finalAgentSettings.toolsEnabled) : '[]',
                    aiErrorResponses: aiErrorResponses !== undefined ? aiErrorResponses : null,
                    signupAutomation: signupAutomation !== undefined ? signupAutomation : null
                }
            });
        }

        if (userSettings || apiKey !== undefined) {
            const dataToUpdate = { ...userSettings };
            
            // Safeguard 1: Reject masked/empty strings
            let finalKey = apiKey;
            if (apiKey === undefined) {
                finalKey = undefined; // Do not touch the key
            } else if (apiKey === null || apiKey.trim() === '') {
                finalKey = null; // Clear the key
            } else if (apiKey.includes('••••') || apiKey === '---') {
                return res.status(400).json({ error: "Cannot save masked values." });
            }

            // Safeguard 2: Groq validation
            const providerToValidate = userSettings?.aiProvider || (await prisma.user.findUnique({ where: { id: workspaceId } })).aiProvider;
            if (providerToValidate === 'groq' && finalKey && !finalKey.startsWith('gsk_')) {
                return res.status(400).json({ error: "Invalid Groq API Key. Must start with gsk_" });
            }

            if (finalKey !== undefined) {
                dataToUpdate.aiApiKey = finalKey;
            }

            await prisma.user.update({
                where: { id: workspaceId },
                data: dataToUpdate
            });

            // Safeguard 3: DB Verification & Logging
            const updatedUser = await prisma.user.findUnique({ where: { id: workspaceId } });
            console.log("[AI CONFIG SAVE] User Config Updated:");
            console.log(JSON.stringify({
                provider: updatedUser.aiProvider,
                keyPrefix: updatedUser.aiApiKey ? `${updatedUser.aiApiKey.substring(0, 10)}...` : 'NONE',
                updatedAt: updatedUser.updatedAt,
                userId: updatedUser.id
            }, null, 2));
        }

        res.json({ success: true, message: "AI settings saved successfully." });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: "Failed to save AI settings" });
    }
});

// GET /api/ai/logs
router.get('/logs', async (req, res) => {
    try {
        const logs = await prisma.aiActionLog.findMany({
            where: { userId: req.user.workspaceId },
            orderBy: { executedAt: 'desc' },
            take: 100,
            include: {
                user: { select: { name: true } }
            }
        });
        res.json(logs);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: "Failed to fetch logs" });
    }
});

// GET /api/ai/analytics
router.get('/analytics', async (req, res) => {
    try {
        const workspaceId = req.user.workspaceId;

        const totalActions = await prisma.aiActionLog.count({ where: { userId: workspaceId }});
        const successActions = await prisma.aiActionLog.count({ where: { userId: workspaceId, status: 'SUCCESS' }});
        
        const usageStats = await prisma.aiUsageLog.aggregate({
            where: { userId: workspaceId },
            _sum: {
                totalTokens: true,
                estimatedCost: true
            }
        });

        res.json({
            totalActions,
            successRate: totalActions > 0 ? ((successActions / totalActions) * 100).toFixed(1) : 0,
            totalTokens: usageStats._sum.totalTokens || 0,
            estimatedCost: usageStats._sum.estimatedCost || 0
        });

    } catch (e) {
        console.error(e);
        res.status(500).json({ error: "Failed to fetch AI analytics" });
    }
});

// Helper function to test AI connection across all providers
async function performAiTestConnection(provider, apiKey, model) {
    const selectedProvider = provider || 'openai';
    let endpoint = 'https://api.openai.com/v1/chat/completions';
    let headers = { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' };
    let payload = {
        model: model || "gpt-4o-mini",
        messages: [{ role: "user", content: "Ping. Reply with exactly 'pong'." }]
    };

    if (selectedProvider === 'openai') {
        endpoint = 'https://api.openai.com/v1/chat/completions';
        payload.model = model || "gpt-4o-mini";
    } else if (selectedProvider === 'openrouter') {
        endpoint = 'https://openrouter.ai/api/v1/chat/completions';
        payload.model = model || "openrouter/auto";
    } else if (selectedProvider === 'groq') {
        endpoint = 'https://api.groq.com/openai/v1/chat/completions';
        payload.model = model || "llama-3.1-8b-instant";
    } else if (selectedProvider === 'mistral') {
        endpoint = 'https://api.mistral.ai/v1/chat/completions';
        payload.model = model || "mistral-small-latest";
    } else if (selectedProvider === 'together') {
        endpoint = 'https://api.together.xyz/v1/chat/completions';
        payload.model = model || "meta-llama/Llama-3-70b-chat-hf";
    } else if (selectedProvider === 'perplexity') {
        endpoint = 'https://api.perplexity.ai/chat/completions';
        payload.model = model || "llama-3.1-sonar-small-128k-online";
    } else if (selectedProvider === 'google') {
        const geminiModel = model || "gemini-1.5-flash";
        endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${apiKey}`;
        headers = { 'Content-Type': 'application/json' };
        payload = {
            contents: [{ parts: [{ text: "Ping. Reply with exactly 'pong'." }] }]
        };
    } else if (selectedProvider === 'anthropic') {
        endpoint = 'https://api.anthropic.com/v1/messages';
        headers = {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'Content-Type': 'application/json'
        };
        payload = {
            model: model || "claude-3-haiku-20240307",
            max_tokens: 10,
            messages: [{ role: "user", content: "Ping. Reply with exactly 'pong'." }]
        };
    } else if (selectedProvider === 'cohere') {
        endpoint = 'https://api.cohere.com/v1/chat';
        headers = { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' };
        payload = {
            message: "Ping. Reply with exactly 'pong'."
        };
    }

    const aiRes = await axios.post(endpoint, payload, {
        headers,
        timeout: 15000,
    });

    let reply = '';
    if (selectedProvider === 'google') {
        reply = aiRes.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    } else if (selectedProvider === 'anthropic') {
        reply = aiRes.data?.content?.[0]?.text || '';
    } else if (selectedProvider === 'cohere') {
        reply = aiRes.data?.text || '';
    } else {
        reply = aiRes.data?.choices?.[0]?.message?.content || '';
    }

    return reply;
}

// POST /api/ai/provider/test
router.post('/provider/test', async (req, res) => {
    try {
        const { provider, apiKey, model } = req.body;
        if (!apiKey) return res.status(400).json({ error: "API Key required for test." });

        await performAiTestConnection(provider, apiKey, model);

        return res.json({ 
            success: true, 
            message: `Connection successful! ${provider.toUpperCase()} responded properly.` 
        });

    } catch (e) {
        console.error("AI test connection error:", e.response?.data || e.message);
        const errMsg = e.response?.data?.error?.message || e.response?.data?.error || e.message;
        return res.status(400).json({ error: `Connection failed: ${typeof errMsg === 'object' ? JSON.stringify(errMsg) : errMsg}` });
    }
});

// POST /api/ai/test-config
router.post('/test-config', async (req, res) => {
    try {
        const workspaceId = req.user.workspaceId;
        const user = await prisma.user.findUnique({ where: { id: workspaceId }, include: { aiAgent: true } });
        
        let provider, apiKey, model;
        
        if (user.aiAgent?.useOwnAi) {
            provider = user.aiProvider || 'openai';
            apiKey = user.aiApiKey;
            model = user.aiModel || 'gpt-4o-mini';
        } else {
            const admin = await prisma.user.findFirst({ where: { role: 'SUPERADMIN' } });
            provider = admin?.aiProvider || 'openai';
            apiKey = admin?.aiApiKey;
            model = admin?.aiModel || 'gpt-4o-mini';
        }

        if (!apiKey) {
            return res.status(400).json({ error: "No API key configured for the selected provider." });
        }

        await performAiTestConnection(provider, apiKey, model);

        res.json({ success: true, message: "AI Configuration Test Successful!" });
    } catch (e) {
        console.error(`[AI PROVIDER ERROR] Test failed:`, e.message, e.response?.data);
        const errMsg = e.response?.data?.error?.message || e.response?.data?.error || e.message;
        res.status(500).json({ error: `Connection failed: ${typeof errMsg === 'object' ? JSON.stringify(errMsg) : errMsg}` });
    }
});

// GET /api/ai/signup-automation/analytics
router.get('/signup-automation/analytics', async (req, res) => {
    try {
        const workspaceId = req.user.workspaceId;

        const total = await prisma.signupAutomationLog.count({ where: { userId: workspaceId } });
        
        const waSent = await prisma.signupAutomationLog.count({ where: { userId: workspaceId, whatsappStatus: "SENT" } });
        const waFailed = await prisma.signupAutomationLog.count({ where: { userId: workspaceId, whatsappStatus: "FAILED" } });
        const waSuppressed = await prisma.signupAutomationLog.count({ where: { userId: workspaceId, whatsappStatus: "SUPPRESSED" } });
        
        const voiceQueued = await prisma.signupAutomationLog.count({ where: { userId: workspaceId, voiceStatus: "QUEUED" } });
        const voiceCompleted = await prisma.signupAutomationLog.count({ where: { userId: workspaceId, voiceStatus: "COMPLETED" } });
        const voiceFailed = await prisma.signupAutomationLog.count({ where: { userId: workspaceId, voiceStatus: "FAILED" } });
        const voiceSuppressed = await prisma.signupAutomationLog.count({ where: { userId: workspaceId, voiceStatus: "SUPPRESSED" } });

        const logs = await prisma.signupAutomationLog.findMany({
            where: { userId: workspaceId },
            orderBy: { createdAt: 'desc' },
            take: 20
        });

        const warnings = [];
        const user = await prisma.user.findUnique({ where: { id: workspaceId } });
        if (!user?.metaToken || !user?.phoneNumberId) {
            warnings.push("Meta WhatsApp API credentials are not configured in your settings. Automated messages will fail.");
        }

        const agent = await prisma.aiAgent.findUnique({ where: { userId: workspaceId } });
        const config = agent?.signupAutomation || {};
        if (config.voiceEnabled && !config.voiceAgentId) {
            warnings.push("AI Voice Agent ID is not configured in Onboarding Automation settings.");
        }

        const callCountLastHour = await prisma.signupAutomationLog.count({
            where: {
                userId: workspaceId,
                createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) },
                voiceStatus: "SUPPRESSED",
                voiceError: { contains: "hourly onboarding call limit" }
            }
        });
        if (callCountLastHour > 0) {
            warnings.push("Onboarding call safety throttle active. Some leads were enqueued but skipped calling to prevent spam.");
        }

        res.json({
            stats: {
                total,
                whatsapp: {
                    sent: waSent,
                    failed: waFailed,
                    suppressed: waSuppressed,
                    successRate: (waSent + waFailed) > 0 ? Math.round((waSent / (waSent + waFailed)) * 100) : 100
                },
                voice: {
                    queued: voiceQueued,
                    completed: voiceCompleted,
                    failed: voiceFailed,
                    suppressed: voiceSuppressed
                }
            },
            warnings,
            logs
        });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: "Failed to fetch onboarding analytics" });
    }
});

// POST /api/ai/signup-automation/simulate
router.post('/signup-automation/simulate', async (req, res) => {
    try {
        const workspaceId = req.user.workspaceId;
        const { name, email, phone, plan } = req.body;

        if (!name || !phone) {
            return res.status(400).json({ error: "Name and Phone number are required to simulate a signup." });
        }

        const SignupAutomationService = require('../../services/ai/SignupAutomationService');
        const result = await SignupAutomationService.triggerOnboarding(workspaceId, {
            name,
            email,
            phone,
            plan
        });

        if (result.success) {
            res.json({ success: true, message: "Signup simulation triggered successfully!", logId: result.logId });
        } else {
            res.status(400).json({ error: result.error || "Simulation suppressed or failed." });
        }
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message || "Failed to trigger simulation." });
    }
});

module.exports = router;

