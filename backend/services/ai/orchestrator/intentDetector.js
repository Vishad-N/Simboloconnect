const { callDynamicAi } = require('../utils/dynamicAi');

/**
 * PHASE 2A: Intent Detection Engine
 * Uses a lightweight, fast model to classify the user's intent.
 * This determines which specialized AI Agent should handle the request.
 */
async function detectIntent(userMessage, apiKey, provider = 'openai') {
    const prompt = `
You are an intent classification engine.
Analyze the user's message and classify it into EXACTLY ONE of the following intents:
- 'sales': The user wants to buy something, asks for pricing, or is browsing products.
- 'support': The user needs help, has a technical issue, or wants to check an order status.
- 'billing': The user wants to make a payment, asks for an invoice, or asks for a refund.
- 'escalation': The user is extremely angry, wants a human, or threatens legal action.
- 'general': General chat, greetings, or unclear intent.

Return ONLY a JSON object: { "intent": "string", "confidence": number }
`;

    try {
        const payload = {
            model: provider === 'groq' ? "llama-3.1-8b-instant" : (provider === 'openrouter' ? "openrouter/auto" : "gpt-4o-mini"),
            messages: [
                { role: "system", content: prompt },
                { role: "user", content: userMessage }
            ],
            temperature: 0.1,
            response_format: { type: "json_object" }
        };

        const res = await callDynamicAi(provider, apiKey, payload);

        const raw = res.data.choices[0].message.content;
        const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
        const result = JSON.parse(cleaned);
        return result.intent || 'general';

    } catch (e) {
        console.error("[Intent Detector] Failed, defaulting to 'general'", e.message);
        return 'general';
    }
}

module.exports = { detectIntent };
