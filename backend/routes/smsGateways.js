const express = require('express');
const router = express.Router();
const prisma = require('../prismaClient');
const SmsGatewayService = require('../services/sms/SmsGatewayService');

// Middleware to verify SuperAdmin access
const verifySuperAdmin = async (req, res, next) => {
    try {
        const userId = req.headers['x-user-id'];
        if (!userId) return res.status(401).json({ error: "Unauthorized" });

        // A simple check assuming x-user-id holds the adminToken (JWT or ID)
        // Adjust according to your existing admin auth logic. 
        // If it's a JWT, verify it. If it's an ID, check the database.
        // Assuming your existing admin routes verify this via a token:
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user || user.role !== 'SUPERADMIN') {
            return res.status(403).json({ error: "Forbidden: SuperAdmin access required" });
        }
        next();
    } catch (e) {
        res.status(500).json({ error: "Authentication failed" });
    }
};

// Apply middleware to all routes in this file
router.use(verifySuperAdmin);

// GET /api/admin/sms-gateways
router.get('/', async (req, res) => {
    try {
        const gateways = await prisma.smsGateway.findMany({
            orderBy: { createdAt: 'desc' }
        });
        res.json(gateways);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// POST /api/admin/sms-gateways
router.post('/', async (req, res) => {
    const { provider, config_json, is_primary, is_secondary, status } = req.body;
    try {
        // Enforce only one primary and one secondary
        if (is_primary) {
            await prisma.smsGateway.updateMany({ data: { is_primary: false } });
        }
        if (is_secondary) {
            await prisma.smsGateway.updateMany({ data: { is_secondary: false } });
        }

        const gateway = await prisma.smsGateway.create({
            data: {
                provider,
                config_json,
                is_primary: is_primary || false,
                is_secondary: is_secondary || false,
                status: status || 'ACTIVE'
            }
        });
        res.status(201).json(gateway);
    } catch (e) {
        if (e.code === 'P2002') return res.status(400).json({ error: "Provider already exists" });
        res.status(500).json({ error: e.message });
    }
});

// PUT /api/admin/sms-gateways/:id
router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const { provider, config_json, is_primary, is_secondary, status } = req.body;
    try {
        if (is_primary) {
            await prisma.smsGateway.updateMany({
                where: { id: { not: id } },
                data: { is_primary: false }
            });
        }
        if (is_secondary) {
            await prisma.smsGateway.updateMany({
                where: { id: { not: id } },
                data: { is_secondary: false }
            });
        }

        const gateway = await prisma.smsGateway.update({
            where: { id },
            data: { provider, config_json, is_primary, is_secondary, status }
        });
        res.json(gateway);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// DELETE /api/admin/sms-gateways/:id
router.delete('/:id', async (req, res) => {
    try {
        await prisma.smsGateway.delete({ where: { id: req.params.id } });
        res.json({ message: "Deleted successfully" });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// POST /api/admin/sms-gateways/:id/test
router.post('/:id/test', async (req, res) => {
    const { id } = req.params;
    const { testPhone } = req.body;

    if (!testPhone) return res.status(400).json({ error: "Test phone number is required" });

    try {
        const result = await SmsGatewayService.testGateway(id, testPhone);
        res.json({ message: "Test SMS sent successfully!", details: result });
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
});

module.exports = router;
