require('dotenv').config();
const prisma = require('./prismaClient');
const redis = require('./services/redisConnection');
const { execSync } = require('child_process');

async function run() {
    console.log("=== PHASE 1/2/3 PRODUCTION STABILITY REPORT ===");

    // 1. Delivery Performance (Before vs After)
    const now = new Date();
    const phaseDeployedAt = new Date(Date.now() - 6 * 60 * 60 * 1000); // Approximate deploy time (6 hours ago)
    const beforeDate = new Date(phaseDeployedAt.getTime() - 24 * 60 * 60 * 1000); // 24h before deploy

    const getStats = async (start, end) => {
        const total = await prisma.messageLog.count({ where: { timestamp: { gte: start, lte: end }, direction: 'OUTBOUND' } });
        const sent = await prisma.messageLog.count({ where: { timestamp: { gte: start, lte: end }, direction: 'OUTBOUND', status: 'SENT' } });
        const delivered = await prisma.messageLog.count({ where: { timestamp: { gte: start, lte: end }, direction: 'OUTBOUND', status: 'DELIVERED' } });
        const read = await prisma.messageLog.count({ where: { timestamp: { gte: start, lte: end }, direction: 'OUTBOUND', status: 'READ' } });
        const failed = await prisma.messageLog.count({ where: { timestamp: { gte: start, lte: end }, direction: 'OUTBOUND', status: 'FAILED' } });
        return { total, sent, delivered, read, failed };
    };

    const beforeStats = await getStats(beforeDate, phaseDeployedAt);
    const afterStats = await getStats(phaseDeployedAt, now);

    console.log("\n[1] Delivery Performance:");
    console.log(`Before Update (24h window): Total: ${beforeStats.total}, Failed: ${beforeStats.failed} (${beforeStats.total ? (beforeStats.failed/beforeStats.total*100).toFixed(2) : 0}%)`);
    console.log(`After Update (Since deploy): Total: ${afterStats.total}, Failed: ${afterStats.failed} (${afterStats.total ? (afterStats.failed/afterStats.total*100).toFixed(2) : 0}%)`);

    // 2. Duplicates Prevented (Idempotency Success)
    const idempotencyKeys = await redis.keys('idempotency:msg_*');
    console.log(`\n[2] Duplicate Prevention:`);
    console.log(`Tracked Webhooks (Idempotency Locks): ${idempotencyKeys.length}`);

    // 3. Worker & Redis Memory Stability
    console.log("\n[3] Memory & Resource Stability:");
    const redisInfo = await redis.info('memory');
    const usedMemMatch = redisInfo.match(/used_memory_human:(.*)/);
    console.log(`Redis Memory Used: ${usedMemMatch ? usedMemMatch[1].trim() : 'Unknown'}`);
    
    try {
        const memUsage = execSync('ps -o rss,command | grep node').toString();
        console.log(`Node Worker RSS Memory:\n${memUsage.trim().split('\n').map(l => '  ' + l).join('\n')}`);
    } catch (e) {
        console.log("Could not fetch process memory.");
    }

    // 4. Queue Latency & Health
    console.log("\n[4] Queue Health (BullMQ):");
    const { Queue } = require('bullmq');
    const qNames = ['campaign-queue', 'webhook.inbound', 'webhook.reply', 'chat.send'];
    for (const name of qNames) {
        const q = new Queue(name, { connection: redis });
        const waiting = await q.getWaitingCount();
        const active = await q.getActiveCount();
        const failed = await q.getFailedCount();
        console.log(` - ${name}: ${active} active, ${waiting} waiting, ${failed} failed`);
        await q.close();
    }

    await prisma.$disconnect();
    await redis.quit();
}

run().catch(console.error);
