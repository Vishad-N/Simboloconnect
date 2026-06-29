const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        console.log("=== DEBUG USER SCRIPT ===");
        const email = 'abhishekbhaimt15@gmail.com';
        
        const user = await prisma.user.findFirst({
            where: { email: email }
        });

        if (!user) {
            console.log(`User ${email} NOT FOUND`);
            return;
        }

        console.log(`User Found: ${user.id} | Name: ${user.name}`);

        // Templates
        const templates = await prisma.template.findMany({
            where: { userId: user.id }
        });
        console.log(`Templates Count: ${templates.length}`);
        console.log(JSON.stringify(templates, null, 2));

        // Contacts
        const contacts = await prisma.contact.findMany({
            where: { userId: user.id }
        });
        console.log(`Contacts Count: ${contacts.length}`);
        console.log(JSON.stringify(contacts, null, 2));

        // Logs
        const logs = await prisma.messageLog.count({
            where: { userId: user.id }
        });
        console.log(`Message Logs Count: ${logs}`);

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();