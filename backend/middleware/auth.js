const prisma = require('../prismaClient');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key-123';

const authenticate = async (req, res, next) => {
    let userId = null;

    if (req.headers.authorization?.startsWith('Bearer ')) {
        const token = req.headers.authorization.split(' ')[1];

        // ─── PATH 1: External API Token (sk_live_...) ───────────────────────
        // Used by n8n, Zapier, Make, custom integrations etc.
        if (token.startsWith('sk_live_') || token.startsWith('sk_test_')) {
            try {
                const user = await prisma.user.findFirst({
                    where: { apiToken: token }
                });

                if (!user) {
                    console.warn(`[Auth] API token lookup failed — token not found in DB: ${token.slice(0, 20)}...`);
                    return res.status(401).json({ error: "Unauthorized: Invalid or expired token" });
                }

                // Check account status
                if (!user.isActive) {
                    return res.status(403).json({ error: "Account Suspended", code: "SUSPENDED" });
                }
                if (user.validityExpiresAt && new Date(user.validityExpiresAt) < new Date()) {
                    return res.status(403).json({ error: "Subscription Expired", code: "EXPIRED" });
                }

                req.user = user;
                req.user.workspaceId = user.adminId || user.id;
                return next();
            } catch (err) {
                console.error('[Auth] API token DB lookup error:', err.message);
                return res.status(500).json({ error: "Failed to authenticate" });
            }
        }

        // ─── PATH 2: JWT Token (standard browser login) ─────────────────────
        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            userId = decoded.id;
        } catch (err) {
            console.error("JWT Verification failed:", err.message);
            // Don't return yet, fallback to x-user-id for now
        }
    }

    // ─── PATH 3: x-user-id header (Backward compatibility / Admin Portal) ──
    if (!userId) {
        userId = req.headers['x-user-id'];
    }

    // Reject if no valid userId found
    if (!userId) {
        return res.status(401).json({ error: "Unauthorized: Invalid or expired token" });
    }

    try {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: { plan: true }
        });

        if (!user) {
            console.warn(`Authentication failed: User with ID ${userId} not found.`);
            return res.status(401).json({ error: "Unauthorized: User not found" });
        }

        req.user = user;
        req.user.workspaceId = user.adminId || user.id;

        // Skip subscription/active checks for SUPERADMIN so they never get locked out
        if (user.role === 'SUPERADMIN') {
            return next();
        }

        // Check suspension
        if (!user.isActive) {
            return res.status(403).json({ error: "Account Suspended", code: "SUSPENDED" });
        }

        // If user is a STAFF member, subscription & plan are owned by the ADMIN
        let owner = user;
        if (user.adminId) {
            owner = await prisma.user.findUnique({
                where: { id: user.adminId },
                include: { plan: true }
            });
            if (!owner) {
                return res.status(403).json({ error: "Workspace admin not found.", code: "EXPIRED" });
            }
        }

        // Check subscription validity (null means either fresh new user or paid plan awaiting payment)
        const isExpired = owner.validityExpiresAt !== null && new Date(owner.validityExpiresAt) < new Date();
        // NO_PLAN = user has never activated a subscription (validityExpiresAt is null)
        const hasNoPlan = !owner.validityExpiresAt;
        const path = req.originalUrl || req.path || '';

        // Paths always allowed regardless of subscription state
        const isAlwaysAllowed =
            path.startsWith('/auth') ||
            path.startsWith('/api/auth') ||
            path.startsWith('/payment') ||
            path.startsWith('/api/payment') ||
            path.startsWith('/settings') ||
            path.startsWith('/api/settings') ||
            path.startsWith('/profile') ||
            path.startsWith('/api/profile') ||
            path.startsWith('/account') ||
            path.startsWith('/api/account') ||
            path.startsWith('/chat') ||
            path.startsWith('/api/chat') ||
            (req.method === 'GET' && (
                path.startsWith('/api/staff') ||
                path.startsWith('/api/templates') ||
                path.startsWith('/api/contacts')
            )) ||
            path.startsWith('/analytics') ||
            path.startsWith('/api/analytics') ||
            path.includes('webhook') ||
            path.includes('meta') ||
            path.startsWith('/api/public');

        if (isExpired) {
            // User previously had a plan — now expired. Same allowed paths.
            if (!isAlwaysAllowed) {
                // Also allow /contacts so they can still view chat contacts
                const alsoAllowed = path.startsWith('/contacts') || path.startsWith('/api/contacts');
                if (!alsoAllowed) {
                    return res.status(403).json({ error: "Subscription Expired", code: "EXPIRED" });
                }
            }
        } else if (hasNoPlan) {
            // Fresh user with NO active subscription — restrict to live chat + essentials only
            if (!isAlwaysAllowed) {
                const alsoAllowed =
                    path.startsWith('/contacts') ||
                    path.startsWith('/api/contacts') ||
                    path.startsWith('/notifications') ||
                    path.startsWith('/api/notifications');
                if (!alsoAllowed) {
                    return res.status(403).json({ error: "No active subscription", code: "NO_PLAN" });
                }
            }
        } else {
            // Active subscription — check specific feature toggles if they have a plan
            const plan = owner.plan;
            if (plan) {
                // Check campaigns
                if (plan.allow_campaigns === false && (path.includes('/campaigns') || path.includes('/api/campaigns'))) {
                    return res.status(403).json({ error: "Bulk Campaigns feature is not allowed in your plan.", code: "FEATURE_BLOCKED" });
                }
                // Check flow builder
                if (plan.allow_flow_builder === false && (path.includes('/flows') || path.includes('/visualflow') || path.includes('/projects'))) {
                    return res.status(403).json({ error: "Flow Builder feature is not allowed in your plan.", code: "FEATURE_BLOCKED" });
                }
                // Check AI Brain / Agent
                if (plan.allow_ai_brain === false && (path.includes('/ai-agent') || path.includes('/ai/agent') || path.startsWith('/api/ai/agent'))) {
                    return res.status(403).json({ error: "AI Brain feature is not allowed in your plan.", code: "FEATURE_BLOCKED" });
                }
                // Check AI Voice
                if (plan.allow_ai_voice === false && (path.includes('/voice') || path.startsWith('/api/voice'))) {
                    return res.status(403).json({ error: "AI Voice feature is not allowed in your plan.", code: "FEATURE_BLOCKED" });
                }
                // Check QnA / chatbot
                if (plan.allow_qna === false && (path.includes('/qna') || path.includes('/chatbot') || path.includes('/auto-reply'))) {
                    if (!path.includes('/chat/') && !path.includes('/contacts')) {
                        return res.status(403).json({ error: "QnA / Bot feature is not allowed in your plan.", code: "FEATURE_BLOCKED" });
                    }
                }
                // Check Ecommerce
                if (plan.allow_ecommerce === false && (path.includes('/ecom') || path.includes('/ecommerce') || path.includes('/store'))) {
                    return res.status(403).json({ error: "Ecommerce Integration is not allowed in your plan.", code: "FEATURE_BLOCKED" });
                }
                // Check Integrations
                if (plan.allow_integrations === false && (path.includes('/integrations') || path.includes('/google') || path.includes('/sheets') || path.includes('/calendar'))) {
                    return res.status(403).json({ error: "Integrations feature is not allowed in your plan.", code: "FEATURE_BLOCKED" });
                }
                // Check Team
                if (plan.allow_team === false && (path.includes('/staff') || path.includes('/team'))) {
                    return res.status(403).json({ error: "Team members feature is not allowed in your plan.", code: "FEATURE_BLOCKED" });
                }
            }
        }

        next();
    } catch (error) {
        console.error("Auth Middleware Error:", error);
        res.status(500).json({ error: "Failed to authenticate" });
    }
};

const checkSuperAdmin = (req, res, next) => {
    if (req.user && (req.user.role === 'SUPERADMIN' || req.user.role === 'ADMIN_STAFF')) {
        next();
    } else {
        res.status(403).json({ error: "Forbidden: Super Admin access required." });
    }
}

module.exports = { authenticate, checkSuperAdmin };
