const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  console.log('--- FIXING GLOBAL VOICE PROVIDERS PRIORITY ---');
  await prisma.voiceProvider.update({
    where: { slug: 'retell' },
    data: { priority: 1 }
  });

  await prisma.voiceProvider.update({
    where: { slug: 'twilio' },
    data: { priority: 4 }
  });

  await prisma.voiceProvider.update({
    where: { slug: 'bland' },
    data: { priority: 2 }
  });

  const providers = await prisma.voiceProvider.findMany({
    orderBy: { priority: 'asc' }
  });
  
  for (const p of providers) {
    console.log(`Provider: ${p.name} | Slug: ${p.slug} | Enabled: ${p.enabled} | Priority: ${p.priority}`);
  }

  await prisma.$disconnect();
}

run().catch(console.error);
