const axios = require('axios');
const prisma = require('../../../prismaClient');
const redis = require('../../redisConnection');
const { buildWorkspaceContext, estimateTokens, trimToTokens } = require('../context');
const { toolsDefinitions, executeTool } = require('../tools');
const { callDynamicAi } = require('../utils/dynamicAi');
const logger = require('../../logger');

function cleanJsonString(str) {
    if (!str) return '';
    let cleaned = str.trim();
    if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```(?:json)?\s*/i, '');
        cleaned = cleaned.replace(/\s*```$/, '');
    }
    return cleaned.trim();
}

/**
 * Helper to check if a customer's message explicitly requests a call.
 */
function isExplicitCallRequest(msg) {
    const text = (msg || '').toLowerCase();
    // Comprehensive Hinglish + English call intent keywords
    const callKeywords = [
        'call me', 'call now', 'call karo', 'call kijiye', 'call karna',
        'call kare', 'call karein', 'call karlo', 'call lagao', 'call connect',
        'call check', 'phone me', 'phone karo', 'phone kijiye', 'phone lagao',
        'please call', 'please phone', 'can you call', 'can u call',
        'mujhe call', 'mujhe phone', 'baat karvao', 'baat karni hai',
        'want to talk', 'want to speak', 'want a call', 'need a call',
        'connect call', 'voice call', 'call chahiye', 'call karwa',
        'ring me', 'ring karo', 'dial karo', 'give me a call',
    ];
    return callKeywords.some(kw => text.includes(kw));
}

/**
 * Helper to check if customer message suggests a scheduled future callback.
 */
function isScheduledRequest(msg) {
    const text = (msg || '').toLowerCase();
    // Use word-boundary patterns to avoid false positives (e.g. 'baat' containing 'at')
    // Only match clear time/schedule indicators as standalone words or numbers
    const schedulePatterns = [
        /\btomorrow\b/, /\bkal\b/, /\bbaje\b/, /\btoday\b/,
        /\bpm\b/, /\bam\b/,
        /\bminute\b/, /\bminutes\b/, /\bmin\b/,
        /\bhour\b/, /\bhours\b/, /\bghanta\b/, /\bghante\b/,
        /\bsecond\b/, /\bseconds\b/,
        /\bo'clock\b/, /\bbad mein\b/, /\bbaad mein\b/,
        /\b\d{1,2}:\d{2}\b/,       // time like 5:30
        /\b(at|by)\s+\d/,          // 'at 5', 'by 6'
        /\bschedule\b/, /\bbook\b/, /\blater\b/,
    ];
    return schedulePatterns.some(p => p.test(text));
}

/**
 * Fallback parser for non-OpenAI or confused models that fail to output native tool_calls
 * and instead write python code or text-based representations.
 */
