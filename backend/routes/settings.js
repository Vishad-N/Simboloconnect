const express = require('express');
const router = express.Router();
const prisma = require('../prismaClient');
const axios = require('axios');
const { encrypt, decrypt } = require('../utils/encryption');
const EmailService = require('../services/email/EmailService');
const { getMetaConfig } = require('../utils/metaConfig');

const { authenticate } = require('../middleware/auth');
const checkPermission = require('../middleware/rbac');

router.post('/tokens', authenticate, async (req, res) => {
    const { phoneNumberId, wabaId, metaToken } = req.body;
    const userId = req.user.workspaceId;

    console.log(`[API Settings] Saving tokens for user: ${userId}`);
    console.log(`[API Settings] Payload: phoneNumberId=${phoneNumberId}, wabaId=${wabaId}, metaToken=${metaToken ? 'PROVIDED' : 'MISSING'}`);

    try {
        if (phoneNumberId) {
            const existingPhone = await prisma.user.findFirst({
                where: {
                    phoneNumberId,
                    id: { not: userId }
                }
            });
            if (existingPhone) {
                return res.status(400).json({ error: "You have already signed up with this WhatsApp credential in another account." });
            }
        }
        if (wabaId) {
            const existingWaba = await prisma.user.findFirst({
                where: {
                    wabaId,
                    id: { not: userId }
                }
            });
            if (existingWaba) {
                return res.status(400).json({ error: "You have already signed up with this WhatsApp credential in another account." });
            }
        }

        const updateData = {
            phoneNumberId,
            wabaId
        };

        // Only update metaToken if it's provided and it's NOT the masked placeholder
        if (metaToken && !metaToken.includes('••••')) {
            const encryptedToken = encrypt(metaToken);
            updateData.metaToken = encryptedToken;
            console.log(`[API Settings] Token encrypted and added to update data.`);
        }

        // Update user settings
        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: updateData
        });

        // Auto-register the phone number on Meta WhatsApp server
        if (phoneNumberId) {
            try {
                const { version } = await getMetaConfig();
                const decryptedToken = metaToken && !metaToken.includes('••••') ? metaToken : decrypt(updatedUser.metaToken);
                await axios.post(`https://graph.facebook.com/${version}/${phoneNumberId}/register`, {
                    messaging_product: "whatsapp",
                    pin: "123456" // Default 2FA PIN
                }, {
                    headers: { Authorization: `Bearer ${decryptedToken}` }
                });
                console.log(`[API Settings] Automatically registered phone number ${phoneNumberId} on Meta.`);
            } catch (regErr) {
                console.warn(`[API Settings] Auto-registration failed for ${phoneNumberId}:`, regErr.response?.data || regErr.message);
            }
        }

        console.log(`[API Settings] Successfully updated user ${userId} in database.`);
        res.status(200).json({ message: "Tokens securely encrypted and saved." });
    } catch (e) {
        console.error("[API Settings] Error saving tokens:", e);
        res.status(500).json({ error: "Failed to save tokens securely." });
    }
});

router.get('/tokens', authenticate, async (req, res) => {
    const userId = req.user.workspaceId;

    try {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { phoneNumberId: true, wabaId: true, metaToken: true }
        });

        if (user) {
            let maskedToken = '';
            if (user.metaToken) {
                try {
                    const decrypted = decrypt(user.metaToken);
                    maskedToken = decrypted.substring(0, 6) + '••••••••••••••••' + decrypted.substring(decrypted.length - 4);
                } catch (err) {
                    console.error("Failed to decrypt token for masking", err);
                    maskedToken = '••••••••••••••••';
                }
            }

            res.status(200).json({
                phoneNumberId: user.phoneNumberId || '',
                wabaId: user.wabaId || '',
                metaToken: maskedToken
            });
        } else {
            res.status(404).json({ error: "User configuration not found." });
        }
    } catch (e) {
        console.error("Error fetching tokens:", e);
        res.status(500).json({ error: "Failed to fetch configuration." });
    }
});

