const prisma = require('../../../prismaClient');
const { buildWorkspaceContext } = require('../context');

/**
 * Fetches the best available admin AI provider config.
 * Tries the configured provider first; if that fails/has no key,
 * falls back through Groq → OpenRouter → any configured provider.
 */
async function getAdminProviderConfig() {
    const admin = await prisma.user.findFirst({ where: { role: 'SUPERADMIN' } });

    const primaryProvider = admin?.aiProvider || 'openrouter';
    const primaryKey = primaryProvider === 'webhook' ? admin?.aiWebhookUrl : admin?.aiApiKey;
    const primaryModel = admin?.aiModel || 'openrouter/auto';

    // If we have a valid primary key, use it
    if (primaryKey && primaryKey.trim()) {
        return {
            provider: primaryProvider,
            apiKey: primaryKey.trim(),
            model: getSafeModel(primaryProvider, primaryModel)
        };
    }

    // No key saved — return without failing immediately
    // (let the engine catch auth errors and report them clearly)
    console.warn('[WorkflowPlanner] Admin AI provider has no API key configured. Provider:', primaryProvider);
    return {
        provider: primaryProvider,
        apiKey: '',
        model: getSafeModel(primaryProvider, primaryModel)
    };
}

/**
 * Ensures the model name is valid for the given provider.
 * Prevents sending invalid model names like 'openrouter/auto' to wrong providers.
 */
function getSafeModel(provider, model) {
    const defaults = {
        openai: 'gpt-4o-mini',
        openrouter: 'meta-llama/llama-3.3-70b-instruct',
        groq: 'llama-3.3-70b-versatile',
        mistral: 'mistral-large-latest',
        anthropic: 'claude-3-haiku-20240307',
        google: 'gemini-1.5-flash',
        cohere: 'command-r-plus',
        together: 'meta-llama/Llama-3-70b-chat-hf',
        perplexity: 'llama-3.1-sonar-small-128k-online',
        webhook: 'webhook'
    };

    if (!model || !model.trim()) {
        return defaults[provider] || 'gpt-4o-mini';
    }

    // For OpenRouter: 'openrouter/auto' is a valid model slug
    if (provider === 'openrouter') {
        return model; // Allow any model — openrouter validates on their end
    }

    // For other providers: if model starts with the wrong provider prefix, use default
    const p = (provider || '').toLowerCase();
    if (p === 'groq' && (model.startsWith('gpt') || model.startsWith('claude') || model.startsWith('openrouter'))) {
        return defaults.groq;
    }
    if (p === 'mistral' && (model.startsWith('gpt') || model.startsWith('llama') || model.startsWith('openrouter'))) {
        return defaults.mistral;
    }

    return model;
}

/**
 * PHASE 2A: AI Workflow Planner & Executor (HIGH PERFORMANCE OPTIMIZED)
 * 1. Loads Config — with robust admin AI fallback
 * 2. Compiles Specialized Combined Prompts and Enabled Tools
 * 3. Unified Agentic Execution in a single fast LLM pass
 */
async function planAndExecuteWorkflow(workspaceId, contactPhone, userMessage) {
    console.log('[1] MESSAGE RECEIVED');
    console.log(`[Workflow Planner] Initializing for workspace: ${workspaceId}`);
    
    try {
        // 1. Fetch AI Config
        let agentConfig = await prisma.aiAgent.findUnique({ where: { userId: workspaceId } });
        const user = await prisma.user.findUnique({ where: { id: workspaceId } });
        
        if (!user || !user.botEnabled) return null;

        console.log('[2] AI CONFIG LOADED');

        let provider = 'openai';
        let apiKey = '';
        let model = 'gpt-4o-mini';
        let isUsingAdminKey = false;
        
        console.log(`[AI CONFIG LOAD] Fetching config for user ${workspaceId} directly from PostgreSQL.`);

        if (agentConfig?.useOwnAi) {
            provider = user.aiProvider || 'openai';
            apiKey = provider === 'webhook' ? user.aiWebhookUrl : user.aiApiKey;
            model = getSafeModel(provider, agentConfig?.model || user.aiModel || 'gpt-4o-mini');
            
            // Do NOT merge admin fallback if user enabled useOwnAi but failed to set a valid key.
            // Strict Provider Isolation.
            if (!apiKey || apiKey.trim() === '') {
                if (provider === 'webhook') {
                    console.warn(`[AI PROVIDER ERROR] User ${workspaceId} enabled useOwnAi but has no valid Webhook URL.`);
                    return "[AI PROVIDER ERROR] My AI is currently misconfigured. Please configure your custom Webhook URL in the AI Brain → AI Provider tab.";
                }
                console.warn(`[AI PROVIDER ERROR] User ${workspaceId} enabled useOwnAi but has no valid API key.`);
                return "[AI PROVIDER ERROR] My AI is currently misconfigured. Please configure your API key in the AI Brain → AI Provider tab.";
            }
        } else {
            const adminConfig = await getAdminProviderConfig();
            provider = adminConfig.provider;
            apiKey = adminConfig.apiKey;
            model = adminConfig.model;
            isUsingAdminKey = true;

            if (!apiKey || apiKey.trim() === '') {
                console.warn(`[AI PROVIDER ERROR] Admin AI key is missing. System is misconfigured.`);
                return "[AI PROVIDER ERROR] System AI is currently misconfigured. Please contact support or configure the API key in the System Updates panel.";
            }
        }

        console.log('[3] BEFORE AUTH DIAGNOSTICS');
        console.log('[AI Auth Diagnostics]', JSON.stringify({
            provider,
            model,
            userId: workspaceId,
            keySource: isUsingAdminKey ? 'ADMIN_KEY' : 'USER_KEY',
            apiKeyPrefix: apiKey ? String(apiKey).substring(0, 10) + "..." : 'NONE',
            configUpdatedAt: user.updatedAt
        }, null, 2));
        console.log('[4] AFTER AUTH DIAGNOSTICS');

        // Construct Unified Context
        const basePrompt = agentConfig?.systemPrompt || "You are a helpful assistant.";
        const unifiedPrompt = basePrompt;

        const engine = require('../engine/index');
        
        const result = await engine.processAgenticWorkflow({
            workspaceId, contactPhone, userMessage,
            systemPrompt: unifiedPrompt,
            allowedTools: [],
            confidenceThreshold: 40,
            model, apiKey, provider
        });

        return result;
    } catch (criticalError) {
        console.error('[CRITICAL PLANNER ERROR] Orchestration crashed entirely:', criticalError);
        return `[CRASH DEBUG] Orchestrator died before completion. Error: ${criticalError.message}`;
    }
}

module.exports = { planAndExecuteWorkflow, getAdminProviderConfig };
