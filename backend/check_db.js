const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const sessionId = 'c58440cd-e01d-468c-b477-3f01dea2b3bc';
  console.log('--- DETAILED SESSION ---');
  const session = await prisma.voiceCallSession.findUnique({
    where: { id: sessionId }
  });

  console.log('Session details:', session);

  await prisma.$disconnect();
}

run().catch(console.error);
