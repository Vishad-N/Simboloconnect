const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function reset() {
    try {
        const admin = await prisma.user.findFirst({ where: { role: 'SUPERADMIN' } }) || await prisma.user.findFirst({ where: { role: 'ADMIN' } });
        if (!admin) {
            console.log('No admin found');
            process.exit(1);
        }
        const newPassword = 'AdminPassword@123';
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(newPassword, salt);
        await prisma.user.update({
            where: { id: admin.id },
            data: { password: hash }
        });
        console.log('SUCCESS: Reset password for', admin.email, 'to', newPassword);
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}
reset();
