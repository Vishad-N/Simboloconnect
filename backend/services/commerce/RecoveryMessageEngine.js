/**
 * RecoveryMessageEngine.js
 * Phase B — AI-powered abandoned checkout recovery message generator.
 * Creates personalized WhatsApp recovery messages using customer intelligence.
 */
const prisma = require('../../prismaClient');
const CustomerIntelligenceService = require('./CustomerIntelligenceService');

const RECOVERY_TEMPLATES = {
    new: [
        "Hi {name}! 👋 Looks like you left something behind. Your cart with {productName} is still waiting! Complete your purchase here: {url}",
        "Hey {name}! Don't miss out on {productName} 🛍️ Your order is saved — just tap to finish: {url}"
    ],
    occasional: [
        "Hi {name}! Great to hear from you again 😊 You were so close! {productName} is ready for you: {url}",
        "Hey {name}, your {productName} is still in your cart! Complete checkout before it sells out: {url}"
    ],
    loyal: [
        "Hi {name}! As one of our valued customers, your {productName} is reserved for you 🌟 Tap to complete: {url}",
        "Hey {name} 👑 We saved your cart! Grab your {productName} now: {url}"
    ],
    vip: [
        "Dear {name}, your exclusive order for {productName} is waiting ✨ As a VIP member, your cart is reserved for 24 hours: {url}",
        "Hi {name} 🌟 We noticed you left {productName} behind. As a VIP, enjoy priority checkout: {url}"
    ],
    churned: [
        "Hi {name}! We miss you 💙 Come back and grab your {productName} — special offer inside: {url}",
        "Hey {name}! It's been a while 😊 We noticed you browsed {productName}. Welcome back! {url}"
    ]
};

const URGENCY_MESSAGES = {
    1: "", // No urgency on first attempt
    2: "⏰ Only a few left in stock!",
    3: "🔥 Last chance! This offer expires in 2 hours."
};

class RecoveryMessageEngine {
    /**
     * Generate a personalized recovery message for a contact
     * @param {string} workspaceId
     * @param {string} contactPhone
     * @param {string} productName
     * @param {string} recoveryUrl
     * @param {number} attemptNumber - Which attempt this is (1, 2, 3)
     * @returns {string} The recovery message text
     */
    static async generateMessage(workspaceId, contactPhone, productName, recoveryUrl, attemptNumber = 1) {
        try {
            // Get customer intelligence for personalization
            const intel = await CustomerIntelligenceService.getOrCompute(workspaceId, contactPhone);
            const contact = await prisma.contact.findFirst({
                where: { userId: workspaceId, phone: contactPhone }
            });

            const customerName = contact?.name || intel.customerName || 'there';
            const segment = intel.segment || 'new';

            // Pick template based on segment and attempt number
            const templates = RECOVERY_TEMPLATES[segment] || RECOVERY_TEMPLATES.new;
            const templateIndex = (attemptNumber - 1) % templates.length;
            let message = templates[templateIndex];

            // Inject variables
            message = message
                .replace('{name}', customerName.split(' ')[0])
                .replace('{productName}', productName)
                .replace('{url}', recoveryUrl);

            // Append urgency text for later attempts
            const urgency = URGENCY_MESSAGES[attemptNumber] || URGENCY_MESSAGES[3];
            if (urgency) message += `\n\n${urgency}`;

            return message;
        } catch (error) {
            console.error('[RecoveryMessageEngine] Error generating message:', error.message);
            // Fallback generic message
            return `Hi! You left ${productName} in your cart. Complete your purchase here: ${recoveryUrl}`;
        }
    }

    /**
     * Determine the delay (in minutes) before each recovery attempt
     * @param {number} attemptNumber
     * @returns {number} delay in minutes
     */
    static getDelayMinutes(attemptNumber) {
        const delays = {
            1: 30,    // 30 minutes after abandonment
            2: 240,   // 4 hours
            3: 1440,  // 24 hours
        };
        return delays[attemptNumber] || 1440;
    }

    /**
     * Get the maximum number of recovery attempts
     */
    static maxAttempts() {
        return 3;
    }
}

module.exports = RecoveryMessageEngine;
