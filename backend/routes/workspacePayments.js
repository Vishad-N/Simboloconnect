const express = require('express');
const router = express.Router();
const prisma = require('../prismaClient');
const { encrypt, decrypt } = require('../utils/encryption');
const { authenticate } = require('../middleware/auth');
const redis = require('../services/redisConnection');
const { logAudit } = require('../middleware/auditTrail');

// GET /api/workspace/payments/settings
router.get('/settings', authenticate, async (req, res) => {
    try {
        const userId = req.user.id;
        const key = `payment_settings_${userId}`;
        const setting = await prisma.systemSetting.findUnique({
            where: { key }
        });

        const defaultSettings = {
            currency: 'INR',
            taxRate: '18',
            shippingAmt: '0',
            codEnabled: false,
            invoicePrefix: 'INV-',
            invoiceTerms: 'Thank you for your business!',
            autoGenerateInvoice: true,
            version: 1
        };

        if (!setting) {
            return res.json({ success: true, settings: defaultSettings });
        }

        try {
            const parsed = JSON.parse(setting.value);
            return res.json({ success: true, settings: { ...defaultSettings, ...parsed } });
        } catch (e) {
            return res.json({ success: true, settings: defaultSettings });
        }
    } catch (error) {
        console.error("[WorkspacePayments] GET settings error:", error);
        res.status(500).json({ error: "Failed to fetch settings" });
    }
});

// POST /api/workspace/payments/settings
router.post('/settings', authenticate, async (req, res) => {
    try {
        const userId = req.user.id;
        const key = `payment_settings_${userId}`;
        const { currency, taxRate, shippingAmt, codEnabled, invoicePrefix, invoiceTerms, autoGenerateInvoice, version } = req.body;

        const settingsValue = JSON.stringify({
            currency: currency || 'INR',
            taxRate: taxRate !== undefined ? String(taxRate) : '18',
            shippingAmt: shippingAmt !== undefined ? String(shippingAmt) : '0',
            codEnabled: !!codEnabled,
            invoicePrefix: invoicePrefix || 'INV-',
            invoiceTerms: invoiceTerms || '',
            autoGenerateInvoice: autoGenerateInvoice !== undefined ? !!autoGenerateInvoice : true,
            version: version || 1
        });

        await prisma.systemSetting.upsert({
            where: { key },
            update: { value: settingsValue },
            create: { key, value: settingsValue }
        });

        // Safe Audit Log
        await logAudit({
            userId,
            actor: 'api',
            action: 'payment_settings_saved',
            entityType: 'User',
            entityId: userId,
            metadata: { currency, taxRate, shippingAmt }
        });

        res.json({ success: true, message: "Payment settings saved successfully!" });
    } catch (error) {
        console.error("[WorkspacePayments] POST settings error:", error);
        res.status(500).json({ error: "Failed to save settings" });
    }
});

// GET /api/workspace/payments/gateways
router.get('/gateways', authenticate, async (req, res) => {
    try {
        const gateways = await prisma.paymentGateway.findMany({
            where: { userId: req.user.id },
            orderBy: { priority: 'asc' }
        });

        const sanitizedGateways = gateways.map(g => {
            let maskedConfig = {};
            try {
                const decrypted = JSON.parse(decrypt(g.encryptedConfig));
                Object.keys(decrypted).forEach(k => {
                    const val = decrypted[k] || '';
                    if (val.length > 8) {
                        maskedConfig[k] = val.slice(0, 4) + '••••••••' + val.slice(-4);
                    } else if (val) {
                        maskedConfig[k] = '••••••••';
                    }
                });
            } catch (err) {
                console.error("Failed to decrypt gateway config for masking", err);
            }
            return {
                id: g.id,
                provider: g.provider,
                label: g.label,
                mode: g.mode,
                isActive: g.isActive,
                priority: g.priority,
                successCount: g.successCount,
                failureCount: g.failureCount,
                config: maskedConfig
            };
        });

        res.json({ success: true, gateways: sanitizedGateways });
    } catch (error) {
        console.error("[WorkspacePayments] GET gateways error:", error);
        res.status(500).json({ error: "Failed to fetch gateways" });
    }
});

