const { PrismaClient } = require('@prisma/client');
require('dotenv').config();
const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.SUPPORT_EMAIL || process.env.ADMIN_EMAIL;
  if (!adminEmail) {
    console.error('ERROR: Please set SUPPORT_EMAIL or ADMIN_EMAIL in your .env file.');
    process.exit(1);
  }
  await prisma.user.update({
    where: { email: adminEmail },
    data: { password: '$2b$10$obbnnLWAUHstxcXd9SX1ION9GcffbmcyfURPNtNTjl57XVaCBGsc.' }
  });
  console.log(`Password hash restored successfully for: ${adminEmail}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
