const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const existing = await prisma.plan.findFirst({ where: { price: 0 } });
    if (!existing) {
        await prisma.plan.create({
            data: {
                name: "7-Day Trial",
                price: 0.0,
                duration_days: 7,
                features_json: ["Unlimited Chats", "1000 Contacts Limit", "Basic Bot Flows", "5 Campaigns/Month"],
                contacts_limit: 1000,
                campaigns_limit: 5,
                bot_replies_limit: 500,
                bot_flows_limit: 2,
                team_members_limit: 1
            }
        });
        console.log("Created Default 7-Day Trial Plan!");
    } else {
        console.log("Trial plan already exists:", existing.name);
    }
}
main().catch(console.error).finally(() => prisma.$disconnect());
