const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const bcrypt = require('bcryptjs');

async function main() {
    const hashedPassword = await bcrypt.hash('admin123', 10);

    const superAdmin = await prisma.user.upsert({
        where: { email: 'superadmin@yourdomain.com' },
        update: {
            password: hashedPassword,
            name: 'Platform Admin',
            role: 'SUPERADMIN',
            isActive: true,
            validityExpiresAt: new Date(Date.now() + 3650 * 24 * 60 * 60 * 1000) // 10 years
        },
        create: {
            id: 'superadmin-0000-0000-0000-000000000000',
            email: 'superadmin@yourdomain.com',
            password: hashedPassword,
            name: 'Platform Admin',
            role: 'SUPERADMIN',
            isActive: true,
            validityExpiresAt: new Date(Date.now() + 3650 * 24 * 60 * 60 * 1000) // 10 years
        },
    });

    console.log({ superAdmin });
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
