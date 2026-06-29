const axios = require('axios');
const prisma = require('../../../prismaClient');

class WhatsAppOTPService {
    static async sendOTP(phone, otp) {
        if (!phone) throw new Error("Phone number is missing for WhatsApp OTP.");

        const settingsList = await prisma.systemSetting.findMany({
            where: {
                key: { in: ['SYSTEM_META_TOKEN', 'META_API_VERSION', 'SYSTEM_PHONE_NUMBER_ID'] }
            }
        });

        const settings = {};
        settingsList.forEach(s => { settings[s.key] = s.value; });

        if (!settings.SYSTEM_META_TOKEN || !settings.META_API_VERSION || !settings.SYSTEM_PHONE_NUMBER_ID) {
            console.warn("Meta API settings are incomplete. Skipping WA OTP.");
            throw new Error("WhatsApp Meta configuration is missing");
        }

        const phoneFormatted = phone.startsWith('+') ? phone.substring(1) : phone;
        const url = `https://graph.facebook.com/${settings.META_API_VERSION}/${settings.SYSTEM_PHONE_NUMBER_ID}/messages`;
        const headers = {
            "Authorization": `Bearer ${settings.SYSTEM_META_TOKEN}`,
            "Content-Type": "application/json"
        };

        const languages = ["en_US", "en", "en_GB", "hi"];
        
        // Define all possible combinations of parameters a user might have created
        const getStructures = (lang) => [
            {
                // 1. Standard Auth Template (Body + Copy Code Button)
                name: "verification_code", language: { code: lang },
                components: [
                    { type: "body", parameters: [{ type: "text", text: otp.toString() }] },
                    { type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: otp.toString() }] }
                ]
            },
            {
                // 2. Utility Template or Auth Template with NO button parameter
                name: "verification_code", language: { code: lang },
                components: [
                    { type: "body", parameters: [{ type: "text", text: otp.toString() }] }
                ]
            },
            {
                // 3. Template with 2 Body parameters (e.g., "Hi {{1}}, your code is {{2}}")
                name: "verification_code", language: { code: lang },
                components: [
                    { type: "body", parameters: [{ type: "text", text: "User" }, { type: "text", text: otp.toString() }] }
                ]
            },
            {
                // 4. Template with NO parameters (static text)
                name: "verification_code", language: { code: lang },
                components: []
            }
        ];

        let lastError = null;

        for (const lang of languages) {
            const structures = getStructures(lang);
            for (let i = 0; i < structures.length; i++) {
                const payload = {
                    messaging_product: "whatsapp",
                    recipient_type: "individual",
                    to: phoneFormatted,
                    type: "template",
                    template: structures[i]
                };

                try {
                    const response = await axios.post(url, payload, { headers });
                    console.log(`[WA OTP] SUCCESS! Sent to ${phoneFormatted} using lang '${lang}' and structure ${i + 1}`);
                    return response.data;
                } catch (error) {
                    const metaError = error.response?.data?.error?.message || error.message;
                    console.log(`[WA OTP] Failed lang '${lang}' structure ${i + 1}:`, metaError);
                    lastError = error;
                    
                    // If the template name doesn't exist in this language at all, skip other structures for this language
                    if (metaError.includes("does not exist in the translation")) {
                        break; 
                    }
                }
            }
        }

        console.error(`[WA OTP Error] Exhausted all template combinations.`);
        throw new Error(lastError?.response?.data?.error?.message || "Failed to send WhatsApp OTP. Please check template configuration in Meta.");
    }
}

module.exports = WhatsAppOTPService;
