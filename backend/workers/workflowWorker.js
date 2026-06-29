const { Worker, Queue } = require('bullmq');
const redisConnection = require('../services/redisConnection');
const FlowEngine = require('../services/FlowEngine');
const prisma = require('../prismaClient');

const queueName = 'workflowExecutionQueue';
const workflowQueue = new Queue(queueName, { connection: redisConnection });

const workflowWorker = new Worker(queueName, async job => {
    const { flowId, userId, contactPhone, incomingMessage, phoneNumberId, stateData, currentNodeId, executionSteps } = job.data;
    
    console.log(`[Workflow Engine] Resuming flow ${flowId} at node ${currentNodeId} for ${contactPhone}`);

    const flow = await prisma.visualFlow.findUnique({ where: { id: flowId } });
    if (!flow || !flow.isActive) return;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return;

    const nodes = typeof flow.nodes === 'string' ? JSON.parse(flow.nodes) : (flow.nodes || []);
    const edges = typeof flow.edges === 'string' ? JSON.parse(flow.edges) : (flow.edges || []);

    let current = currentNodeId;
    let state = stateData || {};
    let steps = executionSteps || [];
    let safety = 0;

    // Use existing FlowEngine executeNode logic, but wrapped in a detached loop
    // Note: We avoid circular dependencies by importing dynamically if needed
    const { executeNode } = require('../services/FlowEngineNodeRunner'); 

    while (current && safety < 100) { // Infinite loop protection
        safety++;
        const node = nodes.find(n => n.id === current);
        if (!node) break;

        const step = { nodeId: node.id, type: node.type, ts: Date.now() };

        try {
            const result = await executeNode(node, edges, user, phoneNumberId, contactPhone, incomingMessage, state, flowId);

            step.status = 'ok';
            state = result.stateData || state;
            steps.push(step);

            if (result.waitReply) {
                await prisma.flowSession.upsert({
                    where: { userId_contactPhone: { userId, contactPhone } },
                    update: { flowId, currentNodeId: result.currentNodeId, stateData: state, status: 'WAITING_REPLY', updatedAt: new Date() },
                    create: { userId, contactPhone, flowId, currentNodeId: result.currentNodeId, stateData: state, status: 'WAITING_REPLY' }
                });
                break;
            }

            if (result.done || !result.nextEdge) {
                // Flow Ended
                break;
            }

            // Delay Node: Pause and re-enqueue instead of blocking memory
            if (node.type === 'delayNode') {
                const amount = parseInt(node.data?.amount || 1);
                const unit = node.data?.unit || 'seconds';
                const ms = unit === 'minutes' ? amount * 60000 : unit === 'hours' ? amount * 3600000 : amount * 1000;
                
                await workflowQueue.add('resumeFlow', {
                    flowId, userId, contactPhone, incomingMessage, phoneNumberId, stateData: state,
                    currentNodeId: result.nextEdge.target, executionSteps: steps
                }, { delay: ms });

                console.log(`[Workflow Engine] Pausing execution for ${ms}ms. Job queued.`);
                return; // Exit this worker job
            }

            current = result.nextEdge.target;
        } catch (err) {
            step.status = 'error';
            step.error = err.message;
            steps.push(step);
            console.error(`[Workflow Engine] Node execution failed:`, err.message);
            break;
        }
    }

    // Log Execution
    try {
        await prisma.flowExecution.create({
            data: {
                userId,
                flowId,
                contactPhone,
                trigger: incomingMessage || '',
                status: steps.some(s => s.status === 'error') ? 'FAILED' : 'COMPLETED',
                steps: steps,
                durationMs: Date.now() - job.timestamp,
            }
        });
    } catch (e) {
        console.warn('[Workflow Engine] Execution log skipped:', e.message);
    }

}, { connection: redisConnection, concurrency: 50 });

workflowWorker.on('failed', (job, err) => {
    console.error(`[Workflow Engine] Job ${job.id} failed:`, err.message);
});

module.exports = { workflowQueue, workflowWorker };
