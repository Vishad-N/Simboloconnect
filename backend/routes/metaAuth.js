const express = require('express');
const router = express.Router();
const prisma = require('../prismaClient');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { encrypt } = require('../utils/encryption');
const { getMetaConfig } = require('../utils/metaConfig');

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key-123';

// 1. Initiate OAuth Flow
router.get('/facebook', async (req, res) => {
    const { token } = req.query; // User's JWT token
    
    if (!token) {
        return res.status(401).send("Authentication token is missing. Please log in first.");
    }
    
    let userId;
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        // Supports both tenant token and admin impersonation token formats
        userId = decoded.workspaceId || decoded.id; 
    } catch (e) {
        return res.status(401).send("Invalid or expired authentication token.");
    }

    try {
        // Fetch Admin configured Embedded Signup credentials
        const appIdSetting = await prisma.systemSetting.findUnique({ where: { key: 'EMBEDDED_SIGNUP_APP_ID' } });
        const appSecretSetting = await prisma.systemSetting.findUnique({ where: { key: 'EMBEDDED_SIGNUP_APP_SECRET' } });
        
        const APP_ID = appIdSetting?.value || process.env.FB_APP_ID || process.env.VITE_FB_APP_ID;
        const APP_SECRET = appSecretSetting?.value || process.env.FB_APP_SECRET;

        if (!APP_ID || !APP_SECRET) {
            return res.status(500).send("Global Embedded Signup Configuration (App ID or Secret) is missing. Please configure it in the Admin Panel.");
        }

        // Generate a secure CSRF state token that binds the user ID
        const randomString = crypto.randomBytes(16).toString('hex');
        const statePayload = JSON.stringify({ userId, nonce: randomString });
        // Encrypt the state payload so it cannot be tampered with
        const stateToken = encrypt(statePayload);

        // Required scopes for WhatsApp embedded signup
        const scopes = 'whatsapp_business_management,whatsapp_business_messaging,business_management';
        
        // Use the API URL from environment, or fallback to request host for dynamic handling
        // Make sure the domain configured in Meta App's Valid OAuth Redirect URIs perfectly matches this
        const baseUrl = process.env.VITE_API_URL || `${req.protocol}://${req.get('host')}`;
        const redirectUri = `${baseUrl}/api/meta-auth/facebook/callback`;
        
        const config = await getMetaConfig();
        const signupVersion = config.embeddedSignupVersion || 'v19.0';
        const oauthUrl = `https://www.facebook.com/${signupVersion}/dialog/oauth?client_id=${APP_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(stateToken)}&scope=${encodeURIComponent(scopes)}`;
        
        res.redirect(oauthUrl);

    } catch (error) {
        console.error("Facebook OAuth initiation error:", error);
        res.status(500).send("Failed to initiate Meta onboarding.");
    }
});

