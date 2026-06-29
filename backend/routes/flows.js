const express = require('express');
const router = express.Router();
const prisma = require('../prismaClient');
const { authenticate } = require('../middleware/auth');
const FlowEngine = require('../services/FlowEngine');

router.use(authenticate);

// ─── PROJECTS ─────────────────────────────────────────────────────────────────

// GET all projects
router.get('/projects', async (req, res) => {
    try {
        const projects = await prisma.flowProject.findMany({
            where: { userId: req.user.workspaceId, isArchived: false },
            orderBy: { createdAt: 'desc' },
            include: {
                flows: {
                    select: { id: true, name: true, status: true, isActive: true, updatedAt: true },
                    orderBy: { updatedAt: 'desc' }
                }
            }
        });
        res.json(projects);
    } catch (error) {
        console.error("Error fetching projects:", error);
        res.status(500).json({ error: "Failed to fetch projects" });
    }
});

// POST create project
router.post('/projects', async (req, res) => {
    try {
        const { name, description, color } = req.body;
        if (!name?.trim()) return res.status(400).json({ error: "Project name is required" });

        const project = await prisma.flowProject.create({
            data: {
                userId: req.user.workspaceId,
                name: name.trim(),
                description: description?.trim() || null,
                color: color || '#00d9a5'
            }
        });
        res.json(project);
    } catch (error) {
        console.error("Error creating project:", error);
        res.status(500).json({ error: "Failed to create project" });
    }
});

// PUT update project
router.put('/projects/:id', async (req, res) => {
    try {
        const { name, description, color, isArchived } = req.body;
        const project = await prisma.flowProject.update({
            where: { id: req.params.id, userId: req.user.workspaceId },
            data: { name, description, color, isArchived }
        });
        res.json(project);
    } catch (error) {
        console.error("Error updating project:", error);
        res.status(500).json({ error: "Failed to update project" });
    }
});

// DELETE project
router.delete('/projects/:id', async (req, res) => {
    try {
        // Detach flows first
        await prisma.visualFlow.updateMany({
            where: { projectId: req.params.id, userId: req.user.workspaceId },
            data: { projectId: null }
        });
        await prisma.flowProject.delete({
            where: { id: req.params.id, userId: req.user.workspaceId }
        });
        res.json({ success: true });
    } catch (error) {
        console.error("Error deleting project:", error);
        res.status(500).json({ error: "Failed to delete project" });
    }
});

// ─── FLOWS ────────────────────────────────────────────────────────────────────

// GET all flows (optionally filtered by project)
router.get('/', async (req, res) => {
    try {
        const { projectId } = req.query;
        const where = { userId: req.user.workspaceId };
        if (projectId) where.projectId = projectId;

        const flows = await prisma.visualFlow.findMany({
            where,
            orderBy: { updatedAt: 'desc' },
            select: {
                id: true, name: true, trigger: true, status: true, isActive: true,
                projectId: true, description: true, createdAt: true, updatedAt: true,
                _count: { select: { executions: true } }
            }
        });
        res.json(flows);
    } catch (error) {
        console.error("Error fetching flows:", error);
        res.status(500).json({ error: "Failed to fetch flows" });
    }
});

// GET a single flow by ID (full data including nodes/edges)
router.get('/:id', async (req, res) => {
    try {
        const flow = await prisma.visualFlow.findUnique({
            where: { id: req.params.id, userId: req.user.workspaceId }
        });
        if (!flow) return res.status(404).json({ error: "Flow not found" });
        res.json(flow);
    } catch (error) {
        console.error("Error fetching flow:", error);
        res.status(500).json({ error: "Failed to fetch flow" });
    }
});

// POST create a new flow
router.post('/', async (req, res) => {
    try {
        const { name, trigger, nodes, edges, isActive, status, projectId, description } = req.body;

        const flow = await prisma.visualFlow.create({
            data: {
                userId: req.user.workspaceId,
                name: name || 'Untitled Flow',
                trigger: trigger || 'ALL_MESSAGES',
                nodes: nodes || [],
                edges: edges || [],
                isActive: isActive || false,
                status: status || 'DRAFT',
                projectId: projectId || null,
                description: description || null
            }
        });
        res.json(flow);
    } catch (error) {
        console.error("Error creating flow:", error);
        res.status(500).json({ error: "Failed to create flow" });
    }
});

// PUT update a flow (save draft)
router.put('/:id', async (req, res) => {
    try {
        const { name, trigger, nodes, edges, isActive, status, projectId, description } = req.body;

        const flow = await prisma.visualFlow.update({
            where: { id: req.params.id, userId: req.user.workspaceId },
            data: {
                ...(name !== undefined && { name }),
                ...(trigger !== undefined && { trigger }),
                ...(nodes !== undefined && { nodes }),
                ...(edges !== undefined && { edges }),
                ...(isActive !== undefined && { isActive }),
                ...(status !== undefined && { status }),
                ...(projectId !== undefined && { projectId }),
                ...(description !== undefined && { description }),
            }
        });
        res.json(flow);
    } catch (error) {
        console.error("Error updating flow:", error);
        res.status(500).json({ error: "Failed to update flow" });
    }
});

