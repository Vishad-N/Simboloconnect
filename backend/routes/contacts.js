const express = require('express');
const router = express.Router();
const prisma = require('../prismaClient');

const { authenticate } = require('../middleware/auth');
const checkPermission = require('../middleware/rbac');
const { enforceContactLimit } = require('../middleware/planLimits');


// 1. Get all contacts with advanced filtering and pagination
router.get('/', authenticate, async (req, res) => {
    const userId = req.user.workspaceId;
    try {
        const { page = 1, limit = 50, search = '', tags = '', source = '', startDate, endDate, customFields } = req.query;
        
        const pageNumber = parseInt(page, 10);
        const pageSize = parseInt(limit, 10);
        const skip = (pageNumber - 1) * pageSize;

        let whereClause = { userId: userId };

        // Search logic (name, phone, email)
        if (search) {
            whereClause.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { phone: { contains: search } },
                { email: { contains: search, mode: 'insensitive' } }
            ];
        }

        // Tags filtering (AND logic if multiple tags)
        if (tags) {
            const tagsArray = tags.split(',').map(t => t.trim());
            whereClause.tags = { hasEvery: tagsArray };
        }

        if (source) {
            whereClause.source = source;
        }

        if (startDate || endDate) {
            whereClause.createdAt = {};
            if (startDate) whereClause.createdAt.gte = new Date(startDate);
            if (endDate) whereClause.createdAt.lte = new Date(endDate);
        }
        
        // Custom Fields filtering (JSON attribute filtering)
        // Format expected: customFields={"city":"Delhi","plan":"Premium"}
        if (customFields) {
            try {
                const parsedFields = JSON.parse(customFields);
                whereClause.customFields = {
                    path: [],
                    equals: parsedFields
                };
            } catch (e) {
                console.warn("Invalid customFields JSON provided in query");
            }
        }

        const [totalCount, contacts] = await Promise.all([
            prisma.contact.count({ where: whereClause }),
            prisma.contact.findMany({
                where: whereClause,
                skip: skip,
                take: pageSize,
                orderBy: { createdAt: 'desc' }
            })
        ]);

        res.status(200).json({
            data: contacts,
            pagination: {
                total: totalCount,
                page: pageNumber,
                limit: pageSize,
                totalPages: Math.ceil(totalCount / pageSize)
            }
        });
    } catch (e) {
        console.error("Error fetching contacts:", e);
        res.status(500).json({ error: "Failed to fetch contacts" });
    }
});

// 1.5 Get unique groups (tags)
router.get('/groups', authenticate, checkPermission('MANAGE_CONTACTS'), async (req, res) => {
    const userId = req.user.workspaceId;
    try {
        const contacts = await prisma.contact.findMany({
            where: { userId: userId },
            select: { tags: true }
        });

        const groupsSet = new Set();
        contacts.forEach(c => {
            if (c.tags && Array.isArray(c.tags)) {
                c.tags.forEach(t => groupsSet.add(t));
            }
        });

        const groups = Array.from(groupsSet).sort();
        res.status(200).json(groups);
    } catch (e) {
        console.error("Error fetching groups:", e);
        res.status(500).json({ error: "Failed to fetch groups" });
    }
});

// 1.6 Delete a group (remove tag from all contacts)
router.delete('/groups/:groupName', authenticate, checkPermission('MANAGE_CONTACTS'), async (req, res) => {
    const userId = req.user.workspaceId;
    const { groupName } = req.params;

    if (!groupName) {
        return res.status(400).json({ error: "Group name is required." });
    }

    try {
        const contacts = await prisma.contact.findMany({
            where: {
                userId: userId,
                tags: { has: groupName }
            }
        });

        const updatePromises = contacts.map(c => {
            const newTags = c.tags.filter(t => t !== groupName);
            return prisma.contact.update({
                where: { id: c.id },
                data: { tags: newTags }
            });
        });

        await Promise.all(updatePromises);

        res.status(200).json({ success: true, message: `Successfully deleted group '${groupName}' from ${contacts.length} contacts.` });
    } catch (e) {
        console.error("Error deleting contact group:", e);
        res.status(500).json({ error: "Failed to delete contact group" });
    }
});

