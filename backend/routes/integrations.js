const express = require('express');
const router = express.Router();
const prisma = require('../prismaClient');
const { authenticate } = require('../middleware/auth');
const { google } = require('googleapis');
const jwt = require('jsonwebtoken');

// Helper to get exactly the right callback URL automatically based on hostname if not via env
function getCallbackUrl(req) {
    if (process.env.GOOGLE_REDIRECT_URI) return process.env.GOOGLE_REDIRECT_URI;
    const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
    const host = req.headers.host;
    return `${protocol}://${host}/api/integrations/google/callback`;
}

// 1. Get the Auth URL
router.get('/google/authUrl', authenticate, async (req, res) => {
    try {
        const workspaceId = req.user.workspaceId;
        const user = await prisma.user.findUnique({ where: { id: workspaceId } });
        
        if (!user || !user.googleClientId || !user.googleClientSecret) {
            return res.status(400).json({ error: "Missing Google Client ID or Secret. Please save them first." });
        }
        
        const oauth2Client = new google.auth.OAuth2(
            user.googleClientId,
            user.googleClientSecret,
            getCallbackUrl(req)
        );

        // Use a JWT for the state parameter to prevent CSRF and identify the user
        const stateToken = jwt.sign({ workspaceId }, process.env.JWT_SECRET || 'fallback_secret', { expiresIn: '15m' });

        const url = oauth2Client.generateAuthUrl({
            access_type: 'offline', // Required to receive a refresh token
            prompt: 'consent', // Force consent screen so refresh token is always returned
            scope: [
                'https://www.googleapis.com/auth/calendar.readonly',
                'https://www.googleapis.com/auth/calendar.events'
            ],
            state: stateToken
        });

        res.status(200).json({ url });
    } catch (e) {
        console.error("Error generating Google Auth URL:", e);
        res.status(500).json({ error: "Failed to connect to Google." });
    }
});

// 2. OAuth Callback
router.get('/google/callback', async (req, res) => {
    const { code, state, error } = req.query;

    if (error) {
        console.error("Google OAuth Error:", error);
        return res.redirect('/chatbot/settings?error=google_failed');
    }

    try {
        // Verify state token
        const decoded = jwt.verify(state, process.env.JWT_SECRET || 'fallback_secret');
        const workspaceId = decoded.workspaceId;

        const user = await prisma.user.findUnique({ where: { id: workspaceId } });
        if (!user || !user.googleClientId || !user.googleClientSecret) {
            throw new Error("Missing Google Client ID or Secret in backend.");
        }

        const oauth2Client = new google.auth.OAuth2(
            user.googleClientId,
            user.googleClientSecret,
            getCallbackUrl(req)
        );

        // Exchange code for tokens
        const { tokens } = await oauth2Client.getToken(code);
        
        if (tokens.refresh_token) {
            // Save to DB
            await prisma.user.update({
                where: { id: workspaceId },
                data: {
                    googleRefreshToken: tokens.refresh_token,
                    // By default, we'll try to use their primary calendar. They can change it later if we add UI
                    googleCalendarId: 'primary' 
                }
            });
        } else {
            // If they already authorized us previously, they might not get a new refresh token unless prompt=consent is used 
            // (we used prompt=consent, so this shouldn't happen, but just in case)
            console.warn("No refresh token received from Google for user", workspaceId);
        }

        // Redirect back to frontend settings page
        // Use an environment variable for the frontend URL in production
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        res.redirect(`${frontendUrl}/chatbot/settings?success=google_connected`);

    } catch (e) {
        console.error("Google Callback Error:", e);
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        res.redirect(`${frontendUrl}/chatbot/settings?error=google_callback_failed`);
    }
});

// 3. Disconnect Google Calendar
router.post('/google/disconnect', authenticate, async (req, res) => {
    try {
        const workspaceId = req.user.workspaceId;
        
        const user = await prisma.user.findUnique({ where: { id: workspaceId } });
        
        if (user?.googleRefreshToken && user?.googleClientId && user?.googleClientSecret) {
            const oauth2Client = new google.auth.OAuth2(
                user.googleClientId,
                user.googleClientSecret,
                getCallbackUrl(req)
            );
            oauth2Client.setCredentials({ refresh_token: user.googleRefreshToken });
            await oauth2Client.revokeCredentials().catch(() => {}); // Revoke token on Google's side
        }

        await prisma.user.update({
            where: { id: workspaceId },
            data: {
                googleRefreshToken: null,
                googleCalendarId: null
            }
        });

        res.status(200).json({ message: "Google Calendar disconnected." });
    } catch (e) {
        console.error("Error disconnecting Google Calendar:", e);
        res.status(500).json({ error: "Failed to disconnect." });
    }
});

// GET /api/integrations/api-token — Return current API token from DB
router.get('/api-token', authenticate, async (req, res) => {
    try {
        const userId = req.user.workspaceId;
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { apiToken: true }
        });
        res.json({ token: user?.apiToken || null });
    } catch (e) {
        console.error('[Integrations] Error fetching API token:', e);
        res.status(500).json({ error: 'Failed to fetch API token' });
    }
});

// POST /api/integrations/api-token — Generate new token and save to DB
router.post('/api-token/regenerate', authenticate, async (req, res) => {
    try {
        const userId = req.user.workspaceId;
        // Generate a secure random token with sk_live_ prefix
        const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
        let newToken = 'sk_live_';
        for (let i = 0; i < 40; i++) newToken += chars.charAt(Math.floor(Math.random() * chars.length));

        await prisma.user.update({
            where: { id: userId },
            data: { apiToken: newToken }
        });

        console.log(`[Integrations] API token regenerated for user: ${userId}`);
        res.json({ token: newToken, message: 'Token generated successfully' });
    } catch (e) {
        console.error('[Integrations] Error regenerating API token:', e);
        res.status(500).json({ error: 'Failed to regenerate API token' });
    }
});

// GET /api/integrations/webhook - Fetch outbound webhook config
router.get('/webhook', authenticate, async (req, res) => {
    try {
        const userId = req.user.workspaceId;
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                webhookUrl: true,
                webhookEnabled: true
            }
        });
        res.status(200).json({
            url: user?.webhookUrl || '',
            enabled: user?.webhookEnabled || false
        });
    } catch (e) {
        console.error("[Integrations API] Error fetching webhook config:", e);
        res.status(500).json({ error: "Failed to fetch webhook configuration" });
    }
});

// POST /api/integrations/webhook - Update outbound webhook config
router.post('/webhook', authenticate, async (req, res) => {
    const { url, enabled } = req.body;
    const userId = req.user.workspaceId;

    try {
        await prisma.user.update({
            where: { id: userId },
            data: {
                webhookUrl: url,
                webhookEnabled: !!enabled
            }
        });
        res.status(200).json({ message: "Webhook configuration saved successfully" });
    } catch (e) {
        console.error("[Integrations API] Error saving webhook config:", e);
        res.status(500).json({ error: "Failed to save webhook configuration" });
    }
});

module.exports = router;
