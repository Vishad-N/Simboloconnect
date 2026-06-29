const axios = require('axios');

function sanitizeProviderPayload(payload, provider) {
    const selectedProvider = provider ? provider.toLowerCase() : 'openai';
    if (!payload) return {};

    // 1. Deep clone the payload to avoid side-effects
    const sanitized = JSON.parse(JSON.stringify(payload));

    const fieldsToInject = ['contactPhone', 'contactName', 'customerPhone', 'leadData', 'crmData', 'workspaceData', 'metadata'];
    const customFields = {};
    
    fieldsToInject.forEach(field => {
        if (payload[field] !== undefined && payload[field] !== null) {
            customFields[field] = payload[field];
        }
    });

    // 2. If we have custom fields, inject them into the system prompt message
    if (Object.keys(customFields).length > 0 && sanitized.messages && Array.isArray(sanitized.messages)) {
        let systemMessage = sanitized.messages.find(m => m.role === 'system');
        
        let injectionStr = "\n\n[System Inject - Customer Info]:";
        if (customFields.contactPhone) injectionStr += `\nCustomer Phone: ${customFields.contactPhone}`;
        if (customFields.contactName) injectionStr += `\nCustomer Name: ${customFields.contactName}`;
        if (customFields.customerPhone) injectionStr += `\nCustomer Phone: ${customFields.customerPhone}`;
        if (customFields.leadData) injectionStr += `\nLead Data: ${typeof customFields.leadData === 'object' ? JSON.stringify(customFields.leadData) : customFields.leadData}`;
        if (customFields.crmData) injectionStr += `\nCRM Data: ${typeof customFields.crmData === 'object' ? JSON.stringify(customFields.crmData) : customFields.crmData}`;
        if (customFields.workspaceData) injectionStr += `\nWorkspace Data: ${typeof customFields.workspaceData === 'object' ? JSON.stringify(customFields.workspaceData) : customFields.workspaceData}`;
        if (customFields.metadata) injectionStr += `\nMetadata: ${typeof customFields.metadata === 'object' ? JSON.stringify(customFields.metadata) : customFields.metadata}`;
        
        if (systemMessage) {
            if (!systemMessage.content.includes('[System Inject - Customer Info]')) {
                systemMessage.content += injectionStr;
            }
        } else {
            sanitized.messages.unshift({
                role: 'system',
                content: `You are a helpful AI assistant.${injectionStr}`
            });
        }
    }

    // 3. For all providers except 'webhook', strip all keys NOT in the allowed list
    if (selectedProvider !== 'webhook') {
        const allowedKeys = [
            'model',
            'messages',
            'temperature',
            'max_tokens',
            'top_p',
            'tools',
            'tool_choice',
            'stream',
            'response_format'
        ];
        
        Object.keys(sanitized).forEach(key => {
            if (!allowedKeys.includes(key)) {
                delete sanitized[key];
            }
        });
    }

    return sanitized;
}

