const express = require('express');
const router = express.Router();
const prisma = require('../prismaClient');
const bcrypt = require('bcryptjs');

const { authenticate } = require('../middleware/auth');

// GET /api/account - Fetch user details
router.get('/', authenticate, async (req, res) => {
    try {
        console.log(`[Account] Fetching details for user: ${req.user.id}`);
        const user = await prisma.user.findUnique({
            where: { id: req.user.id },
            select: {
                name: true,
                email: true,
                logo: true,
                planId: true,
                plan: true,
                validityExpiresAt: true,
                wallet: true,
                role: true,
                permissions: true,
                apiToken: true,
                usedFreePlan: true,
                botEnabled: true,
                message_limit: true,
                contact_limit: true,
                campaigns_limit: true,
                bot_replies_limit: true,
                bot_flows_limit: true,
                team_members_limit: true
                // Do not return password
            }
        });

        if (!user) {
            console.warn(`[Account] User with ID ${req.user.id} not found in DB.`);
            return res.status(404).json({ error: "User not found" });
        }

        console.log(`[Account] Returning data for user: ${user.email}`);
        res.status(200).json(user);
    } catch (error) {
        console.error("[Account] Fetch Error:", error);
        res.status(500).json({ error: "Failed to fetch account details" });
    }
});

// POST /api/account/update - Update user details
router.post('/update', authenticate, async (req, res) => {
    const { name, email, password, logo } = req.body;

    try {
        // Build data object dynamically
        const updateData = {};
        if (name !== undefined) updateData.name = name;
        if (email !== undefined) updateData.email = email;
        if (logo !== undefined) updateData.logo = logo;

        // Hash password if provided
        if (password && password.trim() !== '') {
            const salt = await bcrypt.genSalt(10);
            updateData.password = await bcrypt.hash(password, salt);
        }

        const updatedUser = await prisma.user.update({
            where: { id: req.user.id },
            data: updateData,
            select: {
                name: true,
                email: true,
                logo: true
            }
        });

        console.log("Account updated successfully for user:", req.user.id);
        res.status(200).json({ message: "Account updated successfully", user: updatedUser });
    } catch (error) {
        console.error("Account Update Error:", error);
        // Handle unique constraint violation for email
        if (error.code === 'P2002' && error.meta?.target?.includes('email')) {
            return res.status(400).json({ error: "Email is already in use by another account." });
        }
        res.status(500).json({ error: "Failed to update account details" });
    }
});

// POST /api/account/login - Authenticate users (specifically for Admin portal)
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required" });
    }

    try {
        const user = await prisma.user.findUnique({
            where: { email }
        });

        if (!user) {
            return res.status(401).json({ error: "Invalid credentials" });
        }

        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(401).json({ error: "Invalid credentials" });
        }

        // Return user without password
        const { password: _, ...userWithoutPassword } = user;

        res.status(200).json({
            message: "Login successful",
            user: userWithoutPassword
        });

    } catch (error) {
        console.error("Login Error:", error);
        res.status(500).json({ error: "Failed to authenticate" });
    }
});

// GET /api/account/notifications
router.get('/notifications', authenticate, async (req, res) => {
    try {
        const notifications = await prisma.notification.findMany({
            where: { userId: req.user.id },
            orderBy: { createdAt: 'desc' },
            take: 20
        });
        res.status(200).json(notifications);
    } catch (e) {
        res.status(500).json({ error: "Failed to fetch notifications" });
    }
});

// PUT /api/account/notifications/:id/read
router.put('/notifications/:id/read', authenticate, async (req, res) => {
    try {
        const notification = await prisma.notification.updateMany({
            where: {
                id: req.params.id,
                userId: req.user.id
            },
            data: { isRead: true }
        });
        res.status(200).json({ success: true });
    } catch (e) {
        res.status(500).json({ error: "Failed to mark as read" });
    }
});

// GET /api/account/wallet/logs - Fetch wallet transactions
router.get('/wallet/logs', authenticate, async (req, res) => {
    try {
        const transactions = await prisma.transaction.findMany({
            where: { userId: req.user.id },
            orderBy: { timestamp: 'desc' },
            take: 100
        });

        const wallet = await prisma.wallet.findUnique({
            where: { userId: req.user.id }
        });

        res.status(200).json({
            transactions,
            balance: wallet ? wallet.currentBalance : 0.0
        });
    } catch (e) {
        console.error("Wallet logs error:", e);
        res.status(500).json({ error: "Failed to fetch wallet logs" });
    }
});

// POST /api/account/activate-free-plan
router.post('/activate-free-plan', authenticate, async (req, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user.id }
        });

        if (user.usedFreePlan) {
            return res.status(400).json({ error: "You have already claimed a free plan before." });
        }

        const freePlan = await prisma.plan.findFirst({
            where: { is_default_free: true }
        });

        if (!freePlan) {
            return res.status(404).json({ error: "No free plan available at the moment." });
        }

        const validityExpiresAt = new Date();
        validityExpiresAt.setDate(validityExpiresAt.getDate() + freePlan.duration_days);

        const updatedUser = await prisma.user.update({
            where: { id: req.user.id },
            data: {
                planId: freePlan.id,
                usedFreePlan: true,
                validityExpiresAt,
                message_limit: freePlan.message_limit,
                contact_limit: freePlan.contacts_limit,
                campaigns_limit: freePlan.campaigns_limit,
                bot_replies_limit: freePlan.bot_replies_limit,
                bot_flows_limit: freePlan.bot_flows_limit,
                team_members_limit: freePlan.team_members_limit
            }
        });

        res.status(200).json({ success: true, message: "Free plan activated successfully!", user: updatedUser });
    } catch (e) {
        console.error("Free plan activation error:", e);
        res.status(500).json({ error: "Failed to activate free plan." });
    }
});

module.exports = router;
