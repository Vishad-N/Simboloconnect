const cron = require('node-cron');
const prisma = require('../prismaClient');
const EmailService = require('../services/email/EmailService');

// Run this job every day at midnight (00:00) server time
cron.schedule('0 0 * * *', async () => {
    console.log('[Cron] Running daily expiry check for user subscriptions...');

    try {
        // Find users whose validityExpiresAt is exactly 3 days from now
        const today = new Date();
        const targetDateStart = new Date(today);
        targetDateStart.setDate(targetDateStart.getDate() + 3);
        targetDateStart.setHours(0, 0, 0, 0);

        const targetDateEnd = new Date(targetDateStart);
        targetDateEnd.setHours(23, 59, 59, 999);

        const usersExpiringSoon = await prisma.user.findMany({
            where: {
                isActive: true,
                validityExpiresAt: {
                    gte: targetDateStart,
                    lte: targetDateEnd
                }
            },
            include: {
                plan: true
            }
        });

        if (usersExpiringSoon.length === 0) {
            console.log('[Cron] No users are expiring within the next 3 days.');
            return;
        }

        console.log(`[Cron] Found ${usersExpiringSoon.length} users expiring in 3 days. Sending emails...`);

        // Send email to each user
        for (const user of usersExpiringSoon) {
            const planName = user.plan ? user.plan.name : 'Trial';
            const expiryStr = new Date(user.validityExpiresAt).toLocaleDateString();

            const mailOptions = {
                to: user.email,
                subject: 'Action Required: Your Platform Plan is Expiring Soon',
                html: `
                    <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
                        <h2>Hello ${user.name || 'Valued Customer'},</h2>
                        <p>This is a friendly reminder that your <strong>${planName}</strong> plan on Platform is scheduled to expire in exactly 3 days, on <strong>${expiryStr}</strong>.</p>
                        <p>To ensure uninterrupted access to your WhatsApp automated workflows, please log in and renew your plan.</p>
                        <br>
                        <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/plans" style="background-color: #22c55e; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">Renew Plan Now</a>
                        <br><br>
                        <p>Thank you for using Platform!</p>
                        <p><em>The Platform Team</em></p>
                    </div>
                `
            };

            await EmailService.sendEmail(null, mailOptions);
            console.log(`[Cron] Warning email sent to ${user.email}`);
        }

    } catch (error) {
        console.error('[Cron] Error running expiry check:', error);
    }
});

console.log('[Cron] Expiry Check job scheduled to run daily at midnight.');

// Run this job every 5 minutes to expire stale AI Checkout Sessions
cron.schedule('*/5 * * * *', async () => {
    try {
        const result = await prisma.checkoutSession.updateMany({
            where: {
                status: 'issued',
                expiresAt: { lte: new Date() } // currently past the expiration time
            },
            data: {
                status: 'expired'
            }
        });

        if (result.count > 0) {
            console.log(`[Cron] Expired ${result.count} stale AI checkout sessions.`);
        }
    } catch (error) {
        console.error('[Cron] Error running checkout session expiry check:', error);
    }
});
console.log('[Cron] AI Checkout Session expiry check scheduled to run every 5 minutes.');

module.exports = {};