// POST Publish a flow (activate it)
router.post('/:id/publish', async (req, res) => {
    try {
        const flow = await prisma.visualFlow.update({
            where: { id: req.params.id, userId: req.user.workspaceId },
            data: { isActive: true, status: 'PUBLISHED' }
        });
        res.json({ success: true, flow });
    } catch (error) {
        console.error("Error publishing flow:", error);
        res.status(500).json({ error: "Failed to publish flow" });
    }
});

// POST Pause a flow
router.post('/:id/pause', async (req, res) => {
    try {
        const flow = await prisma.visualFlow.update({
            where: { id: req.params.id, userId: req.user.workspaceId },
            data: { isActive: false, status: 'PAUSED' }
        });
        res.json({ success: true, flow });
    } catch (error) {
        console.error("Error pausing flow:", error);
        res.status(500).json({ error: "Failed to pause flow" });
    }
});

// POST Duplicate a flow
router.post('/:id/duplicate', async (req, res) => {
    try {
        const original = await prisma.visualFlow.findUnique({
            where: { id: req.params.id, userId: req.user.workspaceId }
        });
        if (!original) return res.status(404).json({ error: "Flow not found" });

        const copy = await prisma.visualFlow.create({
            data: {
                userId: req.user.workspaceId,
                name: `${original.name} (Copy)`,
                trigger: original.trigger,
                nodes: original.nodes,
                edges: original.edges,
                isActive: false,
                status: 'DRAFT',
                projectId: original.projectId,
                description: original.description
            }
        });
        res.json(copy);
    } catch (error) {
        console.error("Error duplicating flow:", error);
        res.status(500).json({ error: "Failed to duplicate flow" });
    }
});

// POST Test a flow (real simulation without sending messages)
router.post('/:id/test', async (req, res) => {
    try {
        const { message } = req.body;
        if (!message?.trim()) {
            return res.status(400).json({ error: "Test message is required" });
        }

        const flow = await prisma.visualFlow.findUnique({
            where: { id: req.params.id, userId: req.user.workspaceId }
        });
        if (!flow) return res.status(404).json({ error: "Flow not found" });

        // Run simulation (no real messages sent)
        const user = await prisma.user.findUnique({ where: { id: req.user.workspaceId } });
        const result = await FlowEngine.testFlow(flow, message, user);
        
        res.json(result);
    } catch (error) {
        console.error("Error testing flow:", error);
        res.status(500).json({ error: "Failed to test flow: " + error.message });
    }
});

// GET Execution logs for a flow
router.get('/:id/executions', async (req, res) => {
    try {
        const { limit = 50, page = 1 } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);

        const [executions, total] = await Promise.all([
            prisma.flowExecution.findMany({
                where: { flowId: req.params.id, userId: req.user.workspaceId },
                orderBy: { createdAt: 'desc' },
                take: parseInt(limit),
                skip
            }),
            prisma.flowExecution.count({
                where: { flowId: req.params.id, userId: req.user.workspaceId }
            })
        ]);

        res.json({ executions, total, page: parseInt(page), limit: parseInt(limit) });
    } catch (error) {
        // Table might not exist yet
        if (error.message?.includes('does not exist')) {
            return res.json({ executions: [], total: 0 });
        }
        res.status(500).json({ error: "Failed to fetch executions" });
    }
});

// GET All executions for user (dashboard overview)
router.get('/executions/all', async (req, res) => {
    try {
        const { limit = 20 } = req.query;
        const executions = await prisma.flowExecution.findMany({
            where: { userId: req.user.workspaceId },
            orderBy: { createdAt: 'desc' },
            take: parseInt(limit),
            include: { flow: { select: { name: true } } }
        });
        res.json(executions);
    } catch (error) {
        if (error.message?.includes('does not exist')) return res.json([]);
        res.status(500).json({ error: "Failed to fetch executions" });
    }
});

// DELETE a flow
router.delete('/:id', async (req, res) => {
    try {
        await prisma.visualFlow.delete({
            where: { id: req.params.id, userId: req.user.workspaceId }
        });
        await prisma.flowSession.deleteMany({
            where: { flowId: req.params.id, userId: req.user.workspaceId }
        });
        res.json({ success: true });
    } catch (error) {
        console.error("Error deleting flow:", error);
        res.status(500).json({ error: "Failed to delete flow" });
    }
});

module.exports = router;
