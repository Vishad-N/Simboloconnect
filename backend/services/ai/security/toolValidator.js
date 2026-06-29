const prisma = require('../../../prismaClient');

/**
 * Validates tool execution against strict workspace security boundaries.
 * Enforces ownership of contacts, products, and tool permissions.
 */
async function validateToolExecution(workspaceId, contactPhone, toolName, args) {
    // 1. Validate Phone Number Format
    const cleanPhone = (contactPhone || '').replace(/[^0-9]/g, '');
    const phoneRegex = /^\+?[0-9]{10,15}$/;
    if (!phoneRegex.test(cleanPhone)) {
        throw new Error(`[Security Validation] Invalid customer phone number format: '${contactPhone}'. Phone number must have 10-15 digits.`);
    }

    // 2. Validate Tool Permissions
    const agent = await prisma.aiAgent.findUnique({
        where: { userId: workspaceId }
    });

    if (!agent) {
        throw new Error("[Security Validation] AI Agent configuration not found for workspace.");
    }

    let enabledTools = typeof agent.toolsEnabled === 'string' 
        ? JSON.parse(agent.toolsEnabled) 
        : (agent.toolsEnabled || []);

    // Fallback to enabling all default tools for new/demo workspaces if none are configured
    if (!Array.isArray(enabledTools) || enabledTools.length === 0) {
        enabledTools = [
            'search_products', 
            'create_payment_link', 
            'escalate_to_human', 
            'recommend_products', 
            'get_customer_intelligence', 
            'initiate_voice_call',
            'schedule_callback',
            'send_whatsapp_message'
        ];
    }

    // Check if the workspace has any active toggled-on/configured voice provider in the database
    const activeVoiceProvider = prisma.userVoiceProvider ? await prisma.userVoiceProvider.findFirst({
        where: {
            userId: workspaceId,
            active: true,
            provider: { enabled: true }
        }
    }) : null;

    if (process.env.ENABLE_AI_VOICE_CALLING === 'true' || activeVoiceProvider) {
        if (!enabledTools.includes('initiate_voice_call')) {
            enabledTools.push('initiate_voice_call');
        }
        if (!enabledTools.includes('schedule_callback')) {
            enabledTools.push('schedule_callback');
        }
    }

    // Ensure our whitelisted tools are allowed if called
    if (!enabledTools.includes(toolName)) {
        throw new Error(`[Security Validation] Tool '${toolName}' is disabled or not permitted for this workspace.`);
    }

    // 3. Validate Customer Ownership
    const contact = await prisma.contact.findFirst({
        where: { userId: workspaceId, phone: contactPhone }
    });

    if (!contact) {
        throw new Error("[Security Validation] Unauthorized access attempt to a non-workspace contact.");
    }

    // 4. Domain Specific Parameter & Schema Validation
    // Strictly reject empty, null, or undefined required parameters
    switch (toolName) {
        case 'create_payment_link': {
            const { productName } = args;
            if (!productName || typeof productName !== 'string' || productName.trim().length === 0) {
                throw new Error("[Security Validation] Invalid parameter: 'productName' is required and must be a non-empty string.");
            }
            break;
        }
        case 'search_products': {
            if (!args.query || typeof args.query !== 'string' || args.query.trim().length === 0) {
                throw new Error("[Security Validation] Invalid parameter: 'query' cannot be empty.");
            }
            break;
        }
        case 'escalate_to_human': {
            if (!args.reason || typeof args.reason !== 'string' || args.reason.trim().length === 0) {
                throw new Error("[Security Validation] Invalid parameter: 'reason' is required for human escalation.");
            }
            break;
        }
        case 'recommend_products': {
            const { currentProductName, strategy } = args;
            if (!currentProductName || typeof currentProductName !== 'string' || currentProductName.trim().length === 0) {
                throw new Error("[Security Validation] Invalid parameter: 'currentProductName' is required and must be a non-empty string.");
            }
            if (!strategy || !['upsell', 'cross_sell', 'bundle'].includes(strategy)) {
                throw new Error("[Security Validation] Invalid parameter: 'strategy' must be 'upsell', 'cross_sell', or 'bundle'.");
            }
            break;
        }
        case 'initiate_voice_call': {
            // chatSummary is optional — many LLMs omit it; we fill a safe default
            // reason is also optional with fallback to avoid breaking tool invocations
            break;
        }
        case 'schedule_callback': {
            const { dateTime } = args;
            if (!dateTime || typeof dateTime !== 'string' || dateTime.trim().length === 0) {
                throw new Error("[Security Validation] Invalid parameter: 'dateTime' is required to schedule callback.");
            }
            break;
        }
        case 'send_whatsapp_message': {
            const { message } = args;
            if (!message || typeof message !== 'string' || message.trim().length === 0) {
                throw new Error("[Security Validation] Invalid parameter: 'message' is required to send WhatsApp message.");
            }
            break;
        }
    }

    return {
        contactId: contact.id,
        isSandbox: agent.sandboxMode
    };
}

module.exports = { validateToolExecution };
