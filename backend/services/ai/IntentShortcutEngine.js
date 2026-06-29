/**
 * IntentShortcutEngine — Ultra-fast pre-LLM intent detection
 * 
 * Runs BEFORE the full LLM pass for every incoming WhatsApp message.
 * Pure JS keyword matching — <1ms latency, zero external API calls.
 * 
 * Enables:
 *  - Instant "Sure! Initiating your call now." reply for call intents
 *  - Bypassing slow LLM roundtrip for recognized simple intents
 *  - Capability-aware responses (no false call promises)
 */

const CALL_INTENT_KEYWORDS = [
    // English
    'call me', 'call now', 'please call', 'please phone',
    'can you call', 'can u call', 'give me a call', 'need a call',
    'want a call', 'ring me', 'dial me',
    // Hinglish
    'call karo', 'call kijiye', 'call karna', 'call kare', 'call karein',
    'call karlo', 'call lagao', 'call connect', 'call chahiye', 'call karwa',
    'phone karo', 'phone kijiye', 'phone lagao',
    'mujhe call', 'mujhe phone', 'baat karvao',
    'ring karo', 'dial karo', 'voice call',
    // Hindi
    'call karen', 'call karo mujhe', 'phone karo mujhe',
];

const GREETING_KEYWORDS = [
    'hi', 'hello', 'hey', 'hii', 'helo', 'hola',
    'namaste', 'namaskar', 'sat sri akal', 'assalamualaikum',
    'good morning', 'good afternoon', 'good evening', 'good night',
    'salam', 'jai hind', 'howdy',
];

const ESCALATE_KEYWORDS = [
    'human', 'agent', 'manager', 'support', 'help desk', 'real person',
    'manav', 'insaan', 'real agent', 'live agent', 'speak to someone',
    'talk to human', 'connect to human', 'transfer me',
];

/**
 * Detect intent from incoming message text (case-insensitive).
 * @param {string} message - Raw WhatsApp message body
 * @returns {{ intent: string, confidence: number, shouldBypassLLM: boolean, immediateReply: string|null }}
 */
// Removed GREETINGS_FAST_PATH_MAP as greetings should be handled by tenant's LLM prompt

function detect(message) {
    if (!message || typeof message !== 'string') {
        return { intent: 'UNKNOWN', confidence: 0, shouldBypassLLM: false, immediateReply: null };
    }

    const text = message.toLowerCase().trim();
    const cleanedText = text.replace(/[!?.,]/g, '').trim();

    // 1. FAST-PATH GREETING SHORTCUT (Removed to allow LLM to handle greetings)

    // 2. CALL INTENT — highest priority
    if (CALL_INTENT_KEYWORDS.some(kw => text.includes(kw))) {
        return {
            intent: 'INITIATE_VOICE_CALL',
            confidence: 95,
            shouldBypassLLM: true,
            immediateReply: null, // Will be dynamically built with customer name by caller
        };
    }

    // 3. GREETING — fallback for non-exact greetings
    const isExactGreeting = GREETING_KEYWORDS.some(kw => text === kw || text === kw + '!' || text === kw + '?');
    const isShortGreeting = GREETING_KEYWORDS.some(kw => text.includes(kw)) && text.length < 25;
    if (isExactGreeting || isShortGreeting) {
        return {
            intent: 'GREETING',
            confidence: 80,
            shouldBypassLLM: false, // Let LLM respond but flag as greeting for fast-path optimization
            immediateReply: null,
        };
    }

    // 4. ESCALATION — human transfer requested
    if (ESCALATE_KEYWORDS.some(kw => text.includes(kw))) {
        return {
            intent: 'ESCALATE_TO_HUMAN',
            confidence: 85,
            shouldBypassLLM: false,
            immediateReply: null,
        };
    }

    // 5. Everything else — full LLM pass
    return {
        intent: 'GENERAL',
        confidence: 0,
        shouldBypassLLM: false,
        immediateReply: null,
    };
}

/**
 * Build a personalized immediate reply for call intent.
 * @param {string|null} customerName - Contact name from CRM
 * @param {boolean} voiceAvailable - Whether a voice provider is configured
 * @returns {string}
 */
function buildCallIntentReply(customerName, voiceAvailable) {
    const nameStr = customerName ? `, ${customerName}` : '';
    if (voiceAvailable) {
        return `Sure${nameStr}! Initiating your AI call now. 📞 Please keep your phone ready, you will receive a call shortly.`;
    } else {
        return `Sorry${nameStr}, voice calling is currently unavailable. But I'm here to help you via chat! How can I assist you?`;
    }
}

module.exports = { detect, buildCallIntentReply, CALL_INTENT_KEYWORDS };
