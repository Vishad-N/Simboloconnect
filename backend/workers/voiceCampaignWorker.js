const { Queue, Worker } = require('bullmq');
const redisConnection = require('../services/redisConnection');
const { PrismaClient } = require('@prisma/client');
const VoiceProviderFactory = require('../services/voice/VoiceProviderFactory');
const VoiceTenantIsolationGuard = require('../services/voice/VoiceTenantIsolationGuard');

const prisma = new PrismaClient();

const campaignQueue = new Queue('VoiceCampaignQueue', { connection: redisConnection });

const campaignWorker = new Worker('VoiceCampaignQueue', async (job) => {
    const { type, payload } = job.data;

    if (type === 'PROCESS_CAMPAIGN') {
        const { campaignId } = payload;
        const campaign = await prisma.voiceCampaign.findUnique({ where: { id: campaignId } });
        if (!campaign) throw new Error(`Campaign ${campaignId} not found`);

        if (campaign.status === 'CANCELLED' || campaign.status === 'PAUSED') return;

        // Fetch contacts based on targetTags or targetPhones
        // Assuming we look up targetTags similar to standard Campaigns
        const targetTags = campaign.targetTags || [];
        const contacts = await prisma.contact.findMany({
            where: {
                userId: campaign.userId,
                tags: { hasSome: targetTags }
            }
        });

        await prisma.voiceCampaign.update({
            where: { id: campaignId },
            data: { 
                status: 'RUNNING', 
                audienceCount: contacts.length,
                startedAt: new Date()
            }
        });

        // Add individual call jobs
        for (const contact of contacts) {
            await campaignQueue.add(`call-${contact.id}`, {
                type: 'PROCESS_CALL',
                payload: {
                    campaignId,
                    contactId: contact.id,
                    phone: contact.phone,
                    userId: campaign.userId,
                    provider: campaign.provider,
                    agentId: campaign.agentId
                }
            }, {
                jobId: `call-${campaignId}-${contact.id}`,
                attempts: campaign.retryEnabled ? (campaign.retryCount || 1) : 0,
                backoff: { type: 'exponential', delay: campaign.retryDelay || 5000 }
            });
        }
    } 
    else if (type === 'PROCESS_CALL') {
        const { campaignId, contactId, phone, userId, provider, agentId } = payload;

        // Check if campaign is paused/cancelled
        const campaign = await prisma.voiceCampaign.findUnique({ where: { id: campaignId } });
        if (!campaign || campaign.status === 'CANCELLED' || campaign.status === 'PAUSED') return;

        // Throttle check based on concurrentCalls setting
        const maxConcurrent = campaign.concurrentCalls || 1;
        let activeCallsCount = await prisma.voiceCallSession.count({
            where: {
                campaignId,
                status: { in: ['INITIATED', 'RINGING', 'ANSWERED'] }
            }
        });

        let waitTime = 0;
        while (activeCallsCount >= maxConcurrent && waitTime < 30000) {
            console.log(`[VoiceCampaignWorker] Max concurrency of ${maxConcurrent} reached for campaign ${campaignId} (${activeCallsCount} active). Waiting 2s...`);
            await new Promise(resolve => setTimeout(resolve, 2000));
            waitTime += 2000;

            const currentCampaign = await prisma.voiceCampaign.findUnique({ where: { id: campaignId } });
            if (!currentCampaign || ['CANCELLED', 'PAUSED'].includes(currentCampaign.status)) return;

            activeCallsCount = await prisma.voiceCallSession.count({
                where: {
                    campaignId,
                    status: { in: ['INITIATED', 'RINGING', 'ANSWERED'] }
                }
            });
        }

        if (activeCallsCount >= maxConcurrent) {
            throw new Error(`[Concurrency Limit] Max concurrency of ${maxConcurrent} reached for campaign ${campaignId}. Postponing call to ${phone}.`);
        }

        // Get Provider Credentials - campaign.provider stores providerId (UUID)
        const userProvider = await prisma.userVoiceProvider.findFirst({
            where: { userId, providerId: provider },
            include: { provider: true }
        });

        if (!userProvider) {
            await updateCallStats(campaignId, 'failedCount');
            throw new Error(`Provider config not found for providerId: ${provider}`);
        }

        // Decrypt API key before passing to provider factory
        const decryptedApiKey = VoiceTenantIsolationGuard.decrypt(userProvider.encryptedApiKey);
        const decryptedAgentId = userProvider.encryptedAgentId ? 
            VoiceTenantIsolationGuard.decrypt(userProvider.encryptedAgentId) : null;
        const decryptedVoiceId = userProvider.encryptedVoiceId ?
            VoiceTenantIsolationGuard.decrypt(userProvider.encryptedVoiceId) : null;
        const providerSlug = userProvider.provider.slug;

        const voiceAdapter = VoiceProviderFactory.getProvider(
            providerSlug,
            decryptedApiKey,
            agentId || decryptedAgentId,
            { voiceId: decryptedVoiceId, userId }  // ← voiceId = Phone Number ID for Vapi
        );

        try {
            // Format phone to E.164 if not already
            let formattedPhone = (phone || '').trim();
            if (formattedPhone && !formattedPhone.startsWith('+')) {
                const digitsOnly = formattedPhone.replace(/\D/g, '');
                if (digitsOnly) formattedPhone = '+' + digitsOnly;
            }

            // Create VoiceCallSession first to get a sessionId and avoid webhook race conditions
            const session = await prisma.voiceCallSession.create({
                data: {
                    userId,
                    contactId,
                    campaignId,
                    provider: providerSlug,
                    direction: 'OUTBOUND',
                    status: 'INITIATED'
                }
            });

            try {
                const result = await voiceAdapter.initiateCall(formattedPhone, null, { 
                    name: 'Customer',
                    userId,
                    contactId,
                    sessionId: session.id
                });
                
                // Update session with externalCallId from Vapi/Provider
                await prisma.voiceCallSession.update({
                    where: { id: session.id },
                    data: {
                        externalCallId: result.externalCallId,
                        status: result.status || 'INITIATED'
                    }
                });

                await updateCallStats(campaignId, 'dialedCount');
            } catch (err) {
                console.error(`Call failed for ${phone}`, err);
                await prisma.voiceCallSession.update({
                    where: { id: session.id },
                    data: { status: 'FAILED' }
                });
                await updateCallStats(campaignId, 'failedCount');
                throw err;
            }
        } catch (error) {
            console.error(`Database session creation failed for ${phone}`, error);
            throw error;
        }
    }
}, { 
    connection: redisConnection,
    concurrency: 20
});

async function updateCallStats(campaignId, field) {
    await prisma.voiceCampaign.update({
        where: { id: campaignId },
        data: {
            [field]: { increment: 1 }
        }
    });
}

module.exports = { campaignQueue, campaignWorker };
