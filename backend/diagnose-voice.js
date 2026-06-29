const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log("=== USERS ===");
  const users = await prisma.user.findMany({
    select: { id: true, email: true, role: true }
  });
  console.log(users);

  console.log("\n=== VOICE CALL SESSIONS ===");
  const sessions = await prisma.voiceCallSession.findMany({
    include: {
      contact: {
        select: { name: true, phone: true }
      }
    },
    take: 10
  });
  console.log(sessions);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
