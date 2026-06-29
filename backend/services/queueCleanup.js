/**
 * STEP 5: Queue Cleanup & Dead Job Management
 *
 * Run periodically (e.g. daily) or manually to:
 * - Remove completed jobs older than 24h
 * - Remove failed jobs with max attempts exhausted
 * - Log stuck/active jobs for investigation
 * - Report queue health metrics
 *
 * Can be called via: node services/queueCleanup.js
 * Or imported and called from a cron job.
 */
require('dotenv').config();
const { Queue } = require('bullmq');
const redis = require('./redisConnection');
const logger = require('./logger');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const QUEUES = ['campaign-queue', 'webhook.inbound', 'webhook.reply', 'chat.send'];
const MAX_COMPLETED_AGE_MS = 24 * 60 * 60 * 1000;  // 24 hours
const MAX_FAILED_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

async function runCleanup() {
    logger.info('[QueueCleanup] Starting queue cleanup...');
    const results = {};

    for (const qName of QUEUES) {
        const q = new Queue(qName, { connection: redis });

        try {
            // 1. Drain old completed jobs
            const completedBefore = await q.getCompletedCount();
            await q.clean(MAX_COMPLETED_AGE_MS, 100, 'completed');
            const completedAfter = await q.getCompletedCount();

            // 2. Drain old failed jobs
            const failedBefore = await q.getFailedCount();
            await q.clean(MAX_FAILED_AGE_MS, 100, 'failed');
            const failedAfter = await q.getFailedCount();

            // 3. Check stuck active jobs (active > 5 minutes = problem)
            const activeJobs = await q.getActive();
            const stuckJobs = activeJobs.filter(j => {
                const age = Date.now() - j.processedOn;
                return age > 5 * 60 * 1000; // > 5 mins
            });

            if (stuckJobs.length > 0) {
                logger.warn('[QueueCleanup] Stuck jobs detected', {
                    queue: qName,
                    stuckCount: stuckJobs.length,
                    jobIds: stuckJobs.map(j => j.id),
                });
            }

            results[qName] = {
                completedCleaned: completedBefore - completedAfter,
                failedCleaned: failedBefore - failedAfter,
                stuckJobs: stuckJobs.length,
                remaining: {
                    waiting: await q.getWaitingCount(),
                    active: await q.getActiveCount(),
                    failed: failedAfter,
                    completed: completedAfter,
                },
            };

            logger.info(`[QueueCleanup] ${qName} cleaned`, results[qName]);
        } catch (err) {
            logger.error(`[QueueCleanup] Failed to clean ${qName}`, { err: err.message });
        } finally {
            await q.close();
        }
    }

    // 4. Onboarding, Sandbox, and Action Logs Database Retention Pruning
    try {
        logger.info('[QueueCleanup] Starting database logs retention pruning...');

        // A. Sandbox / Test Mode Logs: older than 7 days
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const deletedSandboxLogs = await prisma.signupAutomationLog.deleteMany({
            where: {
                testMode: true,
                createdAt: { lt: sevenDaysAgo }
            }
        });
        logger.info(`[QueueCleanup] Purged ${deletedSandboxLogs.count} sandbox onboarding logs older than 7 days.`);

        const deletedSandboxActionLogs = await prisma.aiActionLog.deleteMany({
            where: {
                isSandbox: true,
                executedAt: { lt: sevenDaysAgo }
            }
        });
        logger.info(`[QueueCleanup] Purged ${deletedSandboxActionLogs.count} sandbox AI action logs older than 7 days.`);

        // B. Production Logs: older than 30 days
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const deletedProdLogs = await prisma.signupAutomationLog.deleteMany({
            where: {
                testMode: false,
                createdAt: { lt: thirtyDaysAgo }
            }
        });
        logger.info(`[QueueCleanup] Purged ${deletedProdLogs.count} production onboarding logs older than 30 days.`);

        const deletedProdActionLogs = await prisma.aiActionLog.deleteMany({
            where: {
                isSandbox: false,
                executedAt: { lt: thirtyDaysAgo }
            }
        });
        logger.info(`[QueueCleanup] Purged ${deletedProdActionLogs.count} production AI action logs older than 30 days.`);

        // C. AI Usage Logs: older than 30 days
        const deletedUsageLogs = await prisma.aiUsageLog.deleteMany({
            where: {
                createdAt: { lt: thirtyDaysAgo }
            }
        });
        logger.info(`[QueueCleanup] Purged ${deletedUsageLogs.count} AI usage statistics logs older than 30 days.`);

        results.databaseCleanup = {
            sandboxLogsCleaned: deletedSandboxLogs.count,
            sandboxActionLogsCleaned: deletedSandboxActionLogs.count,
            productionLogsCleaned: deletedProdLogs.count,
            productionActionLogsCleaned: deletedProdActionLogs.count,
            aiUsageLogsCleaned: deletedUsageLogs.count
        };

    } catch (dbErr) {
        logger.error('[QueueCleanup] Failed to perform database logs retention pruning', { error: dbErr.message });
    }

    logger.info('[QueueCleanup] Complete.', { results });
    return results;
}

// Run standalone if called directly
if (require.main === module) {
    runCleanup()
        .then(() => prisma.$disconnect())
        .then(() => redis.quit())
        .then(() => process.exit(0))
        .catch((err) => {
            console.error(err);
            process.exit(1);
        });
}

module.exports = { runCleanup };
