const cron = require('node-cron');
const prisma = require('../prismaClient');
const { decrypt } = require('../utils/encryption');
const { campaignQueue } = require('../services/CampaignQueue');

// Run every minute
cron.schedule('* * * * *', async () => {
    try {
        const now = new Date();
        // Find all SCHEDULED campaigns where scheduled time has passed or is right now
        const campaigns = await prisma.campaign.findMany({
            where: {
                status: 'SCHEDULED',
                scheduledAt: {
                    lte: now
                }
            },
            include: {
                template: true,
                user: true
            }
        });

        if (campaigns.length === 0) return;

        console.log(`[Cron] Found ${campaigns.length} scheduled campaigns ready to execute.`);

        for (const campaign of campaigns) {
            try {
                if (!campaign.user?.wabaId || !campaign.user?.metaToken || !campaign.user?.phoneNumberId) {
                    console.error(`[Cron] Meta credentials missing for campaign ${campaign.id}`);
                    await prisma.campaign.update({
                        where: { id: campaign.id },
                        data: { status: 'FAILED' }
                    });
                    continue;
                }

                // Update to RUNNING so another cron job tick doesn't pick it up
                await prisma.campaign.update({
                    where: { id: campaign.id },
                    data: { status: 'RUNNING' }
                });

                const decryptedToken = decrypt(campaign.user.metaToken);
                
                // Fetch contacts
                let contactFilter = { userId: campaign.userId, optOut: false };
                if (campaign.targetPhones && campaign.targetPhones.length > 0) {
                    contactFilter.phone = { in: campaign.targetPhones };
                } else if (campaign.targetTags && campaign.targetTags.length > 0) {
                    contactFilter.tags = { hasSome: campaign.targetTags };
                }

                const contacts = await prisma.contact.findMany({ where: contactFilter });
                
                if (contacts.length === 0) {
                    await prisma.campaign.update({
                        where: { id: campaign.id },
                        data: { status: 'COMPLETED' }
                    });
                    continue;
                }

                console.log(`[Cron] Executing campaign ${campaign.id} for ${contacts.length} contacts.`);

                // Queue messages
                for (let i = 0; i < contacts.length; i++) {
                    await campaignQueue.add('send_campaign_message', {
                        contact: contacts[i],
                        template: campaign.template,
                        user: {
                            phoneNumberId: campaign.user.phoneNumberId,
                            decryptedToken: decryptedToken
                        },
                        campaignId: campaign.id,
                        userId: campaign.userId,
                        variablesConfig: campaign.variablesConfig,
                        mediaUrl: campaign.mediaUrl,
                        batchIndex: i,
                        enableClickTracking: campaign.enableClickTracking
                    });
                }

                // Update to COMPLETED (Meaning all jobs are queued)
                await prisma.campaign.update({
                    where: { id: campaign.id },
                    data: { status: 'COMPLETED' }
                });

            } catch (err) {
                console.error(`[Cron] Error executing campaign ${campaign.id}:`, err);
                await prisma.campaign.update({
                    where: { id: campaign.id },
                    data: { status: 'FAILED' }
                });
            }
        }

        // ─── Ecommerce Campaigns ───
        try {
            const ecomCampaigns = await prisma.ecomCampaign.findMany({
                where: {
                    status: 'scheduled',
                    scheduledAt: {
                        lte: now
                    }
                }
            });

            if (ecomCampaigns.length > 0) {
                console.log(`[Cron] Found ${ecomCampaigns.length} scheduled ecom campaigns ready to execute.`);
                const { executeEcomCampaign } = require('../services/EcomCampaignService');
                for (const campaign of ecomCampaigns) {
                    try {
                        await executeEcomCampaign(campaign.id);
                    } catch (ecomErr) {
                        console.error(`[Cron] Error running scheduled ecom campaign ${campaign.id}:`, ecomErr);
                    }
                }
            }
        } catch (ecomCronErr) {
            console.error('[Cron] Error running ecommerce campaign scheduler check:', ecomCronErr);
        }

    } catch (error) {
        console.error('[Cron] Error running campaign scheduler check:', error);
    }
});

console.log('[Cron] Campaign Scheduler initialized. Running every minute.');
