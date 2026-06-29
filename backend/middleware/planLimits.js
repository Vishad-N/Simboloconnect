/**
 * planLimits.js
 * Middleware helpers to enforce plan-based limits for each resource.
 * Each helper reads the user's effective limit (User override fields, which
 * Admin sets manually, take precedence over their current Plan defaults).
 */
const prisma = require('../prismaClient');

/**
 * Get the effective limits for a user.
 * Priority: User-level overrides → Plan defaults → Hardcoded defaults
 */
async function getEffectiveLimits(userId) {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { plan: true }
    });
    if (!user) throw new Error('User not found');

    const plan = user.plan;

    return {
        contact_limit:      user.contact_limit       ?? plan?.contacts_limit      ?? 1000,
        campaigns_limit:    user.campaigns_limit     ?? plan?.campaigns_limit     ?? 60,
        bot_replies_limit:  user.bot_replies_limit   ?? plan?.bot_replies_limit   ?? 1000,
        bot_flows_limit:    user.bot_flows_limit     ?? plan?.bot_flows_limit     ?? 5,
        team_members_limit: user.team_members_limit  ?? plan?.team_members_limit  ?? 3,
        message_limit:      user.message_limit       ?? plan?.message_limit       ?? 1000,
    };
}

/** Block if contacts count >= contact_limit */
async function enforceContactLimit(req, res, next) {
    try {
        const userId = req.user?.id || req.headers['x-user-id'];
        if (!userId) return next();

        const limits = await getEffectiveLimits(userId);
        const count = await prisma.contact.count({ where: { userId } });

        if (count >= limits.contact_limit) {
            return res.status(403).json({
                error: `Contact limit reached. Your plan allows up to ${limits.contact_limit} contacts. Please upgrade your plan.`,
                limitReached: 'CONTACTS',
                current: count,
                limit: limits.contact_limit
            });
        }
        next();
    } catch (err) {
        console.error('[enforceContactLimit]', err);
        next(); // fail open to avoid blocking legitimate users on errors
    }
}

/** Block if monthly campaign count >= campaigns_limit */
async function enforceCampaignLimit(req, res, next) {
    try {
        const userId = req.user?.id || req.headers['x-user-id'];
        if (!userId) return next();

        const limits = await getEffectiveLimits(userId);

        // Count campaigns created this calendar month
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const count = await prisma.campaign.count({
            where: {
                userId,
                createdAt: { gte: startOfMonth }
            }
        });

        if (count >= limits.campaigns_limit) {
            return res.status(403).json({
                error: `Monthly campaign limit reached. Your plan allows ${limits.campaigns_limit} campaigns per month. Try again next month or upgrade your plan.`,
                limitReached: 'CAMPAIGNS',
                current: count,
                limit: limits.campaigns_limit
            });
        }
        next();
    } catch (err) {
        console.error('[enforceCampaignLimit]', err);
        next();
    }
}

/** Block if chatbot flow count >= bot_flows_limit */
async function enforceBotFlowLimit(req, res, next) {
    try {
        const userId = req.user?.id || req.headers['x-user-id'];
        if (!userId) return next();

        const limits = await getEffectiveLimits(userId);
        const count = await prisma.chatbotFlow.count({ where: { userId } });

        if (count >= limits.bot_flows_limit) {
            return res.status(403).json({
                error: `Bot flow limit reached. Your plan allows up to ${limits.bot_flows_limit} bot flows. Please upgrade your plan.`,
                limitReached: 'BOT_FLOWS',
                current: count,
                limit: limits.bot_flows_limit
            });
        }
        next();
    } catch (err) {
        console.error('[enforceBotFlowLimit]', err);
        next();
    }
}

/** Block if team member (STAFF) count >= team_members_limit */
async function enforceTeamMemberLimit(req, res, next) {
    try {
        const userId = req.user?.id || req.headers['x-user-id'];
        if (!userId) return next();

        const limits = await getEffectiveLimits(userId);
        const count = await prisma.user.count({
            where: { adminId: userId, role: 'STAFF' }
        });

        if (count >= limits.team_members_limit) {
            return res.status(403).json({
                error: `Team member limit reached. Your plan allows up to ${limits.team_members_limit} team members. Please upgrade your plan.`,
                limitReached: 'TEAM_MEMBERS',
                current: count,
                limit: limits.team_members_limit
            });
        }
        next();
    } catch (err) {
        console.error('[enforceTeamMemberLimit]', err);
        next();
    }
}

async function checkMessageLimit(userId, count = 1) {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { plan: true }
    });
    if (!user) throw new Error('User not found');
    if (user.role === 'SUPERADMIN') return;

    const plan = user.plan;
    const limit = user.message_limit ?? plan?.message_limit ?? 1000;

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const sentCount = await prisma.messageLog.count({
        where: {
            userId,
            direction: 'OUTBOUND',
            timestamp: { gte: startOfMonth }
        }
    });

    if (sentCount + count > limit) {
        throw new Error(`Message limit reached. Your plan allows up to ${limit} messages per month. You have sent ${sentCount} messages.`);
    }
}

module.exports = {
    getEffectiveLimits,
    enforceContactLimit,
    enforceCampaignLimit,
    enforceBotFlowLimit,
    enforceTeamMemberLimit,
    checkMessageLimit
};
