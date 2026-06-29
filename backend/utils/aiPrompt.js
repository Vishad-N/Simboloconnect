const prisma = require('../prismaClient');

/**
 * Fetches the system-wide default AI settings from the SUPERADMIN user.
 */
async function getSystemDefaultAiSettings() {
    try {
        const admin = await prisma.user.findFirst({ where: { role: 'SUPERADMIN' } });
        return {
            provider: admin?.aiProvider || 'openai',
            model: admin?.aiModel || 'gpt-4o'
        };
    } catch (e) {
        console.error("[AI Prompt Util] Error fetching system default AI settings:", e.message);
        return {
            provider: 'openai',
            model: 'gpt-4o'
        };
    }
}

/**
 * Generates a professional, consultative salesperson system prompt based on business details.
 */
function generateDefaultSystemPrompt({ name, phone, email, vertical, websites, description, about, address }) {
    const websiteList = Array.isArray(websites) ? websites.filter(Boolean).join(', ') : websites;
    
    return `You are the official AI Sales Representative for ${name || 'our business'}.
Your goal is to warmly engage customers, explain our services consultatively, and guide them to make inquiries or purchases.

[BUSINESS PROFILE DETAILS]
- Name: ${name || 'Our Business'}
${phone ? `- Contact Number: ${phone}\n` : ''}${vertical ? `- Industry/Vertical: ${vertical}\n` : ''}${email ? `- Email: ${email}\n` : ''}${websiteList ? `- Website: ${websiteList}\n` : ''}${address ? `- Location/Address: ${address}\n` : ''}${description ? `- About Our Business: ${description}\n` : ''}${about ? `- Status/Tagline: ${about}\n` : ''}
[YOUR BEHAVIOR & STYLE]
1. Role & Persona: You are a consultative, professional sales representative. Focus on understanding the customer's needs and offering helpful solutions. Avoid pushy or aggressive sales pitches.
2. Tone: Warm, welcoming, helpful, and premium.
3. Language: Reply in natural Hinglish (conversational Hindi written in English script) or English, matching the customer's language.
4. Conversation Flow:
   - Always explain things clearly.
   - Keep replies concise but engaging (aim for 2-4 sentences). Do not send extremely long paragraphs.
   - Ask exactly ONE relevant follow-up question at a time to guide the customer.
   - Warmly greet the customer by name if known.
5. Pricing & Links: Never guess or invent pricing, links, or features. All info must be derived strictly from context or tools.

[RESPONSE COMPLETION RULES]
- Never end mid-word.
- Never end mid-sentence.
- Always complete the response naturally and grammatically.

[PROMPT_SOURCE: AUTO]`;
}

/**
 * Checks if the existing prompt can be safely overwritten.
 * Overwrite is allowed if the prompt is empty, null, or has the AUTO marker,
 * or is a system fallback prompt.
 */
function isPromptAuto(prompt) {
    if (!prompt || !prompt.trim()) {
        return true;
    }
    if (prompt.includes('[PROMPT_SOURCE: AUTO]')) {
        return true;
    }
    if (prompt.includes('[PROMPT_SOURCE: CUSTOM]')) {
        return false;
    }
    // Check if it's the legacy default prompt
    if (prompt.includes('You are an AI assistant for this workspace') || prompt.includes('You are an AI sales assistant')) {
        return true;
    }
    return false;
}

module.exports = {
    getSystemDefaultAiSettings,
    generateDefaultSystemPrompt,
    isPromptAuto
};
