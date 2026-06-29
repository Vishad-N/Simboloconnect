const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        console.log("=== STARTING USER LIMITS MIGRATION ===");
        
        // Find all users who have a plan
        const users = await prisma.user.findMany({
            where: {
                planId: { not: null }
            }
        });
        
        console.log(`Found ${users.length} users with a plan.`);
        
        let updatedCount = 0;
        for (const user of users) {
            // Check if the user limits match the old schema defaults.
            // If they match the defaults, we set them to null so they inherit from the plan.
            const defaults = {
                message_limit: 1000,
                contact_limit: 1000,
                campaigns_limit: 60,
                bot_replies_limit: 1000,
                bot_flows_limit: 5,
                team_members_limit: 3
            };
            
            const updateData = {};
            if (user.message_limit === defaults.message_limit) updateData.message_limit = null;
            if (user.contact_limit === defaults.contact_limit) updateData.contact_limit = null;
            if (user.campaigns_limit === defaults.campaigns_limit) updateData.campaigns_limit = null;
            if (user.bot_replies_limit === defaults.bot_replies_limit) updateData.bot_replies_limit = null;
            if (user.bot_flows_limit === defaults.bot_flows_limit) updateData.bot_flows_limit = null;
            if (user.team_members_limit === defaults.team_members_limit) updateData.team_members_limit = null;
            
            if (Object.keys(updateData).length > 0) {
                await prisma.user.update({
                    where: { id: user.id },
                    data: updateData
                });
                console.log(`Updated user ${user.name} (${user.email}): set fields to null:`, Object.keys(updateData));
                updatedCount++;
            }
        }
        
        console.log(`Migration completed. Updated ${updatedCount} users.`);
    } catch (e) {
        console.error("Migration error:", e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