function parseSyntheticToolCalls(content) {
    if (!content || typeof content !== 'string') return null;
    
    const APPROVED_SYNTHETIC_TOOLS = [
        'initiate_voice_call',
        'schedule_callback',
        'send_whatsapp_message',
        'search_products',
        'create_payment_link',
        'escalate_to_human',
        'recommend_products',
        'get_customer_intelligence'
    ];

    const toolCalls = [];

    // Fallback 1: Parse if the model outputted valid JSON containing tool call fields
    try {
        const cleaned = cleanJsonString(content);
        const parsed = JSON.parse(cleaned);
        
        // Case A: parsed has tool_calls array
        if (Array.isArray(parsed.tool_calls)) {
            for (const tc of parsed.tool_calls) {
                const name = tc.name || tc.function?.name;
                if (name && APPROVED_SYNTHETIC_TOOLS.includes(name)) {
                    toolCalls.push({
                        id: tc.id || `synthetic_${name}_${Date.now()}`,
                        type: 'function',
                        function: {
                            name: name,
                            arguments: typeof tc.arguments === 'object' 
                                ? JSON.stringify(tc.arguments) 
                                : (tc.arguments || '{}')
                        }
                    });
                } else if (name) {
                    logger.warn('[Parser Blocked] Attempted synthetic execution of unapproved/hallucinated tool:', { toolName: name });
                }
            }
        }
        // Case B: parsed has a single tool name/arguments
        else if (parsed.toolName || parsed.tool) {
            const name = parsed.toolName || parsed.tool;
            if (APPROVED_SYNTHETIC_TOOLS.includes(name)) {
                toolCalls.push({
                    id: `synthetic_${name}_${Date.now()}`,
                    type: 'function',
                    function: {
                        name: name,
                        arguments: typeof parsed.arguments === 'object'
                            ? JSON.stringify(parsed.arguments)
                            : (typeof parsed.args === 'object' ? JSON.stringify(parsed.args) : '{}')
                    }
                });
            } else {
                logger.warn('[Parser Blocked] Attempted synthetic execution of unapproved/hallucinated tool:', { toolName: name });
            }
        }
    } catch (e) {
        // Not a JSON or doesn't have JSON tool calls, continue to regex fallback
    }

    if (toolCalls.length > 0) {
        logger.warn('[Parser Fallback] Successfully parsed synthetic tool calls from JSON', { toolCalls: toolCalls.map(tc => tc.function.name) });
        return toolCalls;
    }

    // Fallback 2: Regex matching pattern: name(args) or default_api.name(args)
    const regex = /(?:default_api\.)?([a-z0-9_]+)\(([\s\S]*?)\)/g;
    let match;
    
    while ((match = regex.exec(content)) !== null) {
        const name = match[1];
        const argsStr = match[2];
        
        // Skip common non-tool functions or python keywords
        if (['print', 'str', 'int', 'dict', 'list', 'set', 'bool'].includes(name)) {
            continue;
        }

        // Strictly check whitelist
        if (!APPROVED_SYNTHETIC_TOOLS.includes(name)) {
            logger.warn('[Parser Blocked] Attempted synthetic execution of unapproved/hallucinated tool via regex:', { toolName: name });
            continue;
        }
        
        const args = {};
        const argRegex = /([a-zA-Z0-9_]+)\s*=\s*(?:'([^']*)'|"([^"]*)"|([^\s,]+))/g;
        let argMatch;
        while ((argMatch = argRegex.exec(argsStr)) !== null) {
            const key = argMatch[1];
            const val = argMatch[2] || argMatch[3] || argMatch[4];
            args[key] = val;
        }
        
        if (Object.keys(args).length === 0 && argsStr.trim()) {
            try {
                const cleanedArgs = argsStr.trim().replace(/^['"]|['"]$/g, '');
                const parsed = JSON.parse(`{${cleanedArgs}}`);
                Object.assign(args, parsed);
            } catch (e) {
                if (name === 'initiate_voice_call') {
                    args.reason = argsStr.trim().replace(/^['"]|['"]$/g, '');
                    args.chatSummary = argsStr.trim().replace(/^['"]|['"]$/g, '');
                } else if (name === 'search_products') {
                    args.query = argsStr.trim().replace(/^['"]|['"]$/g, '');
                } else if (name === 'create_payment_link') {
                    args.productName = argsStr.trim().replace(/^['"]|['"]$/g, '');
                } else if (name === 'escalate_to_human') {
                    args.reason = argsStr.trim().replace(/^['"]|['"]$/g, '');
                }
            }
        }
        
        toolCalls.push({
            id: `synthetic_${name}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            type: 'function',
            function: {
                name: name,
                arguments: JSON.stringify(args)
            }
        });
    }
    
    if (toolCalls.length > 0) {
        logger.warn('[Parser Fallback] Successfully parsed synthetic tool calls from Regex', { toolCalls: toolCalls.map(tc => tc.function.name) });
        return toolCalls;
    }

    return null;
}

/**
 * Parses response into structured format
 */
function parseStructuredResponse(content) {
    try {
        const cleaned = cleanJsonString(content);
        
        // Try direct parsing first
        try {
            const parsed = JSON.parse(cleaned);
            return {
                response: parsed.response || "I could not generate a proper response.",
                confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0,
                requiresHuman: !!parsed.requiresHuman
            };
        } catch (innerErr) {
            // Fallback: extract the first { ... } block
            const match = cleaned.match(/\{[\s\S]*\}/);
            if (match) {
                const parsed = JSON.parse(match[0]);
                return {
                    response: parsed.response || "I could not generate a proper response.",
                    confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0,
                    requiresHuman: !!parsed.requiresHuman
                };
            }
            throw innerErr;
        }
    } catch (e) {
        // Fallback: strip outer JSON keys if present in raw string
        let fallbackMsg = content;
        if (content && content.includes('"response":')) {
            const match = content.match(/"response"\s*:\s*"((?:[^"\\]|\\.)*)"/);
            if (match && match[1]) {
                fallbackMsg = match[1].replace(/\\"/g, '"');
            }
        }
        return {
            response: fallbackMsg || "",
            confidence: 0,
            requiresHuman: false
        };
    }
}

async function trackAiUsage(workspaceId, model, provider, usageData) {
    if (!usageData || !prisma.aiUsageLog) return;
    try {
        await prisma.aiUsageLog.create({
            data: {
                userId: workspaceId,
                model,
                provider: provider || 'openai',
                promptTokens: usageData.prompt_tokens || 0,
                completionTokens: usageData.completion_tokens || 0,
                totalTokens: usageData.total_tokens || 0,
                estimatedCost: ((usageData.total_tokens || 0) / 1000000) * 5.0 
            }
        });
    } catch (e) {
        console.error("[AI Engine] Failed to log AI usage:", e.message);
    }
}

/**
 * Helper to determine if a message is casual (LIGHT) or requires full agent capabilities (FULL).
 */
function determineExecutionMode(userMessage) {
    if (!userMessage || typeof userMessage !== 'string') {
        return 'LIGHT';
    }

    const text = userMessage.toLowerCase().trim();

    // 1. Technical/Support triggers for FULL_RAG_MODE
    const technicalKeywords = [
        'api error', 'webhook setup', 'integration help', 'technical support',
        'authentication issues', 'campaign configuration', 'config', 'error',
        'bug', 'issue', 'broken', 'failed', 'setup webhook', 'integrate',
        'connect api', 'integration', 'developer', 'webhook'
    ];
    const isTechnical = technicalKeywords.some(kw => text.includes(kw));
    if (isTechnical) {
        return 'FULL_RAG';
    }

    // 2. Business intent triggers for LIGHT_RAG_MODE
    const businessKeywords = [
        'details', 'more info', 'information', 'services', 'products',
        'business', 'company', 'software', 'api', 'automation', 'whatsapp api',
        'pricing', 'features', 'plans', 'demo', 'explain', 'tell me about',
        'what do you offer', 'about company', 'support', 'setup', 'marketing',
        'ai tools', 'price', 'cost', 'pay', 'payment', 'link', 'product',
        'search', 'catalog', 'item', 'bill', 'checkout', 'refund', 'invoice',
        'purchase', 'buy', 'order'
    ];
    const isBusiness = businessKeywords.some(kw => text.includes(kw));
    if (isBusiness) {
        return 'LIGHT_RAG';
    }

    // 3. Fallback to LIGHT_MODE for casual small talk
    return 'LIGHT';
}

/**
 * PHASE 2A: Modular Executor
 * Called by the Workflow Planner after intent detection.
 */
function getFallbackMessage(workspaceId, errorType, agentConfig) {
    const SYSTEM_DEFAULT_FALLBACKS = {
        rateLimit: [
            "Thoda high traffic chal raha hai 😊 Please ek baar dubara try kariye.",
            "AI assistant abhi thoda busy hai 😅",
            "Ek sec please 🚀",
            "We are receiving a high volume of messages. Please try again in a moment! 😊",
            "अभी हमारे पास बहुत सारे संदेश आ रहे हैं। कृपया थोड़ी देर में पुनः प्रयास करें! 🙏"
        ],
        providerDown: [
            "Server pe load thoda jyada hai, hum abhi theek kar rahe hain! 🛠️",
            "Our systems are temporarily overloaded. We'll be right back! 🚀",
            "हमारी प्रणालियाँ अस्थायी रूप से व्यस्त हैं। हम जल्द ही वापस आएंगे! 🙏"
        ],
        networkError: [
            "Network me thoda issue lag raha hai, please ek bar phir se try karein! 📶",
            "We're experiencing minor connection issues. Let's try again in a moment! 📶"
        ],
        unknownError: [
            "Kuch unexpected error aayi hai. Main abhi check karta hu! 😅",
            "Something unexpected happened on our end. Let me double-check that! 🤔"
        ],
        allProvidersFailed: [
            "Sabhi AI systems busy hain. Humare team ko updates bhej diye gaye hain! 📢",
            "All our AI channels are fully busy. Our support team has been notified! 📢"
        ],
        aiDisabled: [
            "AI assistant abhi band hai. Jaldi hi humare agent aapse contact karenge! 🤝",
            "The AI assistant is currently paused. A human agent will connect with you soon! 🤝"
        ],
        maintenance: [
            "AI system abhi maintenance par hai. Bas kuch hi der me active ho jayega! 🛠️",
            "The AI system is undergoing standard maintenance. Back online shortly! 🛠️"
        ],
        invalidApiKey: [
            "[AI PROVIDER ERROR] Invalid API Key. Please configure or verify your API credentials in the AI settings tab."
        ]
    };

    const emergencyFallbacks = {
        rateLimit: "Thoda high traffic chal raha hai 😊 Please ek baar dubara try kariye.",
        providerDown: "Server pe load thoda jyada hai, hum abhi theek kar rahe hain! 🛠️",
        networkError: "Network me thoda issue lag raha hai, please ek bar phir se try karein! 📶",
        unknownError: "Kuch unexpected error aayi hai. Main abhi check karta hu! 😅",
        allProvidersFailed: "Sabhi AI systems busy hain. Humare team ko updates bhej diye gaye hain! 📢",
        aiDisabled: "AI assistant abhi band hai. Jaldi hi humare agent aapse contact karenge! 🤝",
        maintenance: "AI system abhi maintenance par hai. Bas kuch hi der me active ho jayega! 🛠️",
        invalidApiKey: "[AI PROVIDER ERROR] Invalid API Key. Please configure or verify your API credentials in the AI settings tab."
    };

    try {
        if (agentConfig && agentConfig.aiErrorResponses) {
            let configResponses = typeof agentConfig.aiErrorResponses === 'string' 
                ? JSON.parse(agentConfig.aiErrorResponses) 
                : agentConfig.aiErrorResponses;
            
            const customArray = configResponses[errorType];
            if (Array.isArray(customArray) && customArray.length > 0) {
                const randomIndex = Math.floor(Math.random() * customArray.length);
                return customArray[randomIndex];
            }
        }
    } catch (e) {
        console.error("[AI Fallback System] Failed to parse custom fallback responses:", e.message);
    }

    const defaultArray = SYSTEM_DEFAULT_FALLBACKS[errorType] || [emergencyFallbacks[errorType]];
    const randomIndex = Math.floor(Math.random() * defaultArray.length);
    return defaultArray[randomIndex] || emergencyFallbacks[errorType];
}

async function processAgenticWorkflow(params) {
    const { 
        workspaceId, contactPhone, userMessage, 
        systemPrompt: initialSystemPrompt, allowedTools, confidenceThreshold = 40,
        model = "gpt-4o", apiKey, provider = "openai"
    } = params;

    // ─── LOAD CONFIG & MAINTENANCE CHECKS ──────────────────────────────────────
    const agentConfig = prisma.aiAgent ? await prisma.aiAgent.findUnique({ where: { userId: workspaceId } }) : null;

    if (process.env.MAINTENANCE_MODE === 'true') {
        console.log("[AI Engine] System is under Maintenance Mode.");
        return getFallbackMessage(workspaceId, 'maintenance', agentConfig);
    }

    if (agentConfig && agentConfig.isActive === false) {
        console.log(`[AI Engine] AI is disabled for workspace ${workspaceId}.`);
        return getFallbackMessage(workspaceId, 'aiDisabled', agentConfig);
    }

    // ─── 4-TIER ARCHITECTURE MODES DETERMINATION ──────────────────────────────
    let executionMode = determineExecutionMode(userMessage);

    let contact = null;
    try {
        const phoneForms = [
            contactPhone,
            contactPhone.startsWith('+') ? contactPhone.substring(1) : '+' + contactPhone,
        ];
        contact = prisma.contact ? await prisma.contact.findFirst({
            where: { userId: workspaceId, phone: { in: phoneForms } }
        }) : null;
    } catch (e) {
        console.error("[AI Engine] Failed to load contact context early:", e.message);
    }
    const contactName = contact?.name || 'Customer';
    const businessName = agentConfig?.name || "Workspace Assistant";

    let toolsEnabled = executionMode === 'FULL_RAG';
    let ragEnabled = executionMode === 'FULL_RAG';
    let memoryEnabled = true;

    let allowedToolsList = Array.isArray(allowedTools) ? allowedTools : [];
    if (allowedToolsList.length === 0) {
        allowedToolsList = ['search_products', 'create_payment_link', 'escalate_to_human', 'recommend_products', 'get_customer_intelligence', 'initiate_voice_call', 'schedule_callback', 'send_whatsapp_message'];
    }

    // Load RAG Context
    let ragContext = "";
    let ragSize = 0;
    if (ragEnabled && agentConfig?.knowledgeWebsite) {
        const websiteUrl = agentConfig.knowledgeWebsite;
        const cacheKey = `ai_crawled_website:${workspaceId}`;
        try {
            let cachedContent = await redis.get(cacheKey);
            if (!cachedContent) {
                console.log(`[RAG Scraper] Triggering background crawl for: ${websiteUrl}`);
                const { scrapeWebsiteContent } = require('../context');
                scrapeWebsiteContent(websiteUrl).then(scraped => {
                    if (scraped) {
                        redis.set(cacheKey, scraped, 'EX', 86400);
                    }
                }).catch(err => {
                    console.error(`[RAG Scraper] background scrape fail:`, err.message);
                });
                cachedContent = "CRAWLING_IN_PROGRESS";
                await redis.set(cacheKey, "CRAWLING_IN_PROGRESS", 'EX', 120);
            }
            if (cachedContent && cachedContent !== "CRAWLING_IN_PROGRESS") {
                ragContext = cachedContent;
                ragSize = estimateTokens(ragContext);
            }
        } catch (e) {
            console.error("[AI Engine] RAG cache load error:", e.message);
        }
    }

    // Assemble System Prompt Base
    const rawPrompt = agentConfig?.systemPrompt || `You are an AI assistant for ${businessName}.`;
    const shortRawPrompt = trimToTokens(rawPrompt, 1000);

    let systemPromptBase = "";
    if (executionMode === 'FULL_RAG') {
        systemPromptBase = `[SYSTEM PROMPT]\n${shortRawPrompt}\n\n[WORKSPACE]\n- Name: ${businessName}\n`;
        try {
            const store = prisma.ecomStore ? await prisma.ecomStore.findFirst({
                where: { userId: workspaceId, status: 'connected' }
            }) : null;
            if (store) {
                systemPromptBase += `\n[INTEGRATIONS]\n- Ecommerce: Connected Store: ${store.storeName} (${store.platform})\n`;
            }
        } catch (e) {
            console.error("[AI Engine] Store load error:", e.message);
        }

        if (contact) {
            systemPromptBase += `\n[CUSTOMER]\n- Name: ${contact.name || 'Unknown'}\n- Phone: ${contact.phone}\n- Tags: ${(contact.tags || []).join(', ') || 'None'}\n`;
        }
    } else if (executionMode === 'LIGHT_RAG') {
        if (agentConfig?.systemPrompt && agentConfig.systemPrompt.trim().length > 0) {
            systemPromptBase = `[YOUR PERSONA & ROLE]
${shortRawPrompt}

Rules:
1. Sound human, confident, consultative, and conversational. Avoid aggressive or pushy sales tactics.
2. Explain things clearly and completely. Never end your response mid-word or mid-sentence. Always complete the response naturally and grammatically. Keep replies concise and engaging (2-4 sentences).
3. Guide the conversation naturally. Ask only ONE relevant question at a time to guide the customer.`;
        } else {
            systemPromptBase = `[YOUR PERSONA & ROLE]
${shortRawPrompt}

Your goal is to naturally understand the customer's business needs and guide them toward the correct solution.

You sell:
- WhatsApp APIs
- SaaS panels
- AI automation systems
- AI voice systems
- digital marketing solutions

Rules:
1. Sound human, confident, founder-like, premium, and consultative. NOT like an FAQ bot, helpdesk AI, or support bot. Avoid aggressive sales tactics.
2. Explain things clearly and completely. Never end your response mid-word or mid-sentence. Always complete the response naturally and grammatically. Keep replies concise and engaging (2-4 sentences).
3. Guide the conversation naturally and softly qualify leads.
4. Never dump features, never sound robotic, never hard sell.
5. ALWAYS try to continue the conversation intelligently with ONE qualifying question instead of ending it quickly (never say phrases like "Ji bilkul! Agar aur sawal ho to bataye").
6. Rely on consultative selling & lead qualification.

Conversion Examples:
- User says "marketing" -> Reply with something like: "Aap Instagram/Facebook ads chalana chahte ho ya WhatsApp marketing side par focus hai? 🚀"
- User says "API" -> Reply with something like: "Aap official WhatsApp API apne business ke liye chahte ho ya resale/white-label purpose ke liye? 😊"
- User says "automation" -> Reply with something like: "Aap customer support automate karna chahte ho ya marketing/sales workflow side par automation chahiye? 👀"`;
        }
    } else {
        systemPromptBase = `[YOUR PERSONA & ROLE]
${shortRawPrompt}

Reply naturally in conversational Hinglish or English. Sound human, warm, helpful, consultative, and professional. Explain things clearly and completely. Never end your response mid-word or mid-sentence. Always complete the response naturally and grammatically. Keep replies concise and engaging.`;
    }

    systemPromptBase += `\n\n[CUSTOMER INFO]\n- Customer Name: ${contactName}. Rule: Warmly greet the customer by name.`;
    let systemPromptSize = estimateTokens(systemPromptBase);

    // ─── MEMORY LOADING & EMBEDDED CAPACITY ENFORCEMENTS ──────────────────────
    let memoryMessages = [];
    let memorySize = 0;
    let summary = "";

    if (memoryEnabled) {
        const memoryKey = `ai_chat_history:${workspaceId}:${contactPhone}`;
        try {
            const historyStr = await redis.get(memoryKey);
            if (historyStr) {
                const historyObj = JSON.parse(historyStr);
                let rawHistory = [];
                if (Array.isArray(historyObj)) {
                    rawHistory = historyObj;
                } else if (historyObj && typeof historyObj === 'object') {
                    summary = historyObj.summary || "";
                    rawHistory = historyObj.messages || [];
                }

                if (executionMode === 'LIGHT') {
                    memoryMessages = rawHistory.slice(-4);
                    summary = "";
                    while (memoryMessages.length > 0) {
                        const totalTokens = memoryMessages.reduce((sum, m) => sum + estimateTokens(m.content || ''), 0);
                        if (totalTokens <= 70) break;
                        memoryMessages.shift();
                    }
                } else if (executionMode === 'LIGHT_RAG') {
                    memoryMessages = rawHistory.slice(-6);
                } else if (executionMode === 'FULL_RAG') {
                    memoryMessages = rawHistory.slice(-10);
                }

                memorySize = memoryMessages.reduce((sum, m) => sum + estimateTokens(m.content || ''), 0);

                // ABSOLUTE EMERGENCY MEMORY CAP: Max 250 tokens
                if (memorySize > 250) {
                    console.log(`[AI Engine] Loaded memory of ${memorySize} exceeds emergency limit of 250. Truncating.`);
                    while (memoryMessages.length > 0 && memorySize > 250) {
                        memoryMessages.shift();
                        memorySize = memoryMessages.reduce((sum, m) => sum + estimateTokens(m.content || ''), 0);
                    }
                }
            }
        } catch (e) {
            console.error("[AI Engine] Memory load error:", e.message);
        }
    }

    let filteredToolsDefinitions = toolsEnabled
        ? toolsDefinitions.filter(t => allowedToolsList.includes(t.function.name))
        : [];
    let toolsSize = filteredToolsDefinitions.reduce((sum, t) => sum + estimateTokens(JSON.stringify(t)), 0);
    const userMsgSize = estimateTokens(userMessage);

    let estimatedTokens = systemPromptSize + ragSize + memorySize + userMsgSize + toolsSize;

    // TPM/TPD SAFETY DOWNGRADE (Auto downgrade to LIGHT_RAG if > 800 tokens)
    if (estimatedTokens > 800 && executionMode === 'FULL_RAG') {
        console.warn(`[AI Engine TPM/TPD Protection] Estimated tokens (${estimatedTokens}) exceeds 800. Downgrading.`);
        executionMode = 'LIGHT_RAG';
        toolsEnabled = false;
        ragEnabled = false;
        memoryMessages = memoryMessages.slice(-6);
        memorySize = memoryMessages.reduce((sum, m) => sum + estimateTokens(m.content || ''), 0);
        filteredToolsDefinitions = [];
        toolsSize = 0;
        estimatedTokens = systemPromptSize + memorySize + userMsgSize;
    }

    // HARD TOKEN ENFORCER (Absolute max fallback: 1500 tokens)
    if (estimatedTokens > 1500) {
        console.warn(`[AI Hard Token Enforcer] Payload too heavy (${estimatedTokens}). Downscaling.`);
        if (memoryMessages.length > 0) {
            memoryMessages = memoryMessages.slice(-2);
            memorySize = memoryMessages.reduce((sum, m) => sum + estimateTokens(m.content || ''), 0);
            estimatedTokens = systemPromptSize + ragSize + memorySize + userMsgSize + toolsSize;
        }
        if (estimatedTokens > 1500 && memoryMessages.length > 0) {
            memoryMessages = [];
            memorySize = 0;
            estimatedTokens = systemPromptSize + ragSize + memorySize + userMsgSize + toolsSize;
        }
        if (estimatedTokens > 1500 && ragSize > 250) {
            ragContext = trimToTokens(ragContext, 250);
            ragSize = estimateTokens(ragContext);
            estimatedTokens = systemPromptSize + ragSize + memorySize + userMsgSize + toolsSize;
        }
        if (estimatedTokens > 1500 && ragContext) {
            ragContext = "";
            ragSize = 0;
            ragEnabled = false;
            estimatedTokens = systemPromptSize + ragSize + memorySize + userMsgSize + toolsSize;
        }
    }

    // Build Final System Prompt
    let strictJsonPrompt = `${systemPromptBase}`;
    if (ragEnabled && ragContext) {
        strictJsonPrompt += `\n\n[BUSINESS KNOWLEDGE BASE]\n${ragContext}`;
    }
    if (summary && executionMode !== 'LIGHT') {
        strictJsonPrompt += `\n\n[CONVERSATION SUMMARY]\n${summary}`;
    }
    if (memoryMessages.some(m => m.role === 'assistant')) {
        strictJsonPrompt += `\n\n[CONVERSATIONAL CONTINUITY]\n- You have already greeted the customer and/or introduced the company in previous messages.\n- Do NOT repeat standard greetings (e.g. 'Hi', 'Hello', 'Namaste'), company introductions, or onboarding questions (e.g. 'How can I help you?').\n- Continue the conversation naturally from the last exchange.\n- If the customer says simple words like 'thanks', 'yes', 'ok', reply with short, natural, human-like affirmations (e.g. 'Glad to help! 😊', 'Perfect! 👍', 'Awesome!') instead of restarting the company/services onboarding pitch.`;
    }

    if (executionMode === 'FULL_RAG') {
        strictJsonPrompt += `\n\nIMPORTANT RULES:
1. You MUST ONLY reply with a valid JSON object. Do not include any text, markdown backticks, or comments before or after the JSON.
2. The JSON format must be EXACTLY:
{
  "response": "Your friendly, warm, natural, human-like response to the customer. DO NOT include any internal thoughts, planning steps, or tools talk here.",
  "confidence": 95,
  "requiresHuman": false,
  "internalPlan": "Explain your logic briefly"
}
3. The "response" field is what the customer sees on WhatsApp. Keep it professional, friendly, and complete. If the customer greets you (like "hi" or "hello"), welcome them warmly and briefly introduce yourself as the business's assistant.
4. AI NEVER GUESSES OR INVENT PRICING OR LINKS: You must NEVER invent, predict, estimate, or modify any product pricing or payment links. All product lookup and price fetching must be performed strictly using the "search_products" tool. Payment links must be generated strictly using the "create_payment_link" tool. Do NOT guess or shorten urls. If the product catalog is ambiguous or multiple options match, ask the customer for clarification. If a tool returns an error or pricing is not found, state that the payment system is temporarily unavailable and you are notifying support.
5. VOICE CALLBACK AND MESSAGE SCHEDULING: If the customer requests a call back or wants to schedule a follow-up call, you MUST trigger the "schedule_callback" tool with the exact dateTime they requested. If they want to send a text message, use the "send_whatsapp_message" tool.
6. Consultative Persona: Sound human, consultative, and warm. Avoid aggressive or pushy sales tactics.
7. Response Completion Rules: Never end your response mid-word or mid-sentence. Always complete the response naturally and grammatically.`;
    }

    let maxTokensLimit = 200;
    if (executionMode === 'LIGHT_RAG') {
        maxTokensLimit = 350;
    } else if (executionMode === 'FULL_RAG') {
        maxTokensLimit = 600;
    }

    let messages = [{ role: 'system', content: strictJsonPrompt }];
    if (memoryMessages && memoryMessages.length > 0) {
        messages.push(...memoryMessages);
    }
    messages.push({ role: 'user', content: userMessage });

    const payloadForDiag = {
        model: model,
        messages: messages,
        max_tokens: maxTokensLimit,
        contactPhone: contactPhone
    };
    if (filteredToolsDefinitions.length > 0) {
        payloadForDiag.tools = filteredToolsDefinitions;
        payloadForDiag.tool_choice = "auto";
    }

    const isJsonModeCompatible = provider && provider.toLowerCase() === 'openai' && executionMode === 'FULL_RAG';
    if (isJsonModeCompatible) {
        payloadForDiag.response_format = { type: "json_object" };
    }

    // ─── UNIVERSAL PROVIDER FAILOVER LAYER ────────────────────────────────────
    const fallbackProviders = [];
    fallbackProviders.push({ provider, apiKey, model });

    // Grab Admin credentials as standard failover backup
    const adminUser = prisma.user ? await prisma.user.findFirst({ where: { role: 'SUPERADMIN' } }) : null;
    if (adminUser && adminUser.aiApiKey && adminUser.aiProvider && adminUser.aiProvider.toLowerCase() !== provider.toLowerCase()) {
        fallbackProviders.push({
            provider: adminUser.aiProvider,
            apiKey: adminUser.aiApiKey,
            model: adminUser.aiModel || 'gpt-4o-mini'
        });
    }
    // Universal secondary backup: OpenRouter free tier
    if (provider.toLowerCase() !== 'openrouter' && adminUser && adminUser.aiProvider?.toLowerCase() === 'openrouter' && adminUser.aiApiKey) {
        fallbackProviders.push({
            provider: 'openrouter',
            apiKey: adminUser.aiApiKey,
            model: 'meta-llama/llama-3.3-70b-instruct:free'
        });
    }

    let currentProviderIndex = 0;
    let lastError = null;
    let responseMessage = null;
    let aiRes = null;
    let usedProvider = provider;
    let usedModel = model;

    while (currentProviderIndex < fallbackProviders.length) {
        const activeConfig = fallbackProviders[currentProviderIndex];
        usedProvider = activeConfig.provider;
        usedModel = activeConfig.model;
        const activeApiKey = activeConfig.apiKey;

        try {
            console.log(`[Universal Failover] Attempting Provider: ${usedProvider} | Model: ${usedModel} (${currentProviderIndex + 1}/${fallbackProviders.length})`);
            
            const payload = { ...payloadForDiag, model: usedModel };

            if (usedProvider === 'groq') {
                const isInvalidForGroq = !payload.model 
                    || payload.model.startsWith('gpt')
                    || payload.model.startsWith('claude')
                    || payload.model.startsWith('gemini')
                    || payload.model.startsWith('openrouter')
                    || payload.model.startsWith('mistral')
                    || payload.model.startsWith('command')
                    || payload.model.includes('/');
                if (isInvalidForGroq) {
                    payload.model = 'llama-3.3-70b-versatile';
                }
                if (payload.response_format) delete payload.response_format;
            }

            if (payload.messages && Array.isArray(payload.messages)) {
                payload.messages = payload.messages.map(m => {
                    const cleanMsg = { ...m };
                    delete cleanMsg.refusal;
                    return cleanMsg;
                });
            }

            const tStart = Date.now();
            aiRes = await callDynamicAi(usedProvider, activeApiKey, payload);
            const latencyMs = Date.now() - tStart;
            console.log(`[Universal Failover Success] Latency: ${latencyMs}ms | Provider: ${usedProvider}`);
            
            responseMessage = aiRes.data.choices[0].message;
            break;
        } catch (err) {
            lastError = err;
            const statusCode = err.response?.status;
            console.error(`[Universal Failover Crashed] Provider: ${usedProvider} | Status: ${statusCode || 'N/A'} | Error: ${err.message}`);
            currentProviderIndex++;
        }
    }

    // If all providers in failover fail
    if (!responseMessage) {
        console.error("[Universal Failover] Exhausted all fallback channels.");
        const statusCode = lastError?.response?.status;
        const errorType = (statusCode === 401) ? 'invalidApiKey' :
                          (statusCode === 429) ? 'rateLimit' :
                          (statusCode >= 500) ? 'providerDown' :
                          (lastError?.code === 'ECONNRESET' || lastError?.code === 'ETIMEDOUT' || lastError?.message?.includes('timeout') || lastError?.message?.includes('Network Error')) ? 'networkError' :
                          'allProvidersFailed';

        // Suppress diagnostic errors in production when DEBUG_MODE is false
        if (process.env.DEBUG_MODE === 'true') {
            const errorMsg = lastError?.response?.data?.error?.message || lastError?.message || 'Unknown Error';
            return `[AI PROVIDER ERROR] Provider: ${usedProvider} | Model: ${usedModel} | Status: ${statusCode || 'N/A'}\nDetails: ${errorMsg}`;
        } else {
            return getFallbackMessage(workspaceId, errorType, agentConfig);
        }
    }

    await trackAiUsage(workspaceId, usedModel, usedProvider, aiRes.data?.usage);

    // Tool executions
    let toolCalls = responseMessage.tool_calls;
    if (!toolCalls || toolCalls.length === 0) {
        toolCalls = parseSyntheticToolCalls(responseMessage.content);
    }

    if (toolCalls && toolCalls.length > 0) {
        // Ambiguous Call Request Interception
        const hasVoiceCall = toolCalls.some(tc => tc.function?.name === 'initiate_voice_call');
        if (hasVoiceCall && !isExplicitCallRequest(userMessage)) {
            console.log("[AI Engine] Intercepted ambiguous voice call request. Prompting for confirmation.");
            return "Kya aap abhi call connect karna chahte hain?";
        }

        console.log(`[AI Engine] Running ${toolCalls.length} tool calls.`);
        const toolResults = [];
        for (const tc of toolCalls) {
            const toolName = tc.function?.name;
            try {
                const toolResult = await executeTool(workspaceId, contactPhone, tc);
                toolResults.push({
                    toolCallId: tc.id,
                    toolName: toolName,
                    result: toolResult
                });
            } catch (toolErr) {
                console.error(`[AI Engine] Tool ${toolName} execution error:`, toolErr.message);
                toolResults.push({
                    toolCallId: tc.id,
                    toolName: toolName,
                    result: JSON.stringify({ error: toolErr.message })
                });
            }
        }

        messages.push(responseMessage);
        for (const tr of toolResults) {
            messages.push({
                role: 'tool',
                tool_call_id: tr.toolCallId,
                name: tr.toolName,
                content: typeof tr.result === 'string' ? tr.result : JSON.stringify(tr.result)
            });
        }

        const followUpPayload = {
            model: usedModel,
            messages: messages,
            max_tokens: maxTokensLimit
        };
        if (isJsonModeCompatible) {
            followUpPayload.response_format = { type: "json_object" };
        }

        try {
            const activeApiKey = fallbackProviders[currentProviderIndex]?.apiKey;
            const followUpRes = await callDynamicAi(usedProvider, activeApiKey, followUpPayload);
            responseMessage = followUpRes.data.choices[0].message;
        } catch (followUpErr) {
            console.error("[AI Engine] Tool Followup LLM request failed:", followUpErr.message);
            if (process.env.DEBUG_MODE === 'true') {
                return `[AI FOLLOWUP ERROR] ${followUpErr.message}`;
            } else {
                return getFallbackMessage(workspaceId, 'providerDown', agentConfig);
            }
        }
    }

    // Parse structured JSON response
    let structuredData = parseStructuredResponse(responseMessage.content);

    // Save history & perform Memory Compression
    if (memoryEnabled) {
        const memoryKey = `ai_chat_history:${workspaceId}:${contactPhone}`;
        try {
            const historyStr = await redis.get(memoryKey);
            let currentSummary = "";
            let rawHistory = [];
            let lastCompressedAt = 0;

            if (historyStr) {
                try {
                    const parsed = JSON.parse(historyStr);
                    if (Array.isArray(parsed)) {
                        rawHistory = parsed;
                    } else if (parsed && typeof parsed === 'object') {
                        currentSummary = parsed.summary || "";
                        rawHistory = parsed.messages || [];
                        lastCompressedAt = parsed.lastCompressedAt || 0;
                    }
                } catch (err) {
                    console.error("[AI Engine] Failed to parse history:", err.message);
                }
            }

            rawHistory.push({ role: 'user', content: userMessage });
            rawHistory.push({ role: 'assistant', content: structuredData.response });

            const timeSinceLastCompress = Date.now() - lastCompressedAt;
            if (rawHistory.length >= 12 && timeSinceLastCompress >= 180000) {
                const toCompress = rawHistory.slice(0, rawHistory.length - 6);
                const toKeep = rawHistory.slice(rawHistory.length - 6);

                const conversationText = toCompress
                    .map(m => `${m.role === 'user' ? 'Customer' : 'Assistant'}: ${m.content}`)
                    .join('\n');

                let cheapModel = usedModel;
                const lowerProvider = (usedProvider || '').toLowerCase();
                if (lowerProvider === 'openai') {
                    cheapModel = 'gpt-4o-mini';
                } else if (lowerProvider === 'groq') {
                    cheapModel = 'llama3-8b-8192';
                } else if (lowerProvider === 'openrouter') {
                    cheapModel = 'meta-llama/llama-3-8b-instruct:free';
                }

                const summaryPrompt = `You are a conversation summarizer. Update the existing conversation summary to incorporate the new messages. Keep it ultra-compact, max 1 short sentence (20-30 tokens max). Do NOT use any preambles, quotes, or markdown. Focus purely on user intent and key topics.

Good Example: "User interested in WhatsApp API reseller setup and marketing automation."

Existing Summary: "${currentSummary || 'None'}"
New messages:
${conversationText}

Provide only the updated compact summary.`;

                console.log(`[AI Memory Compression] Summarizing ${contactPhone} using ${cheapModel}`);
                try {
                    const activeApiKey = fallbackProviders[currentProviderIndex]?.apiKey;
                    const summaryRes = await callDynamicAi(usedProvider, activeApiKey, {
                        model: cheapModel,
                        messages: [{ role: 'user', content: summaryPrompt }],
                        max_tokens: 40,
                        temperature: 0.3
                    });

                    let newSummary = summaryRes.data.choices[0].message.content || "";
                    newSummary = newSummary.replace(/^["']|["']$/g, '').trim();
                    if (newSummary) {
                        currentSummary = newSummary;
                        rawHistory = toKeep;
                        lastCompressedAt = Date.now();
                        console.log(`[Memory Compressed] New Summary: "${currentSummary}"`);
                    }
                } catch (sumErr) {
                    console.error("[Memory Compression Failed]", sumErr.message);
                    if (rawHistory.length > 20) {
                        rawHistory = rawHistory.slice(-20);
                    }
                }
            } else {
                if (rawHistory.length > 20) {
                    rawHistory = rawHistory.slice(-20);
                }
            }

            const dataToSave = {
                summary: currentSummary,
                messages: rawHistory,
                lastCompressedAt: lastCompressedAt
            };

            // Mode-specific TTL (FULL_RAG: 48h (172800s), Other: 24h (86400s))
            const ttlSeconds = (executionMode === 'FULL_RAG') ? 172800 : 86400;
            await redis.set(memoryKey, JSON.stringify(dataToSave), 'EX', ttlSeconds);
        } catch (e) {
            console.error("[AI Engine] Memory save error:", e.message);
        }
    }

    const isDebugMode = process.env.DEBUG_MODE === 'true';
    if (isDebugMode) {
        const promptLoaded = (agentConfig?.systemPrompt && agentConfig.systemPrompt.trim().length > 0) ? 'YES' : 'NO';
        const ragLoaded = (ragContext && ragContext.trim().length > 0) ? 'YES' : 'NO';
        const memoryLoaded = (memoryMessages && memoryMessages.length > 0) ? 'YES' : 'NO';
        const debugFooter = `\n\n[DEBUG]\nPromptLoaded: ${promptLoaded}\nRAGLoaded: ${ragLoaded}\nMemoryLoaded: ${memoryLoaded}`;
        return structuredData.response + debugFooter;
    }

    return structuredData.response;
}

module.exports = { processAgenticWorkflow };

