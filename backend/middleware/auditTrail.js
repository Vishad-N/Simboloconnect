/**
 * auditTrail.js
 * Phase B — Immutable audit trail middleware for all payment and commerce actions.
 * Logs every critical action (payment link creation, order creation, etc.) to the AuditTrail table.
 */
const prisma = require('../prismaClient');

/**
 * Log a commerce action to the immutable AuditTrail table.
 * @param {Object} params
 * @param {string} params.userId - Workspace ID
 * @param {string} params.actor - 'system' | 'ai' | 'webhook' | 'api' | contactPhone
 * @param {string} params.action - e.g. 'payment_link_created', 'order_created'
 * @param {string} params.entityType - 'CheckoutSession' | 'EcomOrder' | etc.
 * @param {string} params.entityId
 * @param {Object} [params.before] - State before the action
 * @param {Object} [params.after] - State after the action
 * @param {Object} [params.metadata]
 * @param {string} [params.ip]
 */
async function logAudit(params) {
    const { userId, actor, action, entityType, entityId, before, after, metadata, ip } = params;
    try {
        await prisma.auditTrail.create({
            data: {
                userId,
                actor: actor || 'system',
                action,
                entityType,
                entityId,
                before: before || null,
                after: after || null,
                ip: ip || null,
                metadata: metadata || {}
            }
        });
    } catch (e) {
        // Audit log failure must NEVER crash the main operation
        console.error('[AuditTrail] Failed to write audit log:', e.message);
    }
}

/**
 * Express middleware factory for route-level audit logging.
 * Usage: router.post('/payment', auditMiddleware('payment_link_created', 'CheckoutSession'), handler)
 */
function auditMiddleware(action, entityType) {
    return async (req, res, next) => {
        // Store original res.json to intercept the response
        const originalJson = res.json.bind(res);
        res.json = function (data) {
            // Log after response is determined
            const userId = req.user?.id || 'unknown';
            const entityId = data?.id || data?.sessionId || 'unknown';
            logAudit({
                userId,
                actor: 'api',
                action,
                entityType,
                entityId,
                after: data,
                ip: req.ip,
                metadata: { method: req.method, path: req.path }
            }).catch(() => {});
            return originalJson(data);
        };
        next();
    };
}

module.exports = { logAudit, auditMiddleware };