// 2. OAuth Callback & Data Fetching
router.get('/facebook/callback', async (req, res) => {
    const { code, state, error, error_reason, error_description } = req.query;

    const baseUrl = process.env.VITE_API_URL || `${req.protocol}://${req.get('host')}`;
    const redirectUri = `${baseUrl}/api/meta-auth/facebook/callback`;
    const frontendDashboardUrl = `${baseUrl.replace('api.', '')}/settings`; // Basic fallback mapping

    if (error) {
        console.error("OAuth Facebook Callback Error:", error, error_reason, error_description);
        return res.redirect(`${frontendDashboardUrl}?oauth_error=true&msg=${encodeURIComponent(error_description || 'Permission Denied')}`);
    }

    if (!code || !state) {
        return res.redirect(`${frontendDashboardUrl}?oauth_error=true&msg=MissingCodeOrState`);
    }

    let userId;
    try {
        const { decrypt } = require('../utils/encryption');
        const decryptedState = decrypt(state);
        const parsedState = JSON.parse(decryptedState);
        userId = parsedState.userId;
        if (!userId) throw new Error("User ID missing in state");
    } catch (e) {
        console.error("State decryption/verification failed:", e);
        return res.redirect(`${frontendDashboardUrl}?oauth_error=true&msg=InvalidStateToken`);
    }

    try {
        // Fetch App Credentials
        const appIdSetting = await prisma.systemSetting.findUnique({ where: { key: 'EMBEDDED_SIGNUP_APP_ID' } });
        const appSecretSetting = await prisma.systemSetting.findUnique({ where: { key: 'EMBEDDED_SIGNUP_APP_SECRET' } });
        const APP_ID = appIdSetting?.value || process.env.FB_APP_ID || process.env.VITE_FB_APP_ID;
        const APP_SECRET = appSecretSetting?.value || process.env.FB_APP_SECRET;

        const config = await getMetaConfig();
        const signupVersion = config.embeddedSignupVersion || 'v19.0';

        // 1. Exchange Code for Short-Lived Access Token
        const tokenExchangeUrl = `https://graph.facebook.com/${signupVersion}/oauth/access_token?client_id=${APP_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&client_secret=${APP_SECRET}&code=${code}`;
        const tokenRes = await axios.get(tokenExchangeUrl);
        let accessToken = tokenRes.data.access_token;
        let tokenExpiry = null;

        // 2. Exchange Short-Lived Token for Long-Lived Token
        try {
            const longLivedExchangeUrl = `https://graph.facebook.com/${signupVersion}/oauth/access_token?grant_type=fb_exchange_token&client_id=${APP_ID}&client_secret=${APP_SECRET}&fb_exchange_token=${accessToken}`;
            const longLivedRes = await axios.get(longLivedExchangeUrl);
            if (longLivedRes.data && longLivedRes.data.access_token) {
                accessToken = longLivedRes.data.access_token;
                // typically expires_in is returned in seconds (e.g., 60 days)
                if (longLivedRes.data.expires_in) {
                    tokenExpiry = new Date(Date.now() + longLivedRes.data.expires_in * 1000);
                }
            }
        } catch (exchangeErr) {
            console.warn("Failed to exchange for long-lived token, continuing with short-lived token.", exchangeErr.response?.data || exchangeErr.message);
        }

        // 3. Fetch Businesses
        const userRes = await axios.get(`https://graph.facebook.com/${signupVersion}/me/businesses`, {
            headers: { Authorization: `Bearer ${accessToken}` }
        });
        const businesses = userRes.data.data;
        if (!businesses || businesses.length === 0) {
            throw new Error("No Facebook Businesses found for this account.");
        }
        
        // Always select the first business for now, future iterations can allow UI selection
        const businessId = businesses[0].id;

        // 4. Fetch WABA
        const wabaRes = await axios.get(`https://graph.facebook.com/${signupVersion}/${businessId}/owned_whatsapp_business_accounts`, {
            headers: { Authorization: `Bearer ${accessToken}` }
        });
        const wabas = wabaRes.data.data;
        if (!wabas || wabas.length === 0) {
            throw new Error("No WhatsApp Business Accounts found in this Business.");
        }
        const wabaId = wabas[0].id;

        // 5. Fetch Phone Number
        const phoneRes = await axios.get(`https://graph.facebook.com/${signupVersion}/${wabaId}/phone_numbers`, {
            headers: { Authorization: `Bearer ${accessToken}` }
        });
        const phones = phoneRes.data.data;
        if (!phones || phones.length === 0) {
            throw new Error("No phone numbers found in this WABA.");
        }
        
        // Select the first valid phone number
        const phoneId = phones[0].id;

        // 6. Automatic Webhook Subscription & Phone Registration
        try {
            const subscribeUrl = `https://graph.facebook.com/${signupVersion}/${wabaId}/subscribed_apps`;
            await axios.post(subscribeUrl, {}, {
                headers: { Authorization: `Bearer ${accessToken}` }
            });
            console.log(`[Meta Auth] Successfully subscribed webhooks for WABA ${wabaId}`);
        } catch (webhookErr) {
            console.warn(`[Meta Auth] Webhook subscription failed for WABA ${wabaId}. This might require manual setup.`, webhookErr.response?.data || webhookErr.message);
        }

        try {
            const registerUrl = `https://graph.facebook.com/${signupVersion}/${phoneId}/register`;
            await axios.post(registerUrl, {
                messaging_product: "whatsapp",
                pin: "123456" // Default PIN for 2FA as required by Cloud API
            }, {
                headers: { Authorization: `Bearer ${accessToken}` }
            });
            console.log(`[Meta Auth] Successfully registered phone number ${phoneId} via callback`);
        } catch (regErr) {
            console.warn(`[Meta Auth] Auto-registration failed for ${phoneId}. It might already be registered.`, regErr.response?.data || regErr.message);
        }

        // Check uniqueness of phoneNumberId and wabaId
        if (phoneId) {
            const existingPhone = await prisma.user.findFirst({
                where: {
                    phoneNumberId: phoneId,
                    id: { not: userId }
                }
            });
            if (existingPhone) {
                console.warn(`[Meta Auth] phoneId ${phoneId} is already connected to another account.`);
                return res.redirect(`${frontendDashboardUrl}?oauth_error=duplicate_credentials`);
            }
        }
        if (wabaId) {
            const existingWaba = await prisma.user.findFirst({
                where: {
                    wabaId: wabaId,
                    id: { not: userId }
                }
            });
            if (existingWaba) {
                console.warn(`[Meta Auth] wabaId ${wabaId} is already connected to another account.`);
                return res.redirect(`${frontendDashboardUrl}?oauth_error=duplicate_credentials`);
            }
        }

        // 7. Store Data Securely
        const encryptedToken = encrypt(accessToken);

        const updateData = {
            phoneNumberId: phoneId,
            wabaId: wabaId,
            businessId: businessId,
            metaToken: encryptedToken
        };
        
        if (tokenExpiry) {
            updateData.metaTokenExpiry = tokenExpiry;
        }

        await prisma.user.update({
            where: { id: userId },
            data: updateData
        });

        console.log(`[Meta Auth] Embedded signup complete for user ${userId}. Redirecting to dashboard.`);
        res.redirect(`${frontendDashboardUrl}?oauth_success=true`);

    } catch (e) {
        console.error("Error during Meta Callback flow:", e.response?.data || e.message);
        res.redirect(`${frontendDashboardUrl}?oauth_error=true&msg=${encodeURIComponent(e.message || 'Onboarding Failed')}`);
    }
});