// POST /api/workspace/payments/gateways
router.post('/gateways', authenticate, async (req, res) => {
    try {
        const { provider, label, mode, priority, isActive, config } = req.body;
        const targetPriority = Number(priority) || 1;

        // Atomically enforce unique priority shift per workspace
        await prisma.$transaction(async (tx) => {
            const duplicate = await tx.paymentGateway.findFirst({
                where: { userId: req.user.id, priority: targetPriority }
            });
            if (duplicate) {
                await tx.paymentGateway.updateMany({
                    where: { userId: req.user.id, priority: { gte: targetPriority } },
                    data: { priority: { increment: 1 } }
                });
            }
        });

        const encryptedConfig = encrypt(JSON.stringify(config || {}));

        const gateway = await prisma.paymentGateway.create({
            data: {
                userId: req.user.id,
                provider,
                label: label || 'Primary',
                encryptedConfig,
                mode: mode || 'test',
                priority: targetPriority,
                isActive: isActive !== undefined ? isActive : true
            }
        });

        // Audit log without raw credentials
        await logAudit({
            userId: req.user.id,
            actor: 'api',
            action: 'payment_gateway_created',
            entityType: 'PaymentGateway',
            entityId: gateway.id,
            metadata: { provider, label, mode, priority: targetPriority }
        });

        res.json({ success: true, gateway: { id: gateway.id, provider, label, mode, priority: targetPriority, isActive } });
    } catch (error) {
        console.error("[WorkspacePayments] POST gateways error:", error);
        res.status(500).json({ error: "Failed to create gateway" });
    }
});

// PATCH /api/workspace/payments/gateways/:id
router.patch('/gateways/:id', authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const { isActive, priority, label, mode, config } = req.body;

        const current = await prisma.paymentGateway.findFirst({
            where: { id, userId: req.user.id }
        });

        if (!current) {
            return res.status(404).json({ error: "Gateway not found" });
        }

        let encryptedConfig = current.encryptedConfig;
        if (config && Object.keys(config).length > 0) {
            let existingConfig = {};
            try {
                existingConfig = JSON.parse(decrypt(current.encryptedConfig));
            } catch (e) {}

            const mergedConfig = { ...existingConfig };
            Object.keys(config).forEach(key => {
                const newVal = config[key];
                // Keep existing secret if unchanged or filled with placeholder dots
                if (newVal && !newVal.includes('••••')) {
                    mergedConfig[key] = newVal;
                }
            });
            encryptedConfig = encrypt(JSON.stringify(mergedConfig));
        }

        const targetPriority = priority !== undefined ? Number(priority) : current.priority;

        if (priority !== undefined && Number(priority) !== current.priority) {
            await prisma.$transaction(async (tx) => {
                const duplicate = await tx.paymentGateway.findFirst({
                    where: { userId: req.user.id, priority: targetPriority, NOT: { id } }
                });
                if (duplicate) {
                    await tx.paymentGateway.updateMany({
                        where: { userId: req.user.id, priority: { gte: targetPriority }, NOT: { id } },
                        data: { priority: { increment: 1 } }
                    });
                }
            });
        }

        const updated = await prisma.paymentGateway.update({
            where: { id },
            data: {
                ...(isActive !== undefined && { isActive }),
                ...(priority !== undefined && { priority: targetPriority }),
                ...(label !== undefined && { label }),
                ...(mode !== undefined && { mode }),
                encryptedConfig
            }
        });

        await logAudit({
            userId: req.user.id,
            actor: 'api',
            action: 'payment_gateway_updated',
            entityType: 'PaymentGateway',
            entityId: id,
            metadata: { provider: current.provider, isActive, priority: targetPriority }
        });

        res.json({ success: true, gateway: { id, isActive: updated.isActive, priority: updated.priority, label: updated.label } });
    } catch (error) {
        console.error("[WorkspacePayments] PATCH gateways error:", error);
        res.status(500).json({ error: "Failed to update gateway" });
    }
});

// DELETE /api/workspace/payments/gateways/:id
router.delete('/gateways/:id', authenticate, async (req, res) => {
    try {
        const { id } = req.params;

        const current = await prisma.paymentGateway.findFirst({
            where: { id, userId: req.user.id }
        });

        if (!current) {
            return res.status(404).json({ error: "Gateway not found" });
        }

        await prisma.paymentGateway.delete({
            where: { id }
        });

        await logAudit({
            userId: req.user.id,
            actor: 'api',
            action: 'payment_gateway_deleted',
            entityType: 'PaymentGateway',
            entityId: id,
            metadata: { provider: current.provider, label: current.label }
        });

        res.json({ success: true, message: "Gateway deleted successfully" });
    } catch (error) {
        console.error("[WorkspacePayments] DELETE gateways error:", error);
        res.status(500).json({ error: "Failed to delete gateway" });
    }
});

