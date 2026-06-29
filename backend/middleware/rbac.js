// middleware/rbac.js

/**
 * Middleware to check if the authenticated user has a specific permission.
 * Admins bypass this check and always have access.
 * 
 * @param {string} permission - The required permission (e.g., 'MANAGE_CAMPAIGNS')
 */
const checkPermission = (permission) => {
    return (req, res, next) => {
        // Ensure user is authenticated
        if (!req.user) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        // SUPERADMIN and ADMINs always have full access
        if (req.user.role === 'SUPERADMIN' || req.user.role === 'ADMIN') {
            return next();
        }

        // Check if STAFF has the required permission
        if (req.user.role === 'STAFF') {
            const permissions = req.user.permissions || [];
            if (permissions.includes(permission)) {
                return next();
            } else {
                return res.status(403).json({ error: `Forbidden: Requires ${permission} permission.` });
            }
        }

        // Fallback for unknown roles
        return res.status(403).json({ error: "Forbidden: Access denied." });
    };
};

module.exports = checkPermission;
