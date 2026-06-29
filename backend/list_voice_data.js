const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('=== Voice Providers ===');
    const providers = await prisma.voiceProvider.findMany();
    console.log(JSON.stringify(providers, null, 2));

    console.log('\n=== Voice Agents ===');
    const agents = await prisma.voiceAgent.findMany({
        include: { provider: true }
    });
    console.log(JSON.stringify(agents, null, 2));

    console.log('\n=== Voice Campaigns ===');
    const campaigns = await prisma.voiceCampaign.findMany().catch(() => []);
    console.log(JSON.stringify(campaigns, null, 2));

    console.log('\n=== Voice Reports ===');
    const reports = await prisma.voiceCallLog.findMany({ take: 5 }).catch(() => {
        console.log('No voiceCallLog model found');
        return [];
    });
    console.log(JSON.stringify(reports, null, 2));
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
