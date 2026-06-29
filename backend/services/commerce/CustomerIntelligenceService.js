/**
 * CustomerIntelligenceService.js
 * Phase B — Computes and caches customer intelligence metrics.
 * Calculates LTV, churn risk, AI score, and segment for each customer.
 */
const prisma = require('../../prismaClient');

class CustomerIntelligenceService {
    /**
     * Get existing intelligence record or compute from scratch.
     * Refreshes if data is older than 1 hour.
     * @param {string} workspaceId
     * @param {string} contactPhone
     * @returns {Object} CustomerIntelligence record
     */
    static async getOrCompute(workspaceId, contactPhone) {
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

        let record = await prisma.customerIntelligence.findUnique({
            where: { userId_contactPhone: { userId: workspaceId, contactPhone } }
        });

        if (record && record.computedAt > oneHourAgo) {
            return record; // Return cached record
        }

        // Compute fresh data
        return CustomerIntelligenceService.recompute(workspaceId, contactPhone);
    }

    /**
     * Recompute intelligence data from orders and contacts
     * @param {string} workspaceId
     * @param {string} contactPhone
     */
    static async recompute(workspaceId, contactPhone) {
        const orders = await prisma.ecomOrder.findMany({
            where: {
                userId: workspaceId,
                customerPhone: contactPhone,
                paymentStatus: 'paid'
            },
            orderBy: { createdAt: 'desc' }
        });

        const contact = await prisma.contact.findFirst({
            where: { userId: workspaceId, phone: contactPhone }
        });

        const orderCount = orders.length;
        const ltv = orders.reduce((sum, o) => sum + Number(o.totalAmount || 0), 0);
        const avgOrderValue = orderCount > 0 ? ltv / orderCount : 0;
        const lastOrderAt = orders[0]?.createdAt || null;
        const daysSinceLastOrder = lastOrderAt
            ? Math.floor((Date.now() - new Date(lastOrderAt).getTime()) / (1000 * 60 * 60 * 24))
            : 999;

        // Segment logic
        let segment = 'new';
        if (orderCount === 0) segment = 'new';
        else if (orderCount === 1) segment = 'occasional';
        else if (orderCount >= 2 && daysSinceLastOrder <= 90) segment = 'loyal';
        else if (ltv >= 10000) segment = 'vip';
        else if (daysSinceLastOrder > 180) segment = 'churned';

        // Churn risk logic
        let churnRisk = 'low';
        if (daysSinceLastOrder > 180) churnRisk = 'high';
        else if (daysSinceLastOrder > 90) churnRisk = 'medium';

        // AI Score (0-100): blend of recency, frequency, monetary
        const recencyScore = Math.max(0, 100 - daysSinceLastOrder / 3);
        const frequencyScore = Math.min(100, orderCount * 10);
        const monetaryScore = Math.min(100, ltv / 200);
        const aiScore = Math.round((recencyScore * 0.4) + (frequencyScore * 0.3) + (monetaryScore * 0.3));

        const isVip = ltv >= 10000 || orderCount >= 10;

        // Extract preferred products from order line items
        const productFrequency = {};
        for (const order of orders) {
            const items = Array.isArray(order.lineItems) ? order.lineItems : [];
            for (const item of items) {
                const name = item.name || item.title;
                if (name) productFrequency[name] = (productFrequency[name] || 0) + 1;
            }
        }
        const preferredProducts = Object.entries(productFrequency)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([name]) => name);

        const intelligenceData = {
            userId: workspaceId,
            contactPhone,
            customerName: contact?.name || null,
            ltv,
            orderCount,
            avgOrderValue,
            lastOrderAt,
            daysSinceLastOrder,
            aiScore,
            churnRisk,
            segment,
            isVip,
            preferredProducts,
            tags: contact?.tags || [],
            computedAt: new Date()
        };

        const record = await prisma.customerIntelligence.upsert({
            where: { userId_contactPhone: { userId: workspaceId, contactPhone } },
            update: intelligenceData,
            create: intelligenceData
        });

        return record;
    }

    /**
     * Batch recompute for all customers in a workspace.
     * Called by a background CRON job.
     */
    static async batchRecompute(workspaceId, limit = 100) {
        // Get unique customer phones for this workspace
        const phones = await prisma.ecomOrder.groupBy({
            by: ['customerPhone'],
            where: { userId: workspaceId, customerPhone: { not: null } },
            _count: { customerPhone: true },
            take: limit
        });

        let updated = 0;
        for (const { customerPhone } of phones) {
            if (!customerPhone) continue;
            try {
                await CustomerIntelligenceService.recompute(workspaceId, customerPhone);
                updated++;
            } catch (e) {
                console.error(`[CustomerIntelligence] Failed to recompute for ${customerPhone}:`, e.message);
            }
        }
        return updated;
    }
}

module.exports = CustomerIntelligenceService;
