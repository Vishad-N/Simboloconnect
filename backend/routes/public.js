const express = require('express');
const router = express.Router();
const prisma = require('../prismaClient');

// Serve Admin Panel Custom CSS
router.get('/css/admin.css', async (req, res) => {
    try {
        const setting = await prisma.systemSetting.findUnique({ where: { key: 'ADMIN_CUSTOM_CSS' } });
        res.setHeader('Content-Type', 'text/css');
        // Prevent browser caching for instant updates
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.send(setting && setting.value ? setting.value : '');
    } catch (e) {
        res.status(500).send('');
    }
});

// Serve User Panel Custom CSS
router.get('/css/user.css', async (req, res) => {
    try {
        const setting = await prisma.systemSetting.findUnique({ where: { key: 'USER_CUSTOM_CSS' } });
        res.setHeader('Content-Type', 'text/css');
        // Prevent browser caching for instant updates
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.send(setting && setting.value ? setting.value : '');
    } catch (e) {
        res.status(500).send('');
    }
});

// Serve Gateway and Config Settings
router.get('/config', async (req, res) => {
    try {
        const settings = await prisma.systemSetting.findMany({
            where: {
                key: { in: ['ACTIVE_PAYMENT_GATEWAY', 'SYSTEM_CURRENCY', 'WALLET_MIN_RECHARGE', 'WALLET_LOW_BALANCE_ALERT', 'EMBEDDED_SIGNUP_ENABLED', 'WALLET_MANAGEMENT_ENABLED'] }
            }
        });
        
        const config = {
            ACTIVE_PAYMENT_GATEWAY: 'RAZORPAY', // Default
            SYSTEM_CURRENCY: 'INR',
            WALLET_MIN_RECHARGE: '100',
            WALLET_LOW_BALANCE_ALERT: '50',
            EMBEDDED_SIGNUP_ENABLED: 'false',
            WALLET_MANAGEMENT_ENABLED: 'false'
        };

        settings.forEach(s => {
            config[s.key] = s.value;
        });

        res.status(200).json(config);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch public config" });
    }
});

module.exports = router;
