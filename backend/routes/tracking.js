const express = require('express');
const router = express.Router();
const prisma = require('../prismaClient');

router.get('/:shortCode', async (req, res) => {
    const { shortCode } = req.params;

    try {
        const linkClick = await prisma.linkClick.findUnique({
            where: { shortCode },
            include: { campaign: true }
        });

        if (!linkClick) {
            return res.status(404).send("Link not found or expired.");
        }

        // Update click stats in background
        prisma.linkClick.update({
            where: { id: linkClick.id },
            data: { 
                clicked: true, 
                clickCount: { increment: 1 } 
            }
        }).catch(err => console.error("Error updating link click:", err));

        if (linkClick.campaignId && linkClick.contactId) {
            // Log click event for contact timeline
            prisma.contactEvent.create({
                data: {
                    contactId: linkClick.contactId,
                    type: "LINK_CLICKED",
                    description: `Clicked URL from campaign: ${linkClick.campaign?.name || 'Unknown'}`
                }
            }).catch(err => console.error("Error logging contact event:", err));

            // Also find the MessageLog for this campaign & contact and mark it CLICKED if not already
            // Note: MessageLog recipient is the phone number, so we need to fetch contact phone
            prisma.contact.findUnique({ where: { id: linkClick.contactId } }).then(contact => {
                if (contact) {
                    prisma.messageLog.updateMany({
                        where: {
                            campaignId: linkClick.campaignId,
                            recipient: contact.phone
                        },
                        data: { status: 'CLICKED' }
                    }).catch(err => console.error("Error updating message log status to CLICKED:", err));
                }
            }).catch(err => console.error(err));
        }

        // Redirect user to the original URL
        return res.redirect(linkClick.originalUrl);

    } catch (e) {
        console.error("Error handling link tracking:", e);
        res.status(500).send("Internal Server Error");
    }
});

module.exports = router;
