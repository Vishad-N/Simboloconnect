const prisma = require('../../../prismaClient');
const redis = require('../../redisConnection');
const { validateToolExecution } = require('../security/toolValidator');
const CheckoutManager = require('../../payments/CheckoutManager');
const GatewayRouter = require('../../payments/GatewayRouter');
const CustomerIntelligenceService = require('../../commerce/CustomerIntelligenceService');
const CallEscalationService = require('../../voice/CallEscalationService');
const MetaApiService = require('../../MetaApiService');
const VoiceQueueManager = require('../../voice/VoiceQueueManager');

// Define tools for OpenAI API
const toolsDefinitions = [
    {
        type: "function",
        function: {
            name: "search_products",
            description: "Search for a product in the workspace database based on name or category. Use this when a user asks about a product, pricing, or availability.",
            parameters: {
                type: "object",
                properties: {
                    query: { type: "string", description: "The product name or keyword" }
                },
                required: ["query"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "create_payment_link",
            description: "Create a secure payment link for a product. Use this ONLY when the user explicitly asks to buy or pay. The system automatically selects the best payment gateway. Pricing is strictly backend-determined.",
            parameters: {
                type: "object",
                properties: {
                    productName: { type: "string", description: "The EXACT name of the product as it appears in the catalog" }
                },
                required: ["productName"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "escalate_to_human",
            description: "Escalate the conversation to a human agent. Use this if the user is angry, asking for a refund, or if you are not confident in your answer.",
            parameters: {
                type: "object",
                properties: {
                    reason: { type: "string", description: "The reason for escalating to a human." }
                },
                required: ["reason"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "recommend_products",
            description: "Suggest related, complementary, or premium products based on what the customer is viewing or has bought. Use this for upselling and cross-selling.",
            parameters: {
                type: "object",
                properties: {
                    currentProductName: { type: "string", description: "The product the customer is currently interested in" },
                    strategy: { type: "string", enum: ["upsell", "cross_sell", "bundle"], description: "The recommendation strategy to use" }
                },
                required: ["currentProductName", "strategy"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "get_customer_intelligence",
            description: "Retrieve the customer's purchase history, lifetime value, segment, and churn risk. Use this to personalize conversations and offers.",
            parameters: {
                type: "object",
                properties: {
                    includeHistory: { type: "boolean", description: "Whether to include recent order history" }
                },
                required: []
            }
        }
    },
    {
        type: "function",
        function: {
            name: "initiate_voice_call",
            description: "Escalate the conversation from text chat to a live AI Voice Call. Use this if the user asks you to call them, if they are a hot lead ready to close, or if the conversation requires voice assistance.",
            parameters: {
                type: "object",
                properties: {
                    reason: { type: "string", description: "Reason for escalating to a voice call." },
                    chatSummary: { type: "string", description: "A summary of the current chat conversation to pass to the voice AI." }
                },
                required: ["reason", "chatSummary"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "schedule_callback",
            description: "Schedule a callback or follow-up voice call with the customer. Use this when the customer requests a call back or schedules a specific time to be called.",
            parameters: {
                type: "object",
                properties: {
                    dateTime: { type: "string", description: "The date and time for the callback (e.g. tomorrow at 3 PM or 2026-05-21 15:30)" },
                    reason: { type: "string", description: "Reason for the callback call" }
                },
                required: ["dateTime"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "send_whatsapp_message",
            description: "Send a custom text or follow-up message to the customer via WhatsApp.",
            parameters: {
                type: "object",
                properties: {
                    message: { type: "string", description: "The message content to send to the customer." }
                },
                required: ["message"]
            }
        }
    }
];

// Promise timeout wrapper
const withTimeout = (promise, ms) => {
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(`[Tool Timeout] Execution exceeded ${ms}ms`)), ms);
    });
    return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutId));
};

// Redis sliding window rate limiter
async function checkRateLimit(workspaceId) {
    const key = `ai_rate:${workspaceId}:tools`;
    const maxRequests = 30; // Max tool calls per minute
    
    const currentCount = await redis.incr(key);
    if (currentCount === 1) {
        await redis.expire(key, 60);
    }
    if (currentCount > maxRequests) {
        throw new Error("[Rate Limit Exceeded] Too many tool executions for this workspace.");
    }
}

/**
 * Execute a tool safely inside the workspace boundary.
 */
async function executeTool(workspaceId, contactPhone, toolCall) {
    const name = toolCall.function.name;
    const argsStr = toolCall.function.arguments || "{}";
    const startTime = Date.now();
    let args = {};

    try {
        args = JSON.parse(argsStr);
    } catch (e) {
        return JSON.stringify({ error: "Invalid JSON arguments provided to tool." });
    }

    let result;
    let contactId = null;
    let isSandbox = false;

    try {
        // 1. Infinite Loop Protection Check
        const loopProtectionKey = `failed_tool:${workspaceId}:${contactPhone}:${name}`;
        const isFailedPreviously = await redis.get(loopProtectionKey);
        if (isFailedPreviously) {
            throw new Error(`[Infinite Loop Protection] Tool '${name}' previously failed in this session. Retrying is blocked to prevent loops.`);
        }

        // 2. Duplicate Trigger & Outbound Rate Limiting for voice calls
        if (name === 'initiate_voice_call') {
            const cooldownKey = `voice_call_cooldown:${workspaceId}:${contactPhone}`;
            const hasCooldown = await redis.get(cooldownKey);
            if (hasCooldown) {
                throw new Error("[Duplicate Blocked] A voice call was recently initiated for this contact. Please wait 5 minutes before trying again.");
            }

            const countKey = `voice_call_count:${workspaceId}:${contactPhone}`;
            const callCountStr = await redis.get(countKey);
            const callCount = callCountStr ? parseInt(callCountStr, 10) : 0;
            if (callCount >= 3) {
                throw new Error("[Rate Limit Blocked] Outbound call limit exceeded (Max 3 calls per contact per 24 hours).");
            }
        }

        // 3. Redis Rate Limiting (General tools rate limiter)
        await checkRateLimit(workspaceId);

        // 4. Strict Security Validation Layer
        const validationResult = await validateToolExecution(workspaceId, contactPhone, name, args);
        contactId = validationResult.contactId;
        isSandbox = validationResult.isSandbox;

        // 5. Tool Execution with Timeout (10 seconds)
        const executionPromise = (async () => {
            switch (name) {
                case "search_products":
                    return await searchProductsTool(workspaceId, args.query);
                case "create_payment_link":
                    return await createPaymentLinkTool(workspaceId, contactPhone, args.productName, args.amount, isSandbox);
                case "escalate_to_human":
                    return await escalateToHumanTool(workspaceId, contactPhone, args.reason);
                case "recommend_products":
                    return await recommendProductsTool(workspaceId, args.currentProductName, args.strategy);
                case "get_customer_intelligence":
                    return await getCustomerIntelligenceTool(workspaceId, contactPhone, args.includeHistory);
                case "initiate_voice_call":
                    return await initiateVoiceCallTool(workspaceId, contactPhone, contactId, args.chatSummary);
                case "schedule_callback":
                    return await scheduleCallbackTool(workspaceId, contactPhone, args.dateTime, args.reason);
                case "send_whatsapp_message":
                    return await sendWhatsappMessageTool(workspaceId, contactPhone, args.message);
                default:
                    throw new Error(`Tool ${name} not found`);
            }
        })();

        result = await withTimeout(executionPromise, 10000);

        // Track and cache voice call success to trigger cooldown & increment count
        if (name === 'initiate_voice_call') {
            const cooldownKey = `voice_call_cooldown:${workspaceId}:${contactPhone}`;
            const countKey = `voice_call_count:${workspaceId}:${contactPhone}`;
            await redis.set(cooldownKey, 'active', 'EX', 300);
            const count = await redis.incr(countKey);
            if (count === 1) {
                await redis.expire(countKey, 86400);
            }
        }

        // Log successful action
        const executionTime = Date.now() - startTime;
        await logAction(workspaceId, contactId, name, args, result, "SUCCESS", executionTime, isSandbox);

        // Structured Audit Log for success
        const logger = require('../../logger');
        logger.info('[Tool Audit]', {
            tool: name,
            source: "WhatsApp Chat AI",
            provider: "dynamic-ai",
            customerNumber: contactPhone,
            executionType: toolCall.id && toolCall.id.startsWith('synthetic') ? 'SYNTHETIC' : 'NATIVE',
            timestamp: new Date().toISOString(),
            successStatus: "SUCCESS"
        });

        return result;

    } catch (err) {
        console.error(`[Tool Execution Error] ${name}:`, err.message);
        const executionTime = Date.now() - startTime;
        
        // Find contactId fallback if validation failed
        if (!contactId) {
             const c = await prisma.contact.findFirst({ where: { userId: workspaceId, phone: contactPhone }});
             contactId = c ? c.id : "UNKNOWN";
        }

        await logAction(workspaceId, contactId, name, args, { error: err.message }, "FAILED", executionTime, isSandbox);
        
        // Set Loop Protection block on failure
        const loopProtectionKey = `failed_tool:${workspaceId}:${contactPhone}:${name}`;
        await redis.set(loopProtectionKey, 'failed', 'EX', 120);

        // Structured Audit Log for failure
        const logger = require('../../logger');
        logger.error('[Tool Audit]', {
            tool: name,
            source: "WhatsApp Chat AI",
            provider: "dynamic-ai",
            customerNumber: contactPhone,
            executionType: toolCall.id && toolCall.id.startsWith('synthetic') ? 'SYNTHETIC' : 'NATIVE',
            timestamp: new Date().toISOString(),
            successStatus: "FAILED",
            error: err.message
        });

        return JSON.stringify({ error: err.message });
    }
}

async function searchProductsTool(workspaceId, query) {
    const store = await prisma.ecomStore.findFirst({
        where: { userId: workspaceId }
    });

    if (!store) {
        // Dynamic fallback: No store connected, instruct the LLM to use the website crawl data
        return JSON.stringify({ 
            message: "No ecommerce store connected to this workspace. However, you can refer to the [BUSINESS KNOWLEDGE BASE (CRAWLED DATA)] in your context to answer product details, pricing, and availability. If the user decides to buy a product, call create_payment_link with the product name and correct price." 
        });
    }

    const products = await prisma.ecomProduct.findMany({
        where: {
            userId: workspaceId,
            storeId: store.id,
            title: { contains: query, mode: 'insensitive' }
        },
        take: 3
    });

    if (products.length === 0) {
        return JSON.stringify({ 
            message: "No products found matching the query in catalog. However, if the product is described in the business website crawled data, you can proceed to create a payment link by calling create_payment_link with that product's name and price." 
        });
    }

    return JSON.stringify(products.map(p => ({
        name: p.title,
        price: p.price,
        stock: p.stockStatus
    })));
}

async function createPaymentLinkTool(workspaceId, contactPhone, productName, amount, isSandbox) {
    let secureAmount;
    let finalProductName = productName;

    // 1. Fetch all active products in the workspace catalog to perform dynamic lookup
    const activeProducts = await prisma.ecomProduct.findMany({
        where: { userId: workspaceId, stockStatus: 'active' }
    });

    if (activeProducts.length === 0) {
        console.error(`[createPaymentLinkTool] No active products found in catalog for workspace ${workspaceId}`);
        await escalateToHumanTool(workspaceId, contactPhone, "Payment requested but product catalog is empty.");
        return JSON.stringify({
            error: "PAYMENT_SYSTEM_UNAVAILABLE",
            message: "Payment system temporarily unavailable. Main team ko notify kar raha hoon."
        });
    }

    const query = (productName || '').toLowerCase().trim();
    let matchedProducts = activeProducts.filter(p => p.title.toLowerCase().trim() === query);

    if (matchedProducts.length === 0) {
        matchedProducts = activeProducts.filter(p => p.title.toLowerCase().includes(query) || query.includes(p.title.toLowerCase()));
    }

    if (matchedProducts.length === 0) {
        const queryWords = query.split(/\s+/).filter(w => w.length > 1);
        if (queryWords.length > 0) {
            matchedProducts = activeProducts.filter(p => {
                const titleLower = p.title.toLowerCase();
                return queryWords.every(word => titleLower.includes(word));
            });
        }
    }

    if (matchedProducts.length === 0) {
        console.error(`[createPaymentLinkTool] No matching product found for '${productName}'`);
        await escalateToHumanTool(workspaceId, contactPhone, `Payment requested for unknown product: '${productName}'`);
        return JSON.stringify({
            error: "PRODUCT_NOT_FOUND",
            message: "Payment system temporarily unavailable. Main team ko notify kar raha hoon."
        });
    }

    if (matchedProducts.length > 1) {
        console.warn(`[createPaymentLinkTool] Ambiguous product match for '${productName}':`, matchedProducts.map(p => p.title));
        return JSON.stringify({
            error: "AMBIGUOUS_PRODUCT",
            message: `Multiple products match '${productName}'. Ask the customer to confirm which product they want.`,
            options: matchedProducts.map(p => ({ productName: p.title, price: Number(p.price) }))
        });
    }

    const product = matchedProducts[0];
    secureAmount = Number(product.price);
    finalProductName = product.title;

    if (isNaN(secureAmount) || secureAmount <= 0) {
        console.error(`[createPaymentLinkTool] Invalid catalog price for '${finalProductName}': ${secureAmount}`);
        await escalateToHumanTool(workspaceId, contactPhone, `Catalog pricing error for product: ${finalProductName}`);
        return JSON.stringify({
            error: "INVALID_PRICE",
            message: "Payment system temporarily unavailable. Main team ko notify kar raha hoon."
        });
    }

    // 2. Duplicate prevention
    const activeSession = await CheckoutManager.getActiveSession(workspaceId, contactPhone);
    if (activeSession) {
        return JSON.stringify({
            success: true,
            message: `You already have an active payment link.`,
            paymentUrl: activeSession.url,
            amount: activeSession.amount
        });
    }

    // 3. Create checkout session in DB first
    const session = await CheckoutManager.createSession(workspaceId, contactPhone, secureAmount, [{ name: finalProductName, price: secureAmount }]);

    // 4. Route through GatewayRouter (multi-gateway with failover) and validate
    try {
        const contact = await prisma.contact.findFirst({ where: { userId: workspaceId, phone: contactPhone } });

        const link = await GatewayRouter.createPaymentLink(workspaceId, {
            amount: secureAmount,
            currency: "INR",
            referenceId: session.id,
            description: `Payment for ${finalProductName}`,
            customer: {
                name: contact?.name || "Customer",
                contact: contactPhone,
                email: contact?.email
            },
            notes: { workspaceId, contactPhone, productName: finalProductName }
        });

        if (!link || !link.url || !link.url.startsWith('http') || link.currency !== 'INR' || secureAmount <= 0) {
            throw new Error("Razorpay link validation failed: malformed link response or currency mismatch.");
        }

        // 5. Update session with gateway link details
        await CheckoutManager.attachRazorpayLink(session.id, link.id, link.url);

        return JSON.stringify({
            success: true,
            message: `✅ Payment link created via ${link.provider || 'payment gateway'}.`,
            paymentUrl: link.url,
            amount: secureAmount
        });
    } catch (error) {
        console.error("[createPaymentLinkTool] Gateway or validation error:", error.message);
        await prisma.checkoutSession.delete({ where: { id: session.id } }).catch(() => {});
        await escalateToHumanTool(workspaceId, contactPhone, `Failed to generate or validate payment link for ${finalProductName}. Error: ${error.message}`);
        return JSON.stringify({
            error: "PAYMENT_GENERATION_FAILED",
            message: "Payment system temporarily unavailable. Main team ko notify kar raha hoon."
        });
    }
}

async function escalateToHumanTool(workspaceId, contactPhone, reason) {
    const contact = await prisma.contact.findFirst({ where: { userId: workspaceId, phone: contactPhone }});
    if (contact) {
        await prisma.contact.update({
            where: { id: contact.id },
            data: { 
                status: 'PENDING',
                internalNotes: `[AI ESCALATED] Reason: ${reason}`
            }
        });
    }
    return JSON.stringify({
        success: true,
        message: "A human support agent has been notified and will assist you shortly."
    });
}

async function recommendProductsTool(workspaceId, currentProductName, strategy) {
    try {
        const baseProduct = await prisma.ecomProduct.findFirst({
            where: { userId: workspaceId, title: { contains: currentProductName, mode: 'insensitive' } }
        });

        if (!baseProduct) {
            return JSON.stringify({ error: "Product not found in catalog." });
        }

        let recommendations = [];

        if (strategy === 'upsell') {
            recommendations = await prisma.ecomProduct.findMany({
                where: {
                    userId: workspaceId,
                    storeId: baseProduct.storeId,
                    price: { gt: baseProduct.price },
                    stockStatus: 'active',
                    id: { not: baseProduct.id }
                },
                orderBy: { price: 'asc' },
                take: 3
            });
        } else if (strategy === 'cross_sell') {
            recommendations = await prisma.ecomProduct.findMany({
                where: {
                    userId: workspaceId,
                    storeId: baseProduct.storeId,
                    stockStatus: 'active',
                    id: { not: baseProduct.id }
                },
                take: 3
            });
        } else if (strategy === 'bundle') {
            recommendations = await prisma.ecomProduct.findMany({
                where: {
                    userId: workspaceId,
                    storeId: baseProduct.storeId,
                    price: { lte: Number(baseProduct.price) * 0.5 },
                    stockStatus: 'active',
                    id: { not: baseProduct.id }
                },
                take: 2
            });
        }

        if (!recommendations.length) {
            return JSON.stringify({ message: "No complementary products available right now." });
        }

        return JSON.stringify({
            strategy,
            basedOn: baseProduct.title,
            recommendations: recommendations.map(p => ({
                name: p.title,
                price: p.price,
                description: p.description?.substring(0, 80)
            }))
        });
    } catch (error) {
        console.error('[recommendProductsTool] Error:', error.message);
        return JSON.stringify({ error: "Could not load recommendations right now." });
    }
}

async function getCustomerIntelligenceTool(workspaceId, contactPhone, includeHistory = false) {
    try {
        const intel = await CustomerIntelligenceService.getOrCompute(workspaceId, contactPhone);
        
        const result = {
            segment: intel.segment,
            isVip: intel.isVip,
            churnRisk: intel.churnRisk,
            ltv: intel.ltv,
            orderCount: intel.orderCount,
            avgOrderValue: intel.avgOrderValue,
            aiScore: intel.aiScore,
            tags: intel.tags,
            preferredProducts: intel.preferredProducts
        };

        if (includeHistory) {
            const recentOrders = await prisma.ecomOrder.findMany({
                where: { userId: workspaceId, customerPhone: contactPhone },
                orderBy: { createdAt: 'desc' },
                take: 5,
                select: { externalOrderId: true, totalAmount: true, orderStatus: true, createdAt: true, lineItems: true }
            });
            result.recentOrders = recentOrders;
        }

        return JSON.stringify(result);
    } catch (error) {
        console.error('[getCustomerIntelligenceTool] Error:', error.message);
        return JSON.stringify({ segment: 'new', message: 'Customer data not available.' });
    }
}

async function initiateVoiceCallTool(workspaceId, contactPhone, contactId, chatSummary) {
    // Check if the workspace has any active toggled-on/configured voice provider in the database
    const activeVoiceProvider = prisma.userVoiceProvider ? await prisma.userVoiceProvider.findFirst({
        where: {
            userId: workspaceId,
            active: true,
            provider: { enabled: true }
        }
    }) : null;

    if (process.env.ENABLE_AI_VOICE_CALLING !== 'true' && !activeVoiceProvider) {
        return JSON.stringify({ error: "AI Voice Calling is not enabled or configured for this workspace." });
    }
    try {
        await CallEscalationService.triggerCallEscalation(workspaceId, contactPhone, contactId, chatSummary);
        return JSON.stringify({ success: true, message: "AI Voice Call has been initiated. The user will receive a call shortly." });
    } catch (e) {
        return JSON.stringify({ error: "Failed to initiate voice call: " + e.message });
    }
}

function parseDateTimeString(dateTimeStr, now = new Date()) {
    const cleanStr = dateTimeStr.toLowerCase().trim();

    // Normalize Hinglish and Hindi terms
    let normalized = cleanStr
        .replace(/\bkal\b/g, 'tomorrow')
        .replace(/\baaj\b/g, 'today')
        .replace(/\bbaje\b/g, "o'clock")
        .replace(/\bpar\b/g, '')
        .replace(/\b(bad|baad|baadh)\b/g, 'later')
        .replace(/\b(ghanta|ghante)\b/g, 'hours')
        .replace(/\b(minute|minutes|min|mins)\b/g, 'minutes')
        .replace(/\bsubah\b/g, 'am')
        .replace(/\b(shaam|sham|raat|dopahar)\b/g, 'pm')
        .trim();

    // 1. Check relative "in X minutes/hours" or "X minutes/hours later"
    const relativeMatch = normalized.match(/(?:in\s+)?(\d+)\s+(minutes?|mins?|hours?|hrs?|ghante?)\s*(?:later|bad)?/);
    if (relativeMatch) {
        const value = parseInt(relativeMatch[1], 10);
        const unit = relativeMatch[2];
        const targetDate = new Date(now.getTime());
        if (unit.startsWith('min')) {
            targetDate.setMinutes(targetDate.getMinutes() + value);
        } else {
            targetDate.setHours(targetDate.getHours() + value);
        }
        return targetDate;
    }

    // 2. Parse day info
    let dayOffset = 0;
    if (normalized.includes('tomorrow')) {
        dayOffset = 1;
    } else if (normalized.includes('today')) {
        dayOffset = 0;
    } else {
        // Check for days of the week (e.g. next monday)
        const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        for (let i = 0; i < daysOfWeek.length; i++) {
            if (normalized.includes(daysOfWeek[i])) {
                const currentDay = now.getDay();
                const targetDay = i;
                dayOffset = targetDay - currentDay;
                if (dayOffset <= 0) {
                    dayOffset += 7; // Next week's day
                }
                break;
            }
        }
    }

    // 3. Extract time components: HH:MM, HH.MM, HHMM, or H
    let hour = null;
    let minute = 0;
    let ampm = null;

    // Determine explicit am/pm
    if (normalized.includes('pm') || normalized.includes('evening') || normalized.includes('night') || normalized.includes('afternoon')) {
        ampm = 'pm';
    } else if (normalized.includes('am') || normalized.includes('morning')) {
        ampm = 'am';
    }

    // Match times:
    // a) HH:MM or HH.MM (e.g., 5:50, 17.50, 5.50)
    const timeMatch = normalized.match(/(?<!\d)(\d{1,2})[\.:](\d{1,2})(?!\d)/);
    // b) HHMM (e.g., 550, 1750) - Only match if it's 3 or 4 digits and looks like a time
    const hhmmMatch = normalized.match(/(?<!\d)(\d{1,2})(\d{2})(?!\d)/);
    // c) H o'clock or H baje or just H (e.g., 6 baje, 5 pm, at 6)
    const hourMatch = normalized.match(/(?<!\d)(\d{1,2})(?!\d)/);

    if (timeMatch) {
        hour = parseInt(timeMatch[1], 10);
        minute = parseInt(timeMatch[2], 10);
    } else if (hhmmMatch && normalized.match(/\b\d{3,4}\b/)) {
        hour = parseInt(hhmmMatch[1], 10);
        minute = parseInt(hhmmMatch[2], 10);
    } else if (hourMatch) {
        hour = parseInt(hourMatch[1], 10);
        minute = 0;
    }

    if (hour === null) {
        // Fallback: If no time found, default to 10 AM tomorrow or relative dayOffset
        const fallbackDate = new Date(now.getTime());
        fallbackDate.setDate(fallbackDate.getDate() + (dayOffset || 1));
        fallbackDate.setHours(10, 0, 0, 0);
        return fallbackDate;
    }

    // AM/PM resolution rules
    if (ampm === 'pm' && hour < 12) {
        hour += 12;
    } else if (ampm === 'am' && hour === 12) {
        hour = 0;
    } else if (!ampm) {
        if (hour < 12) {
            if (hour <= 8) {
                hour += 12;
            }
        }
    }

    const targetDate = new Date(now.getTime());
    targetDate.setDate(targetDate.getDate() + dayOffset);
    targetDate.setHours(hour, minute, 0, 0);

    // Past check: If scheduled time is in the past, shift it to tomorrow if it's absolute
    if (targetDate.getTime() <= now.getTime() && dayOffset === 0) {
        targetDate.setDate(targetDate.getDate() + 1);
    }

    return targetDate;
}

async function scheduleCallbackTool(workspaceId, contactPhone, dateTime, reason) {
    const contact = await prisma.contact.findFirst({ where: { userId: workspaceId, phone: contactPhone }});
    if (!contact) {
        return JSON.stringify({ error: "Contact not found." });
    }

    const updatedNotes = (contact.internalNotes || '') + `\n[Callback Scheduled]: At ${dateTime} - Reason: ${reason || 'Not specified'}`;
    
    let customFields = contact.customFields || {};
    if (typeof customFields === 'string') {
        try {
            customFields = JSON.parse(customFields);
        } catch (e) {
            customFields = {};
        }
    }
    
    customFields.callbackScheduled = dateTime;
    customFields.callbackReason = reason || 'Not specified';
    customFields.callbackUpdatedAt = new Date().toISOString();

    await prisma.contact.update({
        where: { id: contact.id },
        data: {
            internalNotes: updatedNotes,
            customFields: customFields
        }
    });

    let extraMessage = "";
    const activeVoiceProvider = prisma.userVoiceProvider ? await prisma.userVoiceProvider.findFirst({
        where: {
            userId: workspaceId,
            active: true,
            provider: { enabled: true }
        }
    }) : null;

    if (process.env.ENABLE_AI_VOICE_CALLING === 'true' || activeVoiceProvider) {
        try {
            const targetDate = parseDateTimeString(dateTime);
            const delayMs = targetDate.getTime() - Date.now();

            if (delayMs > 0) {
                const context = {
                    phone: contactPhone,
                    summary: `Scheduled callback follow up. Reason: ${reason || 'Not specified'}. Original schedule input: ${dateTime}`,
                    intent: "Scheduled Callback follow up",
                    escalated_at: new Date().toISOString(),
                    scheduled_time: targetDate.toISOString()
                };

                const job = await VoiceQueueManager.enqueueCall(workspaceId, contact.id, contactPhone, context, delayMs);
                extraMessage = ` Outbound AI Call has been scheduled for ${targetDate.toString()} (Job ID: ${job.id}).`;
            } else {
                extraMessage = " Note: Scheduled time is in the past, so no automated voice call was queued.";
            }
        } catch (err) {
            console.error("[scheduleCallbackTool] Failed to schedule voice call queue:", err.message);
            extraMessage = ` (Warning: Could not schedule automated AI Call queue: ${err.message})`;
        }
    }

    return JSON.stringify({
        success: true,
        message: `Callback scheduled successfully at ${dateTime}.${extraMessage}`
    });
}

async function sendWhatsappMessageTool(workspaceId, contactPhone, message) {
    const user = prisma.user ? await prisma.user.findUnique({
        where: { id: workspaceId }
    }) : null;

    if (!user || !user.metaToken || !user.phoneNumberId) {
        return JSON.stringify({ error: "WhatsApp credentials not configured for this workspace." });
    }

    try {
        await MetaApiService.sendText({
            phoneNumberId: user.phoneNumberId,
            token: user.metaToken,
            to: contactPhone.replace(/[^0-9]/g, ''),
            text: message,
            context: { userId: workspaceId }
        });
        return JSON.stringify({
            success: true,
            message: "WhatsApp message sent successfully."
        });
    } catch (err) {
        return JSON.stringify({ error: `Failed to send WhatsApp message: ${err.message}` });
    }
}

async function logAction(workspaceId, contactId, toolName, input, output, status, executionTimeMs, isSandbox) {
    try {
        if (contactId === "UNKNOWN" || !prisma.aiActionLog) return;
        
        await prisma.aiActionLog.create({
            data: {
                userId: workspaceId,
                contactId: contactId,
                toolName,
                input: input || {},
                output: output || {},
                status,
                executionTimeMs,
                isSandbox
            }
        });
    } catch (e) {
        console.error("Failed to log AI action:", e);
    }
}

module.exports = {
    toolsDefinitions,
    executeTool
};