// 2. Add a single contact
router.post('/add', authenticate, checkPermission('MANAGE_CONTACTS'), enforceContactLimit, async (req, res) => {
    const userId = req.user.workspaceId;
    const { name, phone, email, country, source, tags, customFields } = req.body;

    // Basic validation
    if (!name || !phone) {
        return res.status(400).json({ error: "Name and Phone are required." });
    }

    // Clean phone number (remove all non-digits, then securely prepend one '+')
    let cleanPhone = phone.replace(/[^\d]/g, '');
    if (cleanPhone) {
        cleanPhone = '+' + cleanPhone;
    }

    try {
        const newContact = await prisma.contact.upsert({
            where: {
                userId_phone: {
                    userId: userId,
                    phone: cleanPhone
                }
            },
            update: {
                name: name,
                email: email || undefined,
                country: country || undefined,
                tags: tags || [],
                customFields: customFields || {}
            },
            create: {
                userId: userId,
                name: name,
                phone: cleanPhone,
                email: email,
                country: country,
                source: source || 'Manual Entry',
                tags: tags || [],
                customFields: customFields || {}
            }
        });

        res.status(200).json({ success: true, data: newContact });
    } catch (error) {
        console.error("Error adding contact:", error);
        res.status(500).json({ error: "Failed to add contact." });
    }
});

// 2.5 Get contact events timeline
router.get('/:id/events', authenticate, async (req, res) => {
    const userId = req.user.workspaceId;
    const { id } = req.params;

    try {
        const contact = await prisma.contact.findFirst({
            where: { id: parseInt(id, 10), userId }
        });
        
        if (!contact) {
            return res.status(404).json({ error: "Contact not found" });
        }

        const events = await prisma.contactEvent.findMany({
            where: { contactId: contact.id },
            orderBy: { createdAt: 'desc' },
            take: 100
        });

        res.status(200).json(events);
    } catch (e) {
        console.error("Error fetching contact events:", e);
        res.status(500).json({ error: "Failed to fetch contact events" });
    }
});

// 3. Bulk CSV Import
router.post('/bulk', authenticate, checkPermission('MANAGE_CONTACTS'), enforceContactLimit, async (req, res) => {
    const userId = req.user.workspaceId;
    const { contacts, source } = req.body; // Expecting an array of objects: [{ name, phone, email, country, tags: [] }]

    if (!Array.isArray(contacts) || contacts.length === 0) {
        return res.status(400).json({ error: "Invalid data format. Expected an array of contacts." });
    }

    try {
        let insertedCount = 0;
        let mergedCount = 0;
        let duplicateRows = 0;

        // 1. Prepare valid contacts and extract phones
        const validContacts = [];
        const phones = [];
        for (const c of contacts) {
            let cleanPhone = (c.phone || '').toString().replace(/[^\d]/g, '');
            if (cleanPhone) cleanPhone = '+' + cleanPhone;
            if (!cleanPhone) continue;

            let parsedTags = c.tags;
            if (typeof c.tags === 'string') {
                parsedTags = c.tags.split(',').map(t => t.trim()).filter(t => t);
            } else if (!Array.isArray(c.tags)) {
                parsedTags = [];
            }
            
            validContacts.push({ ...c, cleanPhone, parsedTags });
            phones.push(cleanPhone);
        }

        // 2. Fetch all existing contacts in one go
        const existingContactsList = await prisma.contact.findMany({
            where: { userId, phone: { in: phones } }
        });
        const existingMap = new Map();
        for (const ec of existingContactsList) {
            existingMap.set(ec.phone, ec);
        }

        const toCreate = [];
        const toUpdate = [];

        // 3. Separate into create vs update
        for (const c of validContacts) {
            const ec = existingMap.get(c.cleanPhone);
            if (ec) {
                const mergedTags = Array.from(new Set([...ec.tags, ...c.parsedTags]));
                const mergedCustomFields = {
                    ...(typeof ec.customFields === 'object' ? ec.customFields : {}),
                    ...(typeof c.customFields === 'object' ? c.customFields : {})
                };
                toUpdate.push(
                    prisma.contact.update({
                        where: { id: ec.id },
                        data: {
                            tags: mergedTags,
                            name: c.name && c.name !== 'Unknown' ? c.name : ec.name,
                            email: c.email || ec.email,
                            country: c.country || ec.country,
                            customFields: mergedCustomFields
                        }
                    })
                );
                mergedCount++;
                duplicateRows++;
            } else {
                toCreate.push({
                    userId: userId,
                    name: c.name || 'Unknown',
                    phone: c.cleanPhone,
                    email: c.email,
                    country: c.country,
                    source: source || c.source || 'CSV Import',
                    tags: c.parsedTags,
                    customFields: c.customFields || {}
                });
                insertedCount++;
            }
        }

        // 4. Execute inserts (bulk)
        if (toCreate.length > 0) {
            await prisma.contact.createMany({
                data: toCreate,
                skipDuplicates: true
            });
        }

        // 5. Execute updates (in batches to avoid transaction limits)
        if (toUpdate.length > 0) {
            const batchSize = 100;
            for (let i = 0; i < toUpdate.length; i += batchSize) {
                const batch = toUpdate.slice(i, i + batchSize);
                await prisma.$transaction(batch);
            }
        }

        res.status(200).json({
            success: true,
            message: `Successfully inserted ${insertedCount} new contacts and updated ${mergedCount} existing contacts.`,
            count: insertedCount + mergedCount,
            duplicatesFound: duplicateRows
        });

    } catch (error) {
        console.error("Error bulk importing contacts:", error);
        res.status(500).json({ error: "Failed to bulk import contacts." });
    }
});

