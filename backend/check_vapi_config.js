const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

// Use the actual VoiceTenantIsolationGuard from the app
const VoiceTenantIsolationGuard = require('./services/voice/VoiceTenantIsolationGuard');

async function main() {
    const configs = await p.userVoiceProvider.findMany({
        include: { provider: true }
    });
    
    console.log('=== ALL USER VOICE PROVIDER CONFIGS ===');
    for (const c of configs) {
        let apiKeyPreview = '(empty)';
        let agentId = '(empty)';
        let voiceId = '(empty)';
        
        try { 
            const key = VoiceTenantIsolationGuard.decrypt(c.encryptedApiKey);
            apiKeyPreview = key ? (key.substring(0, 15) + '...') : '(empty)';
        } catch(e) { apiKeyPreview = '[err: ' + e.message.substring(0,30) + ']'; }
        
        try { agentId = VoiceTenantIsolationGuard.decrypt(c.encryptedAgentId) || '(empty)'; } catch(e) { agentId = '[err]'; }
        try { voiceId = c.encryptedVoiceId ? (VoiceTenantIsolationGuard.decrypt(c.encryptedVoiceId) || '(empty)') : '(not set)'; } catch(e) { voiceId = '[err]'; }
        
        console.log('\n--- Provider:', c.provider.name, '(' + c.provider.slug + ') ---');
        console.log('User ID:', c.userId);
        console.log('Active:', c.active);
        console.log('API Key preview:', apiKeyPreview);
        console.log('Agent ID:', agentId);
        console.log('Voice/Phone Number ID:', voiceId);
        console.log('DB Provider ID:', c.providerId);
    }
}

main().catch(console.error).finally(() => p.$disconnect());
