const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
    const agents = await p.voiceAgent.findMany();
    console.log('=== AGENTS COUNT:', agents.length, '===');
    console.log(JSON.stringify(agents, null, 2));
    
    const campaigns = await p.voiceCampaign.findMany();
    console.log('=== CAMPAIGNS COUNT:', campaigns.length, '===');
    console.log(JSON.stringify(campaigns, null, 2));
    
    // Check voice call logs
    try {
        const logs = await p.voiceCallLog.findMany({ take: 5 });
        console.log('=== CALL LOGS COUNT:', logs.length, '===');
        console.log(JSON.stringify(logs, null, 2));
    } catch(e) {
        console.log('voiceCallLog model check:', e.message.substring(0, 100));
    }
}

main().catch(console.error).finally(() => p.$disconnect());