// 3.5 Bulk Delete Contacts
router.post('/bulk-delete', authenticate, checkPermission('MANAGE_CONTACTS'), async (req, res) => {
    const userId = req.user.workspaceId;
    const { contactIds } = req.body;

    if (!Array.isArray(contactIds) || contactIds.length === 0) {
        return res.status(400).json({ error: "No contact IDs provided for deletion." });
    }

    try {
        const deleted = await prisma.contact.deleteMany({
            where: {
                id: { in: contactIds },
                userId: userId // Secure closure
            }
        });

        res.status(200).json({ success: true, message: `Successfully deleted ${deleted.count} contacts.` });
    } catch (error) {
        console.error("Error bulk deleting contacts:", error);
        res.status(500).json({ error: "Failed to bulk delete contacts." });
    }
});

// 4. Delete a contact
router.delete('/:id', authenticate, checkPermission('MANAGE_CONTACTS'), async (req, res) => {
    const userId = req.user.workspaceId;
    const contactId = req.params.id; // This is a string from URL

    try {
        const contact = await prisma.contact.findFirst({
            where: {
                id: contactId,
                userId: userId
            }
        });

        if (!contact) {
            return res.status(404).json({ error: "Contact not found" });
        }

        await prisma.contact.delete({
            where: { id: contact.id }
        });

        res.status(200).json({ success: true, message: "Contact deleted successfully" });
    } catch (error) {
        console.error("Error deleting contact:", error);
        res.status(500).json({ error: "Failed to delete contact" });
    }
});

// 5. CSV Export Route
router.get('/export', authenticate, checkPermission('MANAGE_CONTACTS'), async (req, res) => {
    const userId = req.user.workspaceId;
    try {
        const { search = '', tags = '', source = '', startDate, endDate, customFields } = req.query;

        let whereClause = { userId: userId };

        if (search) {
            whereClause.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { phone: { contains: search } },
                { email: { contains: search, mode: 'insensitive' } }
            ];
        }

        if (tags) {
            const tagsArray = tags.split(',').map(t => t.trim());
            whereClause.tags = { hasEvery: tagsArray };
        }

        if (source) {
            whereClause.source = source;
        }

        if (startDate || endDate) {
            whereClause.createdAt = {};
            if (startDate) whereClause.createdAt.gte = new Date(startDate);
            if (endDate) whereClause.createdAt.lte = new Date(endDate);
        }

        if (customFields) {
            try {
                const parsedFields = JSON.parse(customFields);
                whereClause.customFields = {
                    path: [],
                    equals: parsedFields
                };
            } catch (e) { }
        }

        const contacts = await prisma.contact.findMany({
            where: whereClause,
            orderBy: { createdAt: 'desc' }
        });
        
        res.status(200).json(contacts); // Frontend will convert this JSON to CSV
    } catch (e) {
        console.error("Error exporting contacts:", e);
        res.status(500).json({ error: "Failed to export contacts" });
    }
});

module.exports = router;
