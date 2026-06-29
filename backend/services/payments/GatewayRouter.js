/**
 * GatewayRouter.js
 * Phase B — Multi-gateway router with ordered failover support.
 * Routes payment requests to the optimal gateway for a workspace,
 * falling back to the next available gateway on failure.
 */
const prisma = require('../../prismaClient');
const { GatewayFactory, MULTI_GATEWAY_ENABLED } = require('./GatewayFactory');

class GatewayRouter {
    /**
     * Route a payment link creation request through the workspace's configured gateways.
     * Will try gateways in priority order, failing over to the next on error.
     * 
     * @param {string} workspaceId
     * @param {Object} params - Same as BasePaymentGateway.createPaymentLink params
     * @returns {Promise<{ id: string, url: string, status: string, provider: string }>}
     */
    static async createPaymentLink(workspaceId, params) {
        if (MULTI_GATEWAY_ENABLED) {
            return GatewayRouter._routeViaMultiGateway(workspaceId, params);
        }
        // Phase A compatibility: fall back to PaymentCredential table
        return GatewayRouter._routeViaLegacyCredential(workspaceId, params);
    }

    /**
     * PHASE B: Route through ordered PaymentGateway records with failover
     */
    static async _routeViaMultiGateway(workspaceId, params) {
        const gateways = await prisma.paymentGateway.findMany({
            where: { userId: workspaceId, isActive: true },
            orderBy: { priority: 'asc' }
        });

        if (!gateways.length) {
            // Graceful fallback to Phase A legacy credentials
            console.warn(`[GatewayRouter] No PaymentGateway records found for workspace ${workspaceId}, falling back to legacy.`);
            return GatewayRouter._routeViaLegacyCredential(workspaceId, params);
        }

        let lastError;
        for (const gateway of gateways) {
            try {
                const adapter = GatewayFactory.fromGatewayRecord(gateway);
                const result = await adapter.createPaymentLink(params);

                // Record success metrics
                await prisma.paymentGateway.update({
                    where: { id: gateway.id },
                    data: { successCount: { increment: 1 }, lastUsedAt: new Date() }
                });

                return { ...result, provider: gateway.provider, gatewayId: gateway.id };
            } catch (error) {
                console.error(`[GatewayRouter] Gateway ${gateway.provider} (${gateway.id}) failed:`, error.message);
                lastError = error;

                // Record failure metrics
                await prisma.paymentGateway.update({
                    where: { id: gateway.id },
                    data: { failureCount: { increment: 1 } }
                }).catch(() => {}); // Non-critical, don't crash on metric write failure

                // Continue to next gateway in priority order
            }
        }

        throw new Error(`All payment gateways failed. Last error: ${lastError?.message}`);
    }

    /**
     * PHASE A compatibility: Route through the PaymentCredential (Razorpay-only) table
     */
    static async _routeViaLegacyCredential(workspaceId, params) {
        const credential = await prisma.paymentCredential.findUnique({
            where: { userId: workspaceId }
        });

        if (!credential) {
            throw new Error('No payment gateway configured. Please add Razorpay or another gateway in Settings.');
        }

        const adapter = GatewayFactory.fromLegacyCredential(credential);
        const result = await adapter.createPaymentLink(params);
        return { ...result, provider: 'razorpay' };
    }

    /**
     * Fetch the default or active gateway record for a workspace (used in webhooks)
     */
    static async getDefaultGateway(workspaceId, provider) {
        if (MULTI_GATEWAY_ENABLED) {
            return prisma.paymentGateway.findFirst({
                where: { userId: workspaceId, provider, isActive: true },
                orderBy: { isDefault: 'desc' }
            });
        }
        return null; // Webhook routes will fall back to PaymentCredential
    }
}

module.exports = GatewayRouter;
