const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        console.log("=== DEBUG SCRIPT START ===");
        
        // 1. Check Users
        const users = await prisma.user.findMany({
            select: { id: true, email: true, phoneNumberId: true, wabaId: true }
        });
        console.log(`Users Found: ${users.length}`);
        users.forEach(u => console.log(` - User: ${u.email} (ID: ${u.id}) | PhoneID: ${u.phoneNumberId || 'MISSING'}`));

        if (users.length === 0) {
            console.log("CRITICAL: No users found in DB.");
            return;
        }

        const user = users.find(u => u.email === 'abhishekbhaimt15@gmail.com');
        if (!user) {
             console.log("User abhishekbhaimt15@gmail.com not found!");
             return;
        }
        const userId = user.id;

        // 2. Check Templates
        const templates = await prisma.template.findMany({
            where: { userId: userId }
        });
        console.log(`Templates for User ${userId}: ${templates.length}`);
        if (templates.length > 0) {
            console.log("First 3 Templates:");
            templates.slice(0, 3).forEach(t => console.log(` - ${t.name} (${t.status})`));
        } else {
            console.log("WARN: No templates found for this user.");
        }

        // 3. Check Contacts
        const contacts = await prisma.contact.findMany({
            where: { userId: userId }
        });
        console.log(`Contacts for User ${userId}: ${contacts.length}`);
        if (contacts.length > 0) {
            console.log("First 3 Contacts:");
            contacts.slice(0, 3).forEach(c => console.log(` - ${c.name} (${c.phone})`));
        } else {
            console.log("WARN: No contacts found for this user.");
        }

        // 4. Check Message Logs
        const logs = await prisma.messageLog.findMany({
            where: { userId: userId },
            take: 5,
            orderBy: { timestamp: 'desc' }
        });
        console.log(`Recent Message Logs: ${logs.length}`);
        logs.forEach(l => console.log(` - [${l.direction}] ${l.recipient}: ${l.status}`));

    } catch (e) {
        console.error("Error:", e);
    } finally {
        await prisma.$disconnect();
    }
}

main();