async function callDynamicAi(provider, apiKey, openaiPayload) {
    const selectedProvider = provider ? provider.toLowerCase() : 'openai';
    const sanitizedPayload = sanitizeProviderPayload(openaiPayload, selectedProvider);

    let endpoint = 'https://api.openai.com/v1/chat/completions';
    let headers = { 
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
    };
    let finalPayload = { ...sanitizedPayload };

    // Set a reasonable max_tokens limit if not already specified to prevent 
    // OpenRouter/other APIs from reserving full context windows (e.g., 65536 tokens) 
    // and causing 402 payment/credit exhaustion errors.
    if (!finalPayload.max_tokens) {
        finalPayload.max_tokens = 120;
    }

    // Clean messages payload to prevent strict OpenAi-compatible engines (like Groq) 
    // from throwing 400 errors due to the unsupported 'refusal' property.
    if (finalPayload.messages && Array.isArray(finalPayload.messages)) {
        finalPayload.messages = finalPayload.messages.map(m => {
            const cleanMsg = { ...m };
            if ('refusal' in cleanMsg) {
                delete cleanMsg.refusal;
            }
            return cleanMsg;
        });
    }

    // Auto-map model configurations for Groq to prevent invalid model errors
    if (selectedProvider === 'groq') {
        const isInvalidForGroq = !finalPayload.model 
            || finalPayload.model.startsWith('gpt')
            || finalPayload.model.startsWith('claude')
            || finalPayload.model.startsWith('gemini')
            || finalPayload.model.startsWith('openrouter')
            || finalPayload.model.startsWith('mistral')
            || finalPayload.model.startsWith('command')
            || finalPayload.model.includes('/');  // Most cross-provider model paths have /
        if (isInvalidForGroq) {
            finalPayload.model = 'llama-3.3-70b-versatile';
        }
    }

    // Strip response_format for non-OpenAI endpoints ONLY when tools are defined to avoid 400 Bad Request errors.
    // Groq and other providers do not allow combining json_mode and tool calling in the same request,
    // but they DO support json_mode if tools are not provided.
    if (selectedProvider !== 'openai' && finalPayload.tools) {
        if (finalPayload.response_format) {
            delete finalPayload.response_format;
        }
    }

    if (selectedProvider === 'openai') {
        endpoint = 'https://api.openai.com/v1/chat/completions';
    } else if (selectedProvider === 'openrouter') {
        endpoint = 'https://openrouter.ai/api/v1/chat/completions';
        // OpenRouter recommends these headers for proper routing and rate limiting
        headers['HTTP-Referer'] = process.env.BACKEND_URL || process.env.PUBLIC_URL || process.env.OPENROUTER_REFERRER || 'http://localhost:5005';
        headers['X-Title'] = process.env.PLATFORM_NAME || 'WhatsApp AI Panel';
        // If model is not set or is invalid, use a reliable free model
        if (!finalPayload.model || finalPayload.model === 'openrouter/auto') {
            finalPayload.model = 'meta-llama/llama-3.3-70b-instruct:free';
        }
    } else if (selectedProvider === 'groq') {
        endpoint = 'https://api.groq.com/openai/v1/chat/completions';
    } else if (selectedProvider === 'mistral') {
        endpoint = 'https://api.mistral.ai/v1/chat/completions';
    } else if (selectedProvider === 'together') {
        endpoint = 'https://api.together.xyz/v1/chat/completions';
    } else if (selectedProvider === 'perplexity') {
        endpoint = 'https://api.perplexity.ai/chat/completions';
    } else if (selectedProvider === 'google') {
        endpoint = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
    } else if (selectedProvider === 'anthropic') {
        endpoint = 'https://api.anthropic.com/v1/messages';
        headers = {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'Content-Type': 'application/json'
        };

        let systemPrompt = '';
        const anthropicMessages = sanitizedPayload.messages.filter(m => {
            if (m.role === 'system') {
                systemPrompt = m.content;
                return false;
            }
            return true;
        }).map(m => {
            let content = m.content;
            let role = m.role;

            if (role === 'tool') {
                role = 'user';
                content = [
                    {
                        type: 'tool_result',
                        tool_use_id: m.tool_call_id,
                        content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content)
                    }
                ];
            } else if (role === 'assistant' && m.tool_calls) {
                content = [];
                if (m.content) content.push({ type: 'text', text: m.content });
                for (const tc of m.tool_calls) {
                    content.push({
                        type: 'tool_use',
                        id: tc.id,
                        name: tc.function.name,
                        input: typeof tc.function.arguments === 'string' ? JSON.parse(tc.function.arguments) : tc.function.arguments
                    });
                }
            }

            return { role, content };
        });

        const anthropicTools = sanitizedPayload.tools ? sanitizedPayload.tools.map(t => ({
            name: t.function.name,
            description: t.function.description,
            input_schema: t.function.parameters
        })) : undefined;

        finalPayload = {
            model: sanitizedPayload.model || "claude-3-5-sonnet-20241022",
            max_tokens: 1024,
            system: systemPrompt,
            messages: anthropicMessages,
            tools: anthropicTools
        };
    } else if (selectedProvider === 'cohere') {
        endpoint = 'https://api.cohere.com/v1/chat';
        headers = {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        };

        const systemMsg = sanitizedPayload.messages.find(m => m.role === 'system')?.content || '';
        const userMsgs = sanitizedPayload.messages.filter(m => m.role === 'user');
        const lastUserMessage = userMsgs[userMsgs.length - 1]?.content || 'Ping';

        const chatHistory = sanitizedPayload.messages
            .filter(m => m.role !== 'system' && m !== userMsgs[userMsgs.length - 1])
            .map(m => ({
                role: m.role === 'user' ? 'USER' : 'CHATBOT',
                message: typeof m.content === 'string' ? m.content : JSON.stringify(m.content)
            }));

        const cohereTools = sanitizedPayload.tools ? sanitizedPayload.tools.map(t => ({
            name: t.function.name,
            description: t.function.description,
            parameter_definitions: Object.keys(t.function.parameters.properties).reduce((acc, key) => {
                acc[key] = {
                    description: t.function.parameters.properties[key].description || '',
                    type: t.function.parameters.properties[key].type || 'string',
                    required: t.function.parameters.required?.includes(key) || false
                };
                return acc;
            }, {})
        })) : undefined;

        finalPayload = {
            model: sanitizedPayload.model || "command-r-plus",
            message: lastUserMessage,
            chat_history: chatHistory,
            preamble: systemMsg,
            tools: cohereTools
        };
    }

    if (selectedProvider === 'webhook') {
        if (!apiKey || !apiKey.trim()) {
            throw new Error('[Webhook AI Provider] No webhook URL configured.');
        }
        const systemMsg = sanitizedPayload.messages.find(m => m.role === 'system')?.content || '';
        const userMsgs = sanitizedPayload.messages.filter(m => m.role === 'user');
        const lastUserMessage = userMsgs[userMsgs.length - 1]?.content || '';
        const history = sanitizedPayload.messages
            .filter(m => m.role !== 'system' && m !== userMsgs[userMsgs.length - 1])
            .map(m => ({ role: m.role, content: m.content }));
        
        const response = await axios.post(apiKey, {
            contact: sanitizedPayload.contactPhone || '',
            message: lastUserMessage,
            systemPrompt: systemMsg,
            history: history
        }, { timeout: 25000 });
        
        const d = response.data;
        let parsedText = '';
        if (typeof d === 'string') {
            parsedText = d;
        } else if (d && typeof d === 'object') {
            parsedText = d.reply || d.response || d.text || d.output || d.message || '';
            if (!parsedText && Array.isArray(d) && d.length > 0) {
                parsedText = d[0].reply || d[0].response || d[0].text || d[0].output || d[0].message || '';
            }
            if (!parsedText) parsedText = d.content || JSON.stringify(d);
        }
        return {
            data: {
                choices: [{ message: { role: 'assistant', content: parsedText || '' } }],
                usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
            }
        };
    }

    const response = await axios.post(endpoint, finalPayload, { headers, timeout: 25000 });

    if (selectedProvider === 'anthropic') {
        const textBlock = response.data.content.find(c => c.type === 'text');
        const toolUseBlocks = response.data.content.filter(c => c.type === 'tool_use');

        const toolCalls = toolUseBlocks.length > 0 ? toolUseBlocks.map(tb => ({
            id: tb.id,
            type: 'function',
            function: {
                name: tb.name,
                arguments: JSON.stringify(tb.input)
            }
        })) : undefined;

        return {
            data: {
                choices: [{
                    message: {
                        role: 'assistant',
                        content: textBlock?.text || '',
                        tool_calls: toolCalls
                    }
                }],
                usage: {
                    prompt_tokens: response.data.usage?.input_tokens || 0,
                    completion_tokens: response.data.usage?.output_tokens || 0,
                    total_tokens: (response.data.usage?.input_tokens || 0) + (response.data.usage?.output_tokens || 0)
                }
            }
        };
    } else if (selectedProvider === 'cohere') {
        const toolCalls = response.data.tool_calls ? response.data.tool_calls.map((tc, idx) => ({
            id: `call_${idx}_${Date.now()}`,
            type: 'function',
            function: {
                name: tc.name,
                arguments: JSON.stringify(tc.parameters)
            }
        })) : undefined;

        return {
            data: {
                choices: [{
                    message: {
                        role: 'assistant',
                        content: response.data.text || '',
                        tool_calls: toolCalls
                    }
                }],
                usage: {
                    prompt_tokens: response.data.meta?.tokens?.input_tokens || 0,
                    completion_tokens: response.data.meta?.tokens?.output_tokens || 0,
                    total_tokens: (response.data.meta?.tokens?.input_tokens || 0) + (response.data.meta?.tokens?.output_tokens || 0)
                }
            }
        };
    }

    return response;
}

module.exports = { callDynamicAi };
