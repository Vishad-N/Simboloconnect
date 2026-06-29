const express = require('express');
const router = express.Router();
const prisma = require('../prismaClient');
const bcrypt = require('bcryptjs');
const { authenticate } = require('../middleware/auth');
const { enforceTeamMemberLimit } = require('../middleware/planLimits');

// GET all staff members for the current workspace (Admin + all Staff)
router.get('/', authenticate, async (req, res) => {
    // Both ADMIN and STAFF can view the team for chat assignments
    const adminId = req.user.role === 'ADMIN' ? req.user.id : req.user.adminId;

    if (!adminId) {
        return res.status(403).json({ error: "Invalid workspace context." });
    }

    try {
        const staffList = await prisma.user.findMany({
            where: {
                adminId: adminId,
                role: 'STAFF'
            },
            select: {
                id: true,
                name: true,
                email: true,
                permissions: true,
                createdAt: true
            }
        });
        res.status(200).json(staffList);
    } catch (e) {
        console.error("Error fetching staff:", e);
        res.status(500).json({ error: "Failed to fetch staff members." });
    }
});

// POST add new staff member
router.post('/', authenticate, enforceTeamMemberLimit, async (req, res) => {
    if (req.user.role !== 'ADMIN') {
        return res.status(403).json({ error: "Only Admins can add staff." });
    }

    const { name, email, password, permissions } = req.body;

    if (!name || !email || !password) {
        return res.status(400).json({ error: "Name, email, and password are required." });
    }

    try {
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const newStaff = await prisma.user.create({
            data: {
                name,
                email,
                password: hashedPassword,
                role: 'STAFF',
                permissions: permissions || [],
                adminId: req.user.id
            },
            select: { id: true, name: true, email: true, permissions: true }
        });

        res.status(201).json(newStaff);
    } catch (e) {
        console.error("Error adding staff:", e);
        if (e.code === 'P2002') {
            return res.status(400).json({ error: "Email already exists." });
        }
        res.status(500).json({ error: "Failed to add staff member." });
    }
});

// PUT update staff member
router.put('/:id', authenticate, async (req, res) => {
    if (req.user.role !== 'ADMIN') {
        return res.status(403).json({ error: "Only Admins can edit staff." });
    }

    const { name, email, password, permissions } = req.body;
    const staffId = req.params.id;

    try {
        // Ensure staff belongs to this admin
        const existingStaff = await prisma.user.findFirst({
            where: { id: staffId, adminId: req.user.id }
        });

        if (!existingStaff) {
            return res.status(404).json({ error: "Staff member not found." });
        }

        const updateData = {
            name,
            email,
            permissions
        };

        if (password) {
            const salt = await bcrypt.genSalt(10);
            updateData.password = await bcrypt.hash(password, salt);
        }

        const updatedStaff = await prisma.user.update({
            where: { id: staffId },
            data: updateData,
            select: { id: true, name: true, email: true, permissions: true }
        });

        res.status(200).json(updatedStaff);
    } catch (e) {
        console.error("Error updating staff:", e);
        res.status(500).json({ error: "Failed to update staff member." });
    }
});

// DELETE remove staff member
router.delete('/:id', authenticate, async (req, res) => {
    if (req.user.role !== 'ADMIN') {
        return res.status(403).json({ error: "Only Admins can remove staff." });
    }

    try {
        // Ensure staff belongs to this admin
        const existingStaff = await prisma.user.findFirst({
            where: { id: req.params.id, adminId: req.user.id }
        });

        if (!existingStaff) {
            return res.status(404).json({ error: "Staff member not found." });
        }

        await prisma.user.delete({
            where: { id: req.params.id }
        });

        res.status(200).json({ message: "Staff member deleted." });
    } catch (e) {
        console.error("Error deleting staff:", e);
        res.status(500).json({ error: "Failed to delete staff member." });
    }
});

module.exports = router;
