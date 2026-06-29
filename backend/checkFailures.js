const prisma = require('./prismaClient');
async function run() {
  const logs = await prisma.messageLog.findMany({
    where: { status: 'FAILED' },
    orderBy: { timestamp: 'desc' },
    take: 20
  });
  logs.forEach(l => {
    let reason = 'Unknown';
    try {
       const c = typeof l.content === 'string' ? JSON.parse(l.content) : l.content;
       if (c && c.failureReason) reason = c.failureReason;
    } catch(e){}
    console.log(`[${l.timestamp.toISOString()}] ${l.recipient} - FAILED: ${reason}`);
  });
}
run().catch(console.error).finally(()=>process.exit(0));
