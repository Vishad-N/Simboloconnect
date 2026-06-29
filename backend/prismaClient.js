const { PrismaClient } = require('@prisma/client');

// Initialize Prisma Client with optimized connection pool
// connection_limit=20 prevents request queuing under load
const prisma = new PrismaClient({
    log: process.env.NODE_ENV !== 'production' ? ['error'] : ['error'],
    datasources: {
        db: {
            url: process.env.DATABASE_URL + (
                process.env.DATABASE_URL?.includes('connection_limit') ? '' : '&connection_limit=20&pool_timeout=20'
            )
        }
    }
});

module.exports = prisma;
