const { version } = require('../../../package.json')

const startedAt = Date.now()

async function checkDatabase(prisma) {
  const t0 = Date.now()
  try {
    await prisma.$queryRaw`SELECT 1`
    return { ok: true, latencyMs: Date.now() - t0 }
  } catch (err) {
    return { ok: false, latencyMs: null, error: err.message }
  }
}

async function getQueueStats(prisma) {
  try {
    const [emailPending, smsPending, emailFailed, smsFailed] = await Promise.all([
      prisma.emailQueue.count({ where: { status: 'pending' } }),
      prisma.smsQueue.count({ where: { status: 'pending' } }),
      prisma.emailQueue.count({ where: { status: 'failed' } }),
      prisma.smsQueue.count({ where: { status: 'failed' } }),
    ])
    return { emailPending, smsPending, emailFailed, smsFailed }
  } catch {
    return { emailPending: 0, smsPending: 0, emailFailed: 0, smsFailed: 0 }
  }
}

function getMemoryStats() {
  const mem = process.memoryUsage()
  return {
    rssMb: Math.round(mem.rss / 1024 / 1024),
    heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
    heapTotalMb: Math.round(mem.heapTotal / 1024 / 1024),
  }
}

async function buildHealthReport(prisma, { detailed = false } = {}) {
  const db = await checkDatabase(prisma)
  const report = {
    status: db.ok ? 'ok' : 'degraded',
    version,
    uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
    timestamp: new Date().toISOString(),
    backend: 'running',
    db: db.ok,
    dbLatencyMs: db.latencyMs,
    nodeEnv: process.env.NODE_ENV || 'development',
  }

  if (detailed) {
    report.queues = await getQueueStats(prisma)
    report.memory = getMemoryStats()
    report.pid = process.pid
  }

  return report
}

module.exports = {
  buildHealthReport,
  checkDatabase,
  getQueueStats,
  getMemoryStats,
}