// GET /api/workspace/payments/analytics
router.get('/analytics', authenticate, async (req, res) => {
    try {
        const userId = req.user.id;
        const cacheKey = `payment_analytics:${userId}`;

        // Non-blocking cache read
        const cached = await redis.get(cacheKey).catch(() => null);
        if (cached) {
            return res.json({ success: true, analytics: JSON.parse(cached), source: 'cache' });
        }

        // Fetch gateways
        const gateways = await prisma.paymentGateway.findMany({
            where: { userId }
        });

        let totalSuccess = 0;
        let totalFailure = 0;
        gateways.forEach(g => {
            totalSuccess += g.successCount || 0;
            totalFailure += g.failureCount || 0;
        });

        const totalAttempts = totalSuccess + totalFailure;
        const successRate = totalAttempts > 0 ? Math.round((totalSuccess / totalAttempts) * 100) : 100;

        // Perform fast selective queries for checkout sessions
        const paidSessions = await prisma.checkoutSession.findMany({
            where: { userId, status: 'paid' },
            select: { amount: true }
        });

        const totalRevenue = paidSessions.reduce((acc, s) => acc + Number(s.amount || 0), 0);

        const analytics = {
            successRate,
            successCount: totalSuccess,
            failureCount: totalFailure,
            totalRevenue,
            gatewayHealth: gateways.map(g => ({
                id: g.id,
                provider: g.provider,
                label: g.label,
                isActive: g.isActive,
                health: g.isActive ? 'Operational' : 'Disabled',
                successCount: g.successCount,
                failureCount: g.failureCount
            }))
        };

        // Cache for 5 minutes with fallback protection
        await redis.set(cacheKey, JSON.stringify(analytics), 'EX', 300).catch(() => null);

        res.json({ success: true, analytics, source: 'db' });
    } catch (error) {
        console.error("[WorkspacePayments] GET analytics error:", error);
        res.status(500).json({ error: "Failed to fetch analytics" });
    }
});

// LEGACY GET /api/workspace/payments/credentials (maintained for backward compatibility)
router.get('/credentials', authenticate, async (req, res) => {
    try {
        const credential = await prisma.paymentCredential.findUnique({
            where: { userId: req.user.id }
        });

        if (!credential) {
            return res.json({ exists: false });
        }

        return res.json({
            exists: true,
            provider: credential.provider,
            mode: credential.mode,
            keyIdMasked: "••••••••" + decrypt(credential.encryptedKeyId).slice(-4),
            webhookSecretMasked: credential.webhookSecret ? "••••••••" + credential.webhookSecret.slice(-4) : null
        });
    } catch (error) {
        console.error("[WorkspacePayments] GET credentials error:", error);
        res.status(500).json({ error: "Failed to fetch credentials" });
    }
});

// LEGACY POST /api/workspace/payments/credentials (maintained for backward compatibility)
router.post('/credentials', authenticate, async (req, res) => {
    try {
        const { keyId, keySecret, webhookSecret, mode } = req.body;

        if (!keyId || !keySecret) {
            return res.status(400).json({ error: "keyId and keySecret are required" });
        }

        const encryptedKeyId = encrypt(keyId);
        const encryptedSecret = encrypt(keySecret);

        await prisma.paymentCredential.upsert({
            where: { userId: req.user.id },
            update: {
                encryptedKeyId,
                encryptedSecret,
                webhookSecret: webhookSecret || null,
                mode: mode || "live"
            },
            create: {
                userId: req.user.id,
                encryptedKeyId,
                encryptedSecret,
                webhookSecret: webhookSecret || null,
                mode: mode || "live"
            }
        });

        res.json({ success: true, message: "Credentials saved securely" });
    } catch (error) {
        console.error("[WorkspacePayments] POST credentials error:", error);
        res.status(500).json({ error: "Failed to save credentials" });
    }
});

// LEGACY DELETE /api/workspace/payments/credentials (maintained for backward compatibility)
router.delete('/credentials', authenticate, async (req, res) => {
    try {
        await prisma.paymentCredential.delete({
            where: { userId: req.user.id }
        });
        res.json({ success: true });
    } catch (error) {
        if (error.code === 'P2025') return res.json({ success: true });
        console.error("[WorkspacePayments] DELETE credentials error:", error);
        res.status(500).json({ error: "Failed to delete credentials" });
    }
});

module.exports = router;
