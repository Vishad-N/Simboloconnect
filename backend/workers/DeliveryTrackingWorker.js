/**
 * DeliveryTrackingWorker.js
 * Phase B — Background BullMQ worker for periodic courier tracking synchronization.
 * Pulls active transit shipments and fetches fresh details from providers.
 */
const { Worker, Queue } = require('bullmq');
const redisConnection = require('../services/redisConnection');
const prisma = require('../prismaClient');
const ShiprocketAdapter = require('../services/delivery/adapters/ShiprocketAdapter');
const DelhiveryAdapter = require('../services/delivery/adapters/DelhiveryAdapter');
const BlueDartAdapter = require('../services/delivery/adapters/BlueDartAdapter');
const DeliveryRouter = require('../services/delivery/DeliveryRouter');

const deliveryQueue = new Queue('delivery.tracking', { connection: redisConnection });

const PROVIDERS = {
    shiprocket: ShiprocketAdapter,
    delhivery: DelhiveryAdapter,
    bluedart: BlueDartAdapter
};

/**
 * Worker processor
 */
const deliveryTrackingWorker = new Worker('delivery.tracking', async (job) => {
    const FEATURE_DELIVERY = process.env.FEATURE_DELIVERY === 'true';
    if (!FEATURE_DELIVERY) return;

    console.log('[DeliveryTrackingWorker] Initiating courier tracking sync cycle...');

    // Find all outstanding active deliveries
    const deliveries = await prisma.deliveryTracking.findMany({
        where: {
            status: { in: ['pending', 'in_transit', 'out_for_delivery'] },
            awbNumber: { not: null }
        },
        take: 50 // process in batches of 50
    });

    for (const d of deliveries) {
        try {
            const ProviderClass = PROVIDERS[d.provider];
            if (!ProviderClass) continue;

            // Fetch generic adapter configurations
            const config = d.provider === 'shiprocket' ? {
                email: process.env.SHIPROCKET_EMAIL || 'shiprocket@example.com',
                password: process.env.SHIPROCKET_PASSWORD || 'password123'
            } : { apiKey: 'dummy' };

            const adapter = new ProviderClass(config);
            const freshStatus = await adapter.trackShipment(d.awbNumber);

            // Reconcile status in database
            await DeliveryRouter.updateStatus(d.awbNumber, freshStatus);

        } catch (err) {
            console.error(`[DeliveryTrackingWorker] Failed to sync AWB ${d.awbNumber}:`, err.message);
        }
    }
}, { connection: redisConnection, concurrency: 2 });

module.exports = { deliveryTrackingWorker, deliveryQueue };
