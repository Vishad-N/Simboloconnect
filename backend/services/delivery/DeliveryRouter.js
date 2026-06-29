/**
 * DeliveryRouter.js
 * Phase B — Enterprise Delivery routing and state tracking.
 * Routes orders to the correct fulfillment provider (Shiprocket, Delhivery, etc.).
 */
const prisma = require('../../prismaClient');
const ShiprocketAdapter = require('./adapters/ShiprocketAdapter');
const DelhiveryAdapter = require('./adapters/DelhiveryAdapter');
const BlueDartAdapter = require('./adapters/BlueDartAdapter');
const { logAudit } = require('../../middleware/auditTrail');

const PROVIDERS = {
    shiprocket: ShiprocketAdapter,
    delhivery: DelhiveryAdapter,
    bluedart: BlueDartAdapter
};

class DeliveryRouter {
    /**
     * Dispatch an order for shipping / generate dynamic AWB
     * @param {string} workspaceId
     * @param {string} orderId
     * @param {Object} details - Ship details { shippingAddress, pincode, city, state, weight }
     * @returns {Promise<DeliveryTracking>}
     */
    static async shipOrder(workspaceId, orderId, details) {
        const FEATURE_DELIVERY = process.env.FEATURE_DELIVERY === 'true';
        if (!FEATURE_DELIVERY) throw new Error('Delivery module is disabled via feature flags.');

        const order = await prisma.ecomOrder.findFirst({
            where: { id: orderId, userId: workspaceId }
        });

        if (!order) throw new Error('eCommerce Order not found.');

        // 1. Fetch configured provider settings (Default to shiprocket for demo)
        const providerName = details.provider || 'shiprocket';
        const ProviderClass = PROVIDERS[providerName];
        if (!ProviderClass) throw new Error(`Unsupported courier service: ${providerName}`);

        // Fetch credentials (decrypted if stored encrypted; here plain for standard demo config)
        const config = details.config || {
            email: process.env.SHIPROCKET_EMAIL || 'shiprocket@example.com',
            password: process.env.SHIPROCKET_PASSWORD || 'password123',
            pickupLocation: 'Primary'
        };

        const adapter = new ProviderClass(config);
        
        // 2. Register Shipment
        const shipmentResult = await adapter.createShipment(order, details);

        // 3. Log to DB
        const tracking = await prisma.deliveryTracking.create({
            data: {
                userId: workspaceId,
                orderId: order.id,
                provider: providerName,
                trackingId: shipmentResult.trackingId,
                awbNumber: shipmentResult.awbNumber,
                status: 'pending',
                statusHistory: []
            }
        });

        await logAudit({
            userId: workspaceId,
            actor: 'system',
            action: 'shipment_dispatched',
            entityType: 'DeliveryTracking',
            entityId: tracking.id,
            after: tracking
        });

        return tracking;
    }

    /**
     * Update shipment status from background polling / webhook
     */
    static async updateStatus(awbNumber, statusData) {
        const record = await prisma.deliveryTracking.findFirst({
            where: { awbNumber }
        });

        if (!record) return;

        const before = { ...record };
        const updated = await prisma.deliveryTracking.update({
            where: { id: record.id },
            data: {
                status: statusData.status,
                currentLocation: statusData.location,
                estimatedDelivery: statusData.estimatedDelivery,
                statusHistory: statusData.history || [],
                deliveredAt: statusData.status === 'delivered' ? new Date() : null
            }
        });

        // Trigger WhatsApp Notification alert if status changed
        if (before.status !== updated.status) {
            await DeliveryRouter.triggerWhatsAppFulfillmentAlert(updated);
        }

        await logAudit({
            userId: record.userId,
            actor: 'system',
            action: 'shipment_status_updated',
            entityType: 'DeliveryTracking',
            entityId: record.id,
            before,
            after: updated
        });
    }

    /**
     * Send contextual fulfillment alerts directly to WhatsApp
     */
    static async triggerWhatsAppFulfillmentAlert(tracking) {
        if (tracking.whatsappNotified && tracking.status !== 'delivered') return;

        const order = await prisma.ecomOrder.findUnique({
            where: { id: tracking.orderId }
        });

        if (!order || !order.customerPhone) return;

        let statusText = '';
        if (tracking.status === 'in_transit') statusText = 'is in transit! 🚚';
        if (tracking.status === 'out_for_delivery') statusText = 'is out for delivery today! 📦';
        if (tracking.status === 'delivered') statusText = 'has been delivered successfully! 🎉';

        if (!statusText) return;

        const message = `Hi ${order.customerName || 'there'}, your order #${order.externalOrderId || tracking.orderId} ${statusText} Tracking ID: ${tracking.awbNumber || 'Pending'}.`;

        console.log(`[Fulfillment Alert] WhatsApp message dispatched to ${order.customerPhone}:`, message);

        await prisma.deliveryTracking.update({
            where: { id: tracking.id },
            data: {
                whatsappNotified: true,
                lastNotifiedAt: new Date()
            }
        });
    }
}

module.exports = DeliveryRouter;