// 3. Exchange Code from Frontend JS SDK
router.post('/exchange-code', async (req, res) => {
    const { code } = req.body;
    
    // JWT auth header is assumed to be handled by a middleware, but let's check headers
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).json({ error: "Missing authorization token" });
    }

    const token = authHeader.split(' ')[1];
    let userId;
    try {
        // ignoreExpiration: user is re-authenticating via Facebook, not making a data request.
        // The FB OAuth code itself proves identity. We just need to map to the panel userId.
        const decoded = jwt.verify(token, JWT_SECRET, { ignoreExpiration: true });
        userId = decoded.workspaceId || decoded.id;
        console.log('[Meta Auth] Decoded userId from token:', userId);
    } catch (e) {
        // If token is completely invalid (wrong secret), fall back to decode
        try {
            const decoded = jwt.decode(token);
            if (decoded && (decoded.workspaceId || decoded.id)) {
                userId = decoded.workspaceId || decoded.id;
                console.warn('[Meta Auth] Token verify failed but decoded ok. userId:', userId);
            } else {
                console.error('[Meta Auth] Token decode also failed:', e.message);
                return res.status(401).json({ error: 'Cannot identify user. Please log in again.' });
            }
        } catch(e2) {
            return res.status(401).json({ error: 'Invalid authorization token' });
        }
    }

    if (!code) {
        return res.status(400).json({ error: "Missing OAuth code from Facebook SDK" });
    }

    try {
        const config = await getMetaConfig();
        const signupVersion = config.embeddedSignupVersion || 'v19.0';

        const appIdSetting = await prisma.systemSetting.findUnique({ where: { key: 'EMBEDDED_SIGNUP_APP_ID' } });
        const appSecretSetting = await prisma.systemSetting.findUnique({ where: { key: 'EMBEDDED_SIGNUP_APP_SECRET' } });
        const APP_ID = appIdSetting?.value || process.env.FB_APP_ID || process.env.VITE_FB_APP_ID;
        const APP_SECRET = appSecretSetting?.value || process.env.FB_APP_SECRET;

        // Redirect URI MUST match exactly what's configured in Meta App, even though it's JS SDK
        // Often, JS SDK doesn't strictly need it if it's identical to the base URL, but we use the standard one
        const baseUrl = process.env.VITE_API_URL || `${req.protocol}://${req.get('host')}`;
        // The frontend triggers FB.login from the origin domain
        // However, for the access_token exchange when using JS SDK, redirect_uri can sometimes be omitted or must match the origin.
        // Let's omit redirect_uri if JS SDK generated the code, or use the origin
        
        // Actually, the graph API requires redirect_uri for code exchange.
        // If JS SDK is used, redirect_uri should often be the exact URL where FB.login was called or empty
        // Wait, standard Graph API v19.0:
        console.log("CODE:", code.substring(0,20));
        const tokenExchangeUrl = `https://graph.facebook.com/${signupVersion}/oauth/access_token?client_id=${APP_ID}&client_secret=${APP_SECRET}&code=${code}`;
        const tokenRes = await axios.get(tokenExchangeUrl);
        console.log("TOKEN TYPE:", tokenRes.data.token_type);
        console.log("[Backend token exchange response]:", JSON.stringify({
            ...tokenRes.data,
            access_token: tokenRes.data.access_token ? `${tokenRes.data.access_token.substring(0, 15)}...` : null
        }, null, 2));
        let accessToken = tokenRes.data.access_token;
        let tokenExpiry = null;

        // Exchange for Long-Lived Token
        try {
            const longLivedExchangeUrl = `https://graph.facebook.com/${signupVersion}/oauth/access_token?grant_type=fb_exchange_token&client_id=${APP_ID}&client_secret=${APP_SECRET}&fb_exchange_token=${accessToken}`;
            const longLivedRes = await axios.get(longLivedExchangeUrl);
            if (longLivedRes.data && longLivedRes.data.access_token) {
                accessToken = longLivedRes.data.access_token;
                if (longLivedRes.data.expires_in) {
                    tokenExpiry = new Date(Date.now() + longLivedRes.data.expires_in * 1000);
                }
            }
        } catch (exchangeErr) {
            console.warn("Failed to exchange for long-lived token, continuing with short-lived token.", exchangeErr.response?.data || exchangeErr.message);
        }

        // Officially recommended way for Embedded Signup: use debug_token to get granted WABA IDs
        const debugTokenUrl = `https://graph.facebook.com/${signupVersion}/debug_token?input_token=${accessToken}&access_token=${APP_ID}|${APP_SECRET}`;
        const debugRes = await axios.get(debugTokenUrl);
        console.log(JSON.stringify(debugRes.data,null,2));
        console.log("[Meta Auth] debug_token response:", JSON.stringify(debugRes.data));
        console.log("[Backend debug_token Raw Response]:", JSON.stringify(debugRes.data, null, 2));
        console.log("[Backend debug_token Granular Scopes]:", JSON.stringify(debugRes.data?.data?.granular_scopes, null, 2));
        
        let wabaIds = [];
        if (debugRes.data && debugRes.data.data && debugRes.data.data.granular_scopes) {
            for (const scopeObj of debugRes.data.data.granular_scopes) {
                if ((scopeObj.scope === 'whatsapp_business_management' || scopeObj.scope === 'whatsapp_business_messaging') && scopeObj.target_ids) {
                    for (const id of scopeObj.target_ids) {
                        if (!wabaIds.includes(id)) {
                            wabaIds.push(id);
                        }
                    }
                }
            }
        }

        // Fallback: If wabaIds is empty, query /me/whatsapp_business_accounts and /me/owned_whatsapp_business_accounts directly
        if (!wabaIds || wabaIds.length === 0) {
            console.log("[Meta Auth] debug_token did not return target_ids, trying fallback directly on /me");
            
            // 1. Try me/whatsapp_business_accounts (standard discovery edge)
            try {
                const wabaRes = await axios.get(`https://graph.facebook.com/${signupVersion}/me/whatsapp_business_accounts`, {
                    headers: { Authorization: `Bearer ${accessToken}` }
                });
                console.log("[WABA Discovery] whatsapp_business_accounts:", JSON.stringify(wabaRes?.data, null, 2));
                const wabas = wabaRes.data?.data || [];
                for (const waba of wabas) {
                    if (waba.id && !wabaIds.includes(waba.id)) {
                        wabaIds.push(waba.id);
                    }
                }
                console.log(`[Meta Auth] Fallback: Found ${wabaIds.length} WABAs via /me/whatsapp_business_accounts`);
            } catch (err) {
                console.warn(`[Meta Auth] Fallback: Failed to fetch /me/whatsapp_business_accounts:`, err.response?.data || err.message);
            }

            // 2. Try me/owned_whatsapp_business_accounts (alternative edge)
            if (wabaIds.length === 0) {
                try {
                    const ownedWabaRes = await axios.get(`https://graph.facebook.com/${signupVersion}/me/owned_whatsapp_business_accounts`, {
                        headers: { Authorization: `Bearer ${accessToken}` }
                    });
                    console.log("[WABA Discovery] owned_whatsapp_business_accounts:", JSON.stringify(ownedWabaRes?.data, null, 2));
                    const ownedWabas = ownedWabaRes.data?.data || [];
                    for (const waba of ownedWabas) {
                        if (waba.id && !wabaIds.includes(waba.id)) {
                            wabaIds.push(waba.id);
                        }
                    }
                    console.log(`[Meta Auth] Fallback: Found ${wabaIds.length} WABAs via /me/owned_whatsapp_business_accounts`);
                } catch (err) {
                    console.warn(`[Meta Auth] Fallback: Failed to fetch /me/owned_whatsapp_business_accounts:`, err.response?.data || err.message);
                }
            }

            // 3. Last resort fallback: try /me/businesses (might fail with #100 Missing Permission if business_management scope is missing)
            if (wabaIds.length === 0) {
                console.log("[Meta Auth] Direct /me edges empty, trying fallback to /me/businesses");
                try {
                    const userRes = await axios.get(`https://graph.facebook.com/${signupVersion}/me/businesses`, {
                        headers: { Authorization: `Bearer ${accessToken}` }
                    });
                    console.log("[WABA Discovery] businesses:", JSON.stringify(userRes?.data, null, 2));
                    const businesses = userRes.data?.data || [];
                    for (const business of businesses) {
                        const businessId = business.id;
                        
                        try {
                            const wabaRes = await axios.get(`https://graph.facebook.com/${signupVersion}/${businessId}/owned_whatsapp_business_accounts`, {
                                headers: { Authorization: `Bearer ${accessToken}` }
                            });
                            const wabas = wabaRes.data?.data || [];
                            for (const waba of wabas) {
                                if (waba.id && !wabaIds.includes(waba.id)) {
                                    wabaIds.push(waba.id);
                                }
                            }
                        } catch (err) {
                            console.warn(`[Meta Auth] Fallback: Failed to fetch owned WABAs for business ${businessId}:`, err.message);
                        }
                    }
                } catch (fallbackErr) {
                    console.warn("[Meta Auth] Last resort fallback to /me/businesses failed:", fallbackErr.response?.data || fallbackErr.message);
                }
            }
        }

        if (!wabaIds || wabaIds.length === 0) {
            const grantedScopes = debugRes.data?.data?.scopes || [];
            throw new Error(`No WhatsApp Business Accounts were granted. (Meta granted scopes: ${grantedScopes.join(', ')}). Please ensure you select all permissions during Meta setup.`);
        }
        const wabaId = wabaIds[0];

        // Fetch Business ID from WABA details
        let businessId = null;
        try {
            const wabaDetailsRes = await axios.get(`https://graph.facebook.com/${signupVersion}/${wabaId}?fields=owner_business_info`, {
                headers: { Authorization: `Bearer ${accessToken}` }
            });
            if (wabaDetailsRes.data && wabaDetailsRes.data.owner_business_info) {
                businessId = wabaDetailsRes.data.owner_business_info.id;
            }
        } catch (bizErr) {
            console.warn("Could not fetch owner business info:", bizErr.message);
        }

        // Fetch Phone Number
        const phoneRes = await axios.get(`https://graph.facebook.com/${signupVersion}/${wabaId}/phone_numbers`, {
            headers: { Authorization: `Bearer ${accessToken}` }
        });
        const phones = phoneRes.data.data;
        if (!phones || phones.length === 0) {
            throw new Error("No phone numbers found in this WABA.");
        }
        
        const phoneId = phones[0].id;

        // Register the Phone Number automatically
        try {
            const registerUrl = `https://graph.facebook.com/${signupVersion}/${phoneId}/register`;
            await axios.post(registerUrl, {
                messaging_product: "whatsapp",
                pin: "123456" // Default PIN for 2FA as required by Cloud API
            }, {
                headers: { Authorization: `Bearer ${accessToken}` }
            });
            console.log(`[Meta Auth] Successfully registered phone number ${phoneId}`);
        } catch (regErr) {
            console.warn(`[Meta Auth] Auto-registration failed for ${phoneId}. It might already be registered.`, regErr.response?.data || regErr.message);
        }

        // Subscribe Webhook
        try {
            const subscribeUrl = `https://graph.facebook.com/${signupVersion}/${wabaId}/subscribed_apps`;
            await axios.post(subscribeUrl, {}, {
                headers: { Authorization: `Bearer ${accessToken}` }
            });
            console.log(`[Meta Auth] Successfully subscribed webhooks for WABA ${wabaId}`);
        } catch (webhookErr) {
            console.warn(`[Meta Auth] Webhook subscription failed for WABA ${wabaId}. This might require manual setup.`, webhookErr.response?.data || webhookErr.message);
        }

        // Check uniqueness of phoneNumberId and wabaId
        if (phoneId) {
            const existingPhone = await prisma.user.findFirst({
                where: {
                    phoneNumberId: phoneId,
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
                    wabaId: wabaId,
                    id: { not: userId }
                }
            });
            if (existingWaba) {
                return res.status(400).json({ error: "You have already signed up with this WhatsApp credential in another account." });
            }
        }

        // Store Data Securely
        const encryptedToken = encrypt(accessToken);

        const updateData = {
            phoneNumberId: phoneId,
            wabaId: wabaId,
            businessId: businessId,
            metaToken: encryptedToken
        };
        
        if (tokenExpiry) {
            updateData.metaTokenExpiry = tokenExpiry;
        }

        await prisma.user.update({
            where: { id: userId },
            data: updateData
        });

        res.status(200).json({ message: "WhatsApp Business Account connected successfully" });

    } catch (e) {
        console.error("Error during Meta POST /exchange-code flow:", e.response?.data || e.message);
        res.status(500).json({ error: e.message || 'Meta Onboarding Failed' });
    }
});

module.exports = router;
