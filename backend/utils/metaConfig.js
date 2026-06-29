const prisma = require('../prismaClient');

let cachedConfig = null;

async function getMetaConfig() {
    if (cachedConfig) return cachedConfig;

    const settings = await prisma.systemSetting.findMany({
        where: {
            key: {
                in: [
                    'META_GRAPH_API_VERSION',
                    'META_API_VERSION',
                    'WEBHOOK_VERIFY_TOKEN',
                    'SYSTEM_META_TOKEN',
                    'META_JS_SDK_VERSION',
                    'META_EMBEDDED_SIGNUP_VERSION',
                    'META_BUSINESS_APP_ONBOARDING_ENABLED',
                    'META_SETTINGS_LAST_UPDATED',
                    'PREV_META_JS_SDK_VERSION',
                    'PREV_META_GRAPH_API_VERSION',
                    'PREV_META_API_VERSION',
                    'PREV_META_EMBEDDED_SIGNUP_VERSION',
                    'PREV_META_BUSINESS_APP_ONBOARDING_ENABLED'
                ]
            }
        }
    });

    const config = settings.reduce((acc, curr) => {
        acc[curr.key] = curr.value;
        return acc;
    }, {});

    const activeVersion = config.META_GRAPH_API_VERSION || config.META_API_VERSION || 'v20.0';
    const prevApiVersion = config.PREV_META_GRAPH_API_VERSION || config.PREV_META_API_VERSION || 'v20.0';

    cachedConfig = {
        version: activeVersion,
        verifyToken: config.WEBHOOK_VERIFY_TOKEN || process.env.META_WEBHOOK_VERIFY_TOKEN || 'whatchamp',
        systemToken: config.SYSTEM_META_TOKEN || '',
        jsSdkVersion: config.META_JS_SDK_VERSION || 'v19.0',
        embeddedSignupVersion: config.META_EMBEDDED_SIGNUP_VERSION || 'v19.0',
        businessAppOnboardingEnabled: config.META_BUSINESS_APP_ONBOARDING_ENABLED === 'true',
        settingsLastUpdated: config.META_SETTINGS_LAST_UPDATED || '',
        prevJsSdkVersion: config.PREV_META_JS_SDK_VERSION || 'v19.0',
        prevApiVersion: prevApiVersion,
        prevEmbeddedSignupVersion: config.PREV_META_EMBEDDED_SIGNUP_VERSION || 'v19.0',
        prevBusinessAppOnboardingEnabled: config.PREV_META_BUSINESS_APP_ONBOARDING_ENABLED === 'true'
    };

    return cachedConfig;
}

function clearMetaConfigCache() {
    cachedConfig = null;
}

module.exports = {
    getMetaConfig,
    clearMetaConfigCache
};
