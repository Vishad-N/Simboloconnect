const express = require('express');
const router = express.Router();
const prisma = require('../prismaClient');
const axios = require('axios');
const { decrypt } = require('../utils/encryption');
const { authenticate } = require('../middleware/auth');
const { getMetaConfig } = require('../utils/metaConfig');
const { getSystemDefaultAiSettings, generateDefaultSystemPrompt, isPromptAuto } = require('../utils/aiPrompt');

const getCredentials = async (userId) => {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.phoneNumberId || !user.metaToken) {
        throw new Error("Meta credentials not fully configured.");
    }
    return {
        phoneNumberId: user.phoneNumberId,
        token: decrypt(user.metaToken)
    };
};

// GET Profile
router.get('/', authenticate, async (req, res) => {
    try {
        const creds = await getCredentials(req.user.id);
        const { version } = await getMetaConfig();
        const user = await prisma.user.findUnique({ where: { id: req.user.id } });

        // Split into parallel safe requests; Meta throws 131000 if you query profile_picture_url on uninitialized profiles.
        const [textRes, imgRes, phoneRes] = await Promise.allSettled([
            axios.get(
                `https://graph.facebook.com/${version}/${creds.phoneNumberId}/whatsapp_business_profile?fields=about,address,description,email,websites,vertical`,
                { headers: { Authorization: `Bearer ${creds.token}` } }
            ),
            axios.get(
                `https://graph.facebook.com/${version}/${creds.phoneNumberId}/whatsapp_business_profile?fields=profile_picture_url`,
                { headers: { Authorization: `Bearer ${creds.token}` } }
            ),
            axios.get(
                `https://graph.facebook.com/${version}/${creds.phoneNumberId}?fields=display_phone_number,verified_name`,
                { headers: { Authorization: `Bearer ${creds.token}` } }
            )
        ]);

        let profileData = {};
        if (textRes.status === 'fulfilled' && textRes.value.data.data && textRes.value.data.data.length > 0) {
            profileData = { ...textRes.value.data.data[0] };
        }
        
        if (imgRes.status === 'fulfilled' && imgRes.value.data.data && imgRes.value.data.data.length > 0) {
            profileData.profilePicture = imgRes.value.data.data[0].profile_picture_url || '';
        } else if (imgRes.status === 'rejected') {
            console.error("Parallel Image GET Rejected:", imgRes.reason?.response?.data || imgRes.reason?.message);
        }

        // Fallback: If textRes coincidentally contained it, adopt it
        if (!profileData.profilePicture && profileData.profile_picture_url) {
            profileData.profilePicture = profileData.profile_picture_url;
        }

        // Add registered phone details
        let displayPhone = user?.phone || '';
        let verifiedName = user?.name || '';
        if (phoneRes.status === 'fulfilled' && phoneRes.value?.data) {
            if (phoneRes.value.data.display_phone_number) {
                displayPhone = phoneRes.value.data.display_phone_number;
            }
            if (phoneRes.value.data.verified_name) {
                verifiedName = phoneRes.value.data.verified_name;
            }
        }
        profileData.registeredPhone = displayPhone;
        profileData.verifiedName = verifiedName;

        res.status(200).json(profileData);
    } catch (e) {
        console.error("Error fetching profile, suppressing to prevent UI block:", e.response?.data || e.message);
        // Return empty so the user can still access the Profile UI to set values instead of seeing an error forever
        res.status(200).json({});
    }
});