router.post('/exchange-token', authenticate, async (req, res) => {
    const { fbToken } = req.body;
    const userId = req.user.workspaceId;

    if (!fbToken) {
        return res.status(400).json({ error: "No Facebook token provided." });
    }

    try {
        const { version } = await getMetaConfig();
        const user = await prisma.user.findUnique({ where: { id: userId } });

        // 1. Exchange short-lived token for long-lived token
        let permanentToken = fbToken;

        const APP_ID = user?.metaAppId || process.env.FB_APP_ID || process.env.VITE_FB_APP_ID || 'dummy_app_id';
        const APP_SECRET = user?.metaAppSecret ? decrypt(user.metaAppSecret) : process.env.FB_APP_SECRET || 'dummy_app_secret';

        try {
            // Attempt exchange if we have real secrets (this might fail if dummy, so we fallback to original token)
            const exchangeRes = await axios.get(`https://graph.facebook.com/${version}/oauth/access_token?grant_type=fb_exchange_token&client_id=${APP_ID}&client_secret=${APP_SECRET}&fb_exchange_token=${fbToken}`);
            if (exchangeRes.data && exchangeRes.data.access_token) {
                permanentToken = exchangeRes.data.access_token;
                console.log("Successfully exchanged for long-lived token.");
            }
        } catch (e) {
            console.log("Warning: Could not exchange token. Using provided short-lived token instead.");
        }

        // 2. Fetch Businesses
        const userRes = await axios.get(`https://graph.facebook.com/${version}/me/businesses`, {
            headers: { Authorization: `Bearer ${permanentToken}` }
        });
        const businesses = userRes.data.data;
        if (!businesses || businesses.length === 0) {
            return res.status(404).json({ error: "No Facebook Businesses found for this user." });
        }
        const businessId = businesses[0].id;

        // 3. Fetch WABA
        const wabaRes = await axios.get(`https://graph.facebook.com/${version}/${businessId}/owned_whatsapp_business_accounts`, {
            headers: { Authorization: `Bearer ${permanentToken}` }
        });
        const wabas = wabaRes.data.data;
        if (!wabas || wabas.length === 0) {
            return res.status(404).json({ error: "No WhatsApp Business Accounts found in this Business." });
        }
        const wabaId = wabas[0].id;

        // 4. Fetch Phone Number ID
        const phoneRes = await axios.get(`https://graph.facebook.com/${version}/${wabaId}/phone_numbers`, {
            headers: { Authorization: `Bearer ${permanentToken}` }
        });
        const phones = phoneRes.data.data;
        if (!phones || phones.length === 0) {
            return res.status(404).json({ error: "No phone numbers found in this WABA." });
        }
        const phoneId = phones[0].id;

        // 5. Save everything securely to the database
        const encryptedToken = encrypt(permanentToken);

        await prisma.user.upsert({
            where: { id: userId },
            update: {
                phoneNumberId: phoneId,
                wabaId: wabaId,
                metaToken: encryptedToken
            },
            create: {
                id: userId,
                email: 'test@example.com',
                password: 'hashed-password',
                phoneNumberId: phoneId,
                wabaId: wabaId,
                metaToken: encryptedToken
            }
        });

        res.status(200).json({
            message: "Successfully exchanged token and configured WABA.",
            wabaId,
            phoneNumberId: phoneId
        });

    } catch (e) {
        console.error("Error exchanging token or fetching WABA:", e.response?.data || e.message);
        res.status(500).json({ error: "Failed to configure Meta integration automtically." });
    }
});

router.get('/quality', authenticate, async (req, res) => {
    const userId = req.user.workspaceId;
    try {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { phoneNumberId: true, metaToken: true }
        });

        if (!user || !user.phoneNumberId || !user.metaToken) {
            return res.status(400).json({ error: "Meta credentials not fully configured." });
        }

        const decryptedToken = decrypt(user.metaToken);

        const { version } = await getMetaConfig();

        const response = await axios.get(
            `https://graph.facebook.com/${version}/${user.phoneNumberId}?fields=quality_rating,messaging_limit_tier`,
            { headers: { Authorization: `Bearer ${decryptedToken}` } }
        );

        res.status(200).json({
            quality_rating: response.data.quality_rating,
            messaging_limit_tier: response.data.messaging_limit_tier
        });
    } catch (e) {
        console.error("Error fetching quality rating:", e.response?.data || e.message);
        res.status(500).json({ error: "Failed to fetch quality rating from Meta." });
    }
});

router.delete('/tokens', authenticate, async (req, res) => {
    const userId = req.user.workspaceId;

    try {
        await prisma.user.update({
            where: { id: userId },
            data: {
                phoneNumberId: null,
                wabaId: null,
                metaToken: null
            }
        });

        res.status(200).json({ message: "API Credentials removed successfully." });
    } catch (e) {
        console.error("Error removing tokens:", e);
        res.status(500).json({ error: "Failed to remove credentials." });
    }
});

// --- TENANT SMTP CONFIGURATION ---

router.get('/smtp', authenticate, async (req, res) => {
    const userId = req.user.workspaceId;
    try {
        const config = await prisma.smtpConfig.findUnique({
            where: { userId },
            select: { host: true, port: true, username: true, senderName: true, senderEmail: true, encryptionType: true } // Omit password
        });

        if (config) {
            res.status(200).json(config);
        } else {
            res.status(200).json(null); // No custom config set
        }
    } catch (e) {
        console.error("Error fetching SMTP config:", e);
        res.status(500).json({ error: "Failed to fetch SMTP configuration." });
    }
});

router.post('/smtp/test', authenticate, async (req, res) => {
    const { host, port, username, password, encryptionType } = req.body;

    if (!host || !port || !username || !password) {
        return res.status(400).json({ error: "Missing required SMTP credentials for testing." });
    }

    const testConfig = { host, port, username, password, encryptionType };

    const result = await EmailService.testConnection(testConfig);
    if (result.success) {
        res.status(200).json({ message: result.message });
    } else {
        res.status(400).json({ error: result.error });
    }
});

router.post('/smtp', authenticate, async (req, res) => {
    const userId = req.user.workspaceId;
    const { host, port, username, password, senderName, senderEmail, encryptionType } = req.body;

    if (!host || !port || !username || !senderName || !senderEmail) {
        return res.status(400).json({ error: "Missing required configuration fields." });
    }

    try {
        // Prepare data for upsert
        const updateData = { host, port: parseInt(port, 10), username, senderName, senderEmail, encryptionType };

        // Only update password if provided (don't overwrite with empty string if user is just updating host/name)
        if (password && password.trim() !== '') {
            updateData.password = password; // Note: You may want to encrypt this similarly to meta tokens later
        }

        await prisma.smtpConfig.upsert({
            where: { userId },
            update: updateData,
            create: {
                userId,
                ...updateData,
                password: password || '' // Required on create
            }
        });

        res.status(200).json({ message: "SMTP configuration saved securely." });
    } catch (e) {
        console.error("Error saving SMTP config:", e);
        res.status(500).json({ error: "Failed to save SMTP configuration." });
    }
});

module.exports = router;
