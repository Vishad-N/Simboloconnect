const express = require('express');
const router = express.Router();
const prisma = require('../prismaClient');

const { authenticate } = require('../middleware/auth');
const checkPermission = require('../middleware/rbac');

router.get('/', authenticate, async (req, res) => {
    const userId = req.user.workspaceId;
    try {
        const weekStart = new Date();
        weekStart.setDate(weekStart.getDate() - 6);
        weekStart.setHours(0,0,0,0);

        const [totalSentCount, totalReadCount, activeContactsCount, recentCampaigns, weeklyLogs, totalCampaignsCount, failedMessagesCount] = await Promise.all([
            // 1. Total Messages Sent (Outbound)
            prisma.messageLog.count({
                where: { userId: userId, direction: 'OUTBOUND' }
            }),
            // 2. Total Read Messages
            prisma.messageLog.count({
                where: { userId: userId, direction: 'OUTBOUND', status: 'READ' }
            }),
            // 3. Active Contacts
            prisma.contact.count({
                where: { userId: userId }
            }),
            // 4. Recent Activity (Last 5 Campaigns)
            prisma.campaign.findMany({
                where: { userId: userId },
                orderBy: { createdAt: 'desc' },
                take: 5,
                select: { id: true, name: true, createdAt: true, status: true }
            }),
            // 5. Weekly Logs
            prisma.messageLog.findMany({
                where: { userId: userId, direction: 'OUTBOUND', timestamp: { gte: weekStart } },
                select: { timestamp: true }
            }),
            // 6. Total Campaigns Count
            prisma.campaign.count({
                where: { userId: userId }
            }),
            // 7. Failed Messages Count
            prisma.messageLog.count({
                where: { userId: userId, direction: 'OUTBOUND', status: 'FAILED' }
            })
        ]);

        // Calculate Rate
        const readRate = totalSentCount > 0
            ? ((totalReadCount / totalSentCount) * 100).toFixed(1)
            : 0;

        const deliveryRate = totalSentCount > 0
            ? (((totalSentCount - failedMessagesCount) / totalSentCount) * 100).toFixed(1)
            : 0;

        const recentActivity = recentCampaigns.map(camp => ({
            id: camp.id,
            action: `Created campaign: ${camp.name}`,
            time: camp.createdAt,
            status: camp.status
        }));

        // Group weekly logs
        // We need an array of 7 values, matching Monday to Sunday
        // But let's just do past 7 days ending today
        const weeklyMessages = [0,0,0,0,0,0,0]; // Mon, Tue, Wed, Thu, Fri, Sat, Sun
        let thisWeekMessages = 0;
        
        weeklyLogs.forEach(log => {
            const date = new Date(log.timestamp);
            let day = date.getDay() - 1; // 0 for Monday, 6 for Sunday
            if (day === -1) day = 6; // Sunday
            weeklyMessages[day]++;
            thisWeekMessages++;
        });

        // Use actual database activity counts
        const finalWeekly = weeklyMessages;
        const finalThisWeek = thisWeekMessages;

        res.status(200).json({
            totalMessagesSent: totalSentCount,
            activeContacts: activeContactsCount,
            readRate: parseFloat(readRate),
            deliveryRate: parseFloat(deliveryRate),
            recentActivity: recentActivity,
            weeklyMessages: finalWeekly,
            thisWeekMessages: finalThisWeek,
            totalCampaigns: totalCampaignsCount
        });

    } catch (error) {
        console.error("Analytics Error:", error);
        res.status(500).json({ error: "Failed to fetch analytics data" });
    }
});

module.exports = router;
