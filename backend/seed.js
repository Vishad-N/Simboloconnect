const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const crypto = require('crypto');
const { encrypt } = require('./utils/encryption');

async function main() {
    console.log('Seeding dummy data...');

    // 1. Create Dummy User
    const user = await prisma.user.upsert({
        where: { email: 'admin@example.com' },
        update: {},
        create: {
            email: 'admin@example.com',
            password: 'hashed_password_placeholder', // Normally should be hashed
            metaToken: encrypt('EAAXXXXXX_DUMMY_TOKEN'),
            phoneNumberId: '123456789012345',
            wabaId: '987654321098765'
        },
    });

    console.log(`User created: ${user.email}`);

    // 2. Create Dummy Contacts
    const contactsData = [
        { name: 'John Doe', phone: '919876543210', tags: ['MT-15 Launch', 'VIP'] },
        { name: 'Jane Smith', phone: '919876543211', tags: ['Lucknow Marketing', 'Lead'] },
        { name: 'Alice Johnson', phone: '919876543212', tags: ['MT-15 Launch'] },
    ];

    for (const contact of contactsData) {
        await prisma.contact.upsert({
            where: {
                userId_phone: {
                    userId: user.id,
                    phone: contact.phone
                }
            },
            update: {},
            create: {
                ...contact,
                userId: user.id,
            },
        });
    }

    console.log(`Contacts created: ${contactsData.length}`);

    // 3. Create Sample Template
    const template = await prisma.template.create({
        data: {
            userId: user.id,
            name: 'hello_world',
            language: 'en_US',
            category: 'MARKETING',
            body: 'Hello {{1}}, welcome to our platform!',
            status: 'APPROVED',
            components: [
                { type: 'HEADER', format: 'TEXT', text: 'Welcome!' },
                { type: 'BODY', text: 'Hello {{1}}, welcome to our platform!' },
                { type: 'BUTTONS', buttons: [{ type: 'URL', text: 'Visit', url: 'https://example.com' }] }
            ]
        }
    });

    console.log(`Template created: ${template.name}`);

    // 4. Create Dummy Campaigns
    const campaignsData = [
        { name: 'MT-15 Launch', status: 'COMPLETED', targetTags: ['MT-15 Launch'], templateId: template.id },
        { name: 'Lucknow Marketing', status: 'RUNNING', targetTags: ['Lucknow Marketing'], templateId: template.id },
        { name: 'Diwali Offer', status: 'PENDING', targetTags: ['VIP'], templateId: template.id },
    ];

    for (const campaign of campaignsData) {
        await prisma.campaign.create({
            data: {
                ...campaign,
                userId: user.id,
            },
        });
    }

    console.log(`Campaigns created: ${campaignsData.length}`);

    // 5. Create some Message Logs for the dashboard metrics
    const logsData = [
        { messageId: 'wamid.1111', recipient: '919876543210', status: 'READ' },
        { messageId: 'wamid.2222', recipient: '919876543211', status: 'DELIVERED' },
        { messageId: 'wamid.3333', recipient: '919876543212', status: 'SENT' },
        { messageId: 'wamid.4444', recipient: '919876543213', status: 'FAILED' },
        { messageId: 'wamid.5555', recipient: '919876543210', status: 'READ' },
    ];

    for (const log of logsData) {
        await prisma.messageLog.upsert({
            where: { messageId: log.messageId },
            update: {},
            create: {
                ...log,
                userId: user.id,
            },
        });
    }

    console.log(`Message Logs created: ${logsData.length}`);
    console.log('Seeding completed successfully 🚀');
}

main()
    .then(async () => {
        await prisma.$disconnect()
    })
    .catch(async (e) => {
        console.error(e)
        await prisma.$disconnect()
        process.exit(1)
    })