// POST update Profile
router.post('/', authenticate, async (req, res) => {
    try {
        const { about, address, description, email, websites, vertical, profilePicture } = req.body;
        const creds = await getCredentials(req.user.id);
        const { version } = await getMetaConfig();

        let profilePictureHandle = null;

        if (profilePicture && profilePicture.startsWith('data:image')) {
            const matches = profilePicture.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
            if (!matches || matches.length !== 3) {
                return res.status(400).json({ error: "Invalid image format" });
            }
            const mimeType = matches[1];
            const buffer = Buffer.from(matches[2], 'base64');
            const fileLength = buffer.length;

            try {
                // Extract App ID dynamically
                const debugTokenRes = await axios.get(
                    `https://graph.facebook.com/${version}/debug_token?input_token=${creds.token}&access_token=${creds.token}`
                );
                const appId = debugTokenRes.data?.data?.app_id;
                
                if (!appId) throw new Error("Could not extract App ID from Token");

                // Create Session
                const sessionRes = await axios.post(
                    `https://graph.facebook.com/${version}/${appId}/uploads?file_length=${fileLength}&file_type=${mimeType}`,
                    {},
                    { headers: { Authorization: `Bearer ${creds.token}` } }
                );

                const uploadId = sessionRes.data.id;

                // Upload Bytes
                const uploadHandleRes = await axios.post(
                    `https://graph.facebook.com/${version}/${uploadId}`,
                    buffer,
                    {
                        headers: {
                            Authorization: `OAuth ${creds.token}`,
                            file_offset: 0,
                            'Content-Type': 'application/octet-stream'
                        }
                    }
                );

                profilePictureHandle = uploadHandleRes.data.h;
            } catch (imageErr) {
                console.error("Image Upload Failed:", imageErr.response?.data || imageErr.message);
                return res.status(400).json({ error: "Profile Image upload failed. Ensure your token belongs to a valid Meta App with 'whatsapp_business_management' scope." });
            }
        }

        const requestBody = { messaging_product: "whatsapp" };
        
        // Meta Graph API strictly rejects empty strings for most profile fields, throwing a 131000 OAuthException.
        // The 'about' field is particularly sensitive and often mandatory for uninitialized profiles.
        requestBody.about = (about && about.trim()) ? about.trim() : "Hey there! I am using WhatsApp.";
        
        // We only append other optional fields to the payload if they contain actual data.
        if (address && address.trim()) requestBody.address = address.trim();
        if (description && description.trim()) requestBody.description = description.trim();
        if (email && email.trim()) requestBody.email = email.trim();
        
        let validWebsites = websites ? (Array.isArray(websites) ? websites : [websites]) : [];
        validWebsites = validWebsites.filter(w => w && w.trim());
        if (validWebsites.length > 0) requestBody.websites = validWebsites;
        
        if (vertical && vertical.trim()) {
            let normalizedVertical = vertical.trim().toUpperCase();
            if (normalizedVertical === 'EDUCATION') normalizedVertical = 'EDU';
            if (normalizedVertical === 'IT') normalizedVertical = 'PROF_SERVICES';
            requestBody.vertical = normalizedVertical;
        }

        // 1. Update text profile parameters if there is data to send
        if (Object.keys(requestBody).length > 1) {
            await axios.post(
                `https://graph.facebook.com/${version}/${creds.phoneNumberId}/whatsapp_business_profile`,
                requestBody,
                { headers: { Authorization: `Bearer ${creds.token}` } }
            );
        }

        // 2. Update profile picture separately, swallowing Meta 131000 errors to prevent text update rollback
        if (profilePictureHandle) {
            try {
                await axios.post(
                    `https://graph.facebook.com/${version}/${creds.phoneNumberId}/whatsapp_business_profile`,
                    {
                        messaging_product: "whatsapp",
                        profile_picture_handle: profilePictureHandle
                    },
                    { headers: { Authorization: `Bearer ${creds.token}` } }
                );
            } catch (imgHandleErr) {
                console.error("Meta rejected the profile_picture_handle assignment:", imgHandleErr.response?.data || imgHandleErr.message);
                // Continue execution smoothly so the user receives a success response for text updates
            }
        }

        // 3. Update AI Brain System Prompt if not manually modified
        try {
            const agentConfig = await prisma.aiAgent.findUnique({
                where: { userId: req.user.id }
            });

            const currentPrompt = agentConfig?.systemPrompt;
            const canOverwrite = isPromptAuto(currentPrompt);

            if (canOverwrite) {
                const user = await prisma.user.findUnique({ where: { id: req.user.id } });
                
                // Prefer stored profile details/DB details as primary, with optional Meta API fallback if needed
                let displayName = user?.name || "Workspace Assistant";
                let displayPhone = user?.phone;

                // Meta API display name/number fallback
                try {
                    const phoneMetaRes = await axios.get(
                        `https://graph.facebook.com/${version}/${creds.phoneNumberId}?fields=display_phone_number,verified_name`,
                        { headers: { Authorization: `Bearer ${creds.token}` } }
                    );
                    if (phoneMetaRes.data) {
                        if (phoneMetaRes.data.verified_name) displayName = phoneMetaRes.data.verified_name;
                        if (phoneMetaRes.data.display_phone_number) displayPhone = phoneMetaRes.data.display_phone_number;
                    }
                } catch (metaFetchErr) {
                    console.warn("[Profile Update] Meta phone details fallback fetch failed:", metaFetchErr.message);
                }

                const newPrompt = generateDefaultSystemPrompt({
                    name: displayName,
                    phone: displayPhone,
                    email: email || user?.email,
                    vertical: vertical,
                    websites: websites,
                    description: description,
                    about: about,
                    address: address
                });

                const systemDefault = await getSystemDefaultAiSettings();

                await prisma.aiAgent.upsert({
                    where: { userId: req.user.id },
                    update: {
                        systemPrompt: newPrompt
                    },
                    create: {
                        userId: req.user.id,
                        name: displayName,
                        toolsEnabled: JSON.stringify(["search_products", "create_payment_link", "search_customer", "get_order_status", "escalate_to_human"]),
                        isActive: true,
                        useOwnAi: false,
                        model: systemDefault.model,
                        systemPrompt: newPrompt
                    }
                });
                console.log(`[Profile Update] Automatically updated AI system prompt for workspace ${req.user.id}`);
            } else {
                console.log(`[Profile Update] AI system prompt has CUSTOM modifications. Preserving original prompt.`);
            }
        } catch (aiAgentErr) {
            console.error("[Profile Update] Failed to update AiAgent system prompt:", aiAgentErr.message);
        }

        res.status(200).json({ success: true, message: "Profile updated successfully." });
    } catch (e) {
        console.error("Error updating profile:", e.response?.data || e.message);
        const metaError = e.response?.data?.error?.message || "Failed to update profile.";
        res.status(500).json({ error: metaError });
    }
});

module.exports = router;
