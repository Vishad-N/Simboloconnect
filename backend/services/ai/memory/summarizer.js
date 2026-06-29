const { Worker } = require('bullmq');
const axios = require('axios');
const prisma = require('../../../prismaClient');
const redis = require('../../../redisConnection');
const { callDynamicAi } = require('../utils/dynamicAi');

/**
 * PHASE 1.5: Background Memory Summarization
 * Prevents the Redis sliding window from exceeding max tokens.
 * Compress older context and stores it in AiConversation.
 */
function startMemorySummarizer() {
    const worker = new Worker('ai.memory.summarize', async (job) => {
        const { workspaceId, contactPhone, memoryKey } = job.data;
        
        console.log(`[Memory Summarizer] Compressing memory for ${contactPhone} in workspace ${workspaceId}`);
        
        const chatHistoryStr = await redis.get(memoryKey);
        if (!chatHistoryStr) return;

        const messages = JSON.parse(chatHistoryStr);
        if (messages.length < 15) return; // Only summarize if it's getting too long
        
        // 1. Fetch AI Config
        const agentConfig = await prisma.aiAgent.findUnique({ where: { userId: workspaceId } });
        const user = await prisma.user.findUnique({ where: { id: workspaceId } });
        
        let apiKey = null;
        let provider = 'openai';

        if (agentConfig?.useOwnAi) {
            apiKey = user?.aiApiKey;
            provider = user?.aiProvider || 'openai';
        } else {
            const admin = await prisma.user.findFirst({ where: { role: 'SUPERADMIN' } });
            apiKey = admin?.aiApiKey;
            provider = admin?.aiProvider || 'openai';
        }

        if (!apiKey) return;

        // 2. Instruct LLM to Summarize
        const summarizePrompt = `Please summarize the following conversation succinctly. Focus on the user's intent, specific products mentioned, and any decisions made. Do not include greetings.`;
        
        const payload = {
            model: provider === 'groq' ? "llama-3.1-8b-instant" : (provider === 'openrouter' ? "openrouter/auto" : "gpt-4o-mini"),
            messages: [
                { role: "system", content: summarizePrompt },
                { role: "user", content: JSON.stringify(messages.slice(1)) } // exclude original system prompt
            ],
            temperature: 0.3
        };

        const aiRes = await callDynamicAi(provider, apiKey, payload);
        const summary = aiRes.data.choices[0].message.content;

        // 3. Save Summary to Database (Long-term memory)
        const contact = await prisma.contact.findFirst({ where: { userId: workspaceId, phone: contactPhone }});
        if (contact) {
            await prisma.aiConversation.create({
                data: {
                    workspaceId,
                    contactId: contact.id,
                    summary,
                    redisSessionKey: memoryKey
                }
            });
        }

        // 4. Reset Redis Memory (Keep system prompt + summary + last 2 messages)
        const newMemory = [
            messages[0], // System Prompt
            { role: "assistant", content: `[Previous Context]: ${summary}` },
            messages[messages.length - 2],
            messages[messages.length - 1]
        ];

        await redis.set(memoryKey, JSON.stringify(newMemory), 'EX', 86400);
        console.log(`[Memory Summarizer] Successfully compressed memory for ${contactPhone}`);

    }, {
        connection: redis,
        concurrency: 2,
    });

    worker.on('failed', (job, err) => console.error(`[Memory Summarizer] Failed:`, err.message));
    return worker;
}

module.exports = { startMemorySummarizer };
