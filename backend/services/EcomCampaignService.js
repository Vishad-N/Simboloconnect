const prisma = require('../prismaClient');
const { decrypt } = require('../utils/encryption');
const { campaignQueue } = require('./CampaignQueue');

function convertVariablesToMetaFormat(body) {
    let index = 1;
    return body.replace(/\{\{([a-zA-Z_][a-zA-Z0-9_]*)\}\}/g, () => {
        return `{{${index++}}}`;
    });
}

/**
 * Executes an ecommerce WhatsApp campaign immediately by fetching the target
 * store customers/carts, resolving variables, and queuing messages to CampaignQueue.
 * 
 * @param {string} campaignId - The ID of the EcomCampaign to execute
 */
async function executeEcomCampaign(campaignId) {
    try {
        const campaign = await prisma.ecomCampaign.findUnique({
            where: { id: campaignId },
            include: { store: true }
        });
        if (!campaign) {
            console.error(`[EcomCampaign] Campaign ${campaignId} not found.`);
            return;
        }

        // Only process draft or scheduled campaigns
        if (campaign.status !== 'scheduled' && campaign.status !== 'draft') {
            console.log(`[EcomCampaign] Campaign ${campaignId} has status: ${campaign.status}. Skipping.`);
            return;
        }

        const user = await prisma.user.findUnique({ where: { id: campaign.userId } });
        if (!user || !user.metaToken || !user.phoneNumberId) {
            console.error(`[EcomCampaign] Meta credentials missing for user ${campaign.userId}`);
            await prisma.ecomCampaign.update({
                where: { id: campaignId },
                data: { status: 'failed' }
            });
            return;
        }

        if (!campaign.templateName) {
            console.error(`[EcomCampaign] No template specified for campaign ${campaignId}`);
            await prisma.ecomCampaign.update({
                where: { id: campaignId },
                data: { status: 'failed' }
            });
            return;
        }

        const ecomTemplate = await prisma.ecomTemplate.findFirst({
            where: { userId: campaign.userId, name: campaign.templateName }
        });
        if (!ecomTemplate) {
            console.error(`[EcomCampaign] Ecommerce template ${campaign.templateName} not found.`);
            await prisma.ecomCampaign.update({
                where: { id: campaignId },
                data: { status: 'failed' }
            });
            return;
        }

        // Mark as running
        await prisma.ecomCampaign.update({
            where: { id: campaignId },
            data: { status: 'running', startedAt: new Date() }
        });

        const decryptedToken = decrypt(user.metaToken);
        let contacts = [];

        if (campaign.audienceSegment === 'abandoned') {
            // Target users with pending abandoned carts
            const carts = await prisma.ecomAbandonedCart.findMany({
                where: {
                    userId: campaign.userId,
                    ...(campaign.storeId && campaign.storeId !== 'all' ? { storeId: campaign.storeId } : {}),
                    recoveryStatus: 'pending'
                }
            });

            contacts = carts.map(cart => ({
                id: cart.id,
                name: cart.customerName || 'Customer',
                phone: cart.customerPhone,
                customFields: {
                    checkoutUrl: cart.checkoutUrl || '',
                    cartValue: String(cart.cartValue || 0),
                    itemCount: String(cart.itemCount || 0),
                    shop_link: campaign.store ? `https://${campaign.store.domain}` : '',
                    shop_name: campaign.store ? campaign.store.storeName : '',
                    coupon_code: 'SAVE10'
                }
            })).filter(c => c.phone);
        } else {
            // Target synced customers
            let customerFilter = { userId: campaign.userId };
            if (campaign.storeId && campaign.storeId !== 'all') {
                customerFilter.storeId = campaign.storeId;
            }
            if (campaign.audienceSegment && campaign.audienceSegment !== 'all') {
                customerFilter.segment = campaign.audienceSegment;
            }

            const customers = await prisma.ecomCustomer.findMany({ where: customerFilter });
            contacts = customers.map(cust => ({
                id: cust.id,
                name: cust.name || 'Customer',
                phone: cust.phone || cust.whatsappNumber,
                customFields: {
                    city: cust.city || '',
                    country: cust.country || 'India',
                    segment: cust.segment || '',
                    totalOrders: String(cust.totalOrders || 0),
                    totalSpent: String(cust.totalSpent || 0),
                    shop_link: campaign.store ? `https://${campaign.store.domain}` : '',
                    shop_name: campaign.store ? campaign.store.storeName : '',
                    coupon_code: 'WELCOME10'
                }
            })).filter(c => c.phone);
        }

        if (contacts.length === 0) {
            console.log(`[EcomCampaign] No recipients found for campaign ${campaignId}. Completing.`);
            await prisma.ecomCampaign.update({
                where: { id: campaignId },
                data: {
                    status: 'completed',
                    completedAt: new Date(),
                    audienceCount: 0
                }
            });
            return;
        }

        console.log(`[EcomCampaign] Queueing ${contacts.length} messages for campaign ${campaignId}.`);

        const convertedBody = convertVariablesToMetaFormat(ecomTemplate.body);

        // Prepare template schema expected by queue worker
        const templateForQueue = {
            name: ecomTemplate.name,
            language: ecomTemplate.language || 'en',
            components: JSON.stringify([
                {
                    type: 'BODY',
                    text: convertedBody
                }
            ])
        };

        // Convert variable names array to variable config mapping
        const variablesConfig = (ecomTemplate.variables || []).map(v => {
            const lower = v.toLowerCase();
            if (lower.includes('name')) {
                return { type: 'contact_name' };
            } else if (lower.includes('phone')) {
                return { type: 'contact_phone' };
            } else {
                return { type: 'customField', value: v };
            }
        });

        // Add each send job to campaignQueue
        for (let i = 0; i < contacts.length; i++) {
            await campaignQueue.add('send_campaign_message', {
                contact: contacts[i],
                template: templateForQueue,
                user: {
                    phoneNumberId: user.phoneNumberId,
                    decryptedToken: decryptedToken
                },
                ecomCampaignId: campaignId,
                userId: campaign.userId,
                variablesConfig: variablesConfig,
                batchIndex: i
            });
        }

        // Complete the campaign setup
        await prisma.ecomCampaign.update({
            where: { id: campaignId },
            data: {
                status: 'completed',
                completedAt: new Date(),
                audienceCount: contacts.length
            }
        });

    } catch (err) {
        console.error(`[EcomCampaign] Error executing campaign ${campaignId}:`, err);
        await prisma.ecomCampaign.update({
            where: { id: campaignId },
            data: { status: 'failed' }
        });
    }
}

module.exports = { executeEcomCampaign };
