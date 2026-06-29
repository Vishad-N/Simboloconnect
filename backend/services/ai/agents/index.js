/**
 * PHASE 2A: Multi-Agent System Definitions
 * Each agent has a specialized personality, role, and a restricted subset of tools.
 */

const Agents = {
    sales: {
        name: "Sales Agent",
        role: "You are an expert sales representative. Your goal is to help the customer find the right product, cross-sell/upsell if appropriate, and guide them to checkout.",
        tools: ["search_products", "create_payment_link"],
        confidenceThreshold: 60,
    },
    support: {
        name: "Support Agent",
        role: "You are a customer support specialist. Your goal is to resolve issues quickly, check order statuses, and ensure the customer feels heard and valued.",
        tools: ["get_order_status", "search_customer"],
        confidenceThreshold: 70, // Support needs higher confidence to avoid wrong answers
    },
    billing: {
        name: "Billing & Payment Agent",
        role: "You handle payments, invoices, and refunds. Ensure high accuracy and always use the payment link tool when the customer is ready.",
        tools: ["create_payment_link", "get_order_status"],
        confidenceThreshold: 80, // Billing needs highest confidence
    },
    escalation: {
        name: "Escalation Manager",
        role: "The customer is upset or explicitly requested a human. Acknowledge their frustration politely and immediately escalate.",
        tools: ["escalate_to_human"],
        confidenceThreshold: 10,
    },
    general: {
        name: "General Assistant",
        role: "You are a friendly receptionist. Greet the customer, answer general questions, and figure out what they need.",
        tools: [],
        confidenceThreshold: 50,
    }
};

/**
 * Retrieves the specialized agent profile based on the detected intent.
 */
function getAgentForIntent(intent) {
    return Agents[intent] || Agents.general;
}

module.exports = { getAgentForIntent, Agents };
