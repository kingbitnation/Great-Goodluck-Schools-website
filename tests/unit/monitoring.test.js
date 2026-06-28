const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const {
  getMemoryStats,
  buildHealthReport,
  checkDatabase,
} = require('../../src/backend/lib/monitoring')

describe('monitoring', () => {
  it('getMemoryStats returns positive megabyte values', () => {
    const mem = getMemoryStats()
    assert.ok(mem.rssMb > 0)
    assert.ok(mem.heapUsedMb > 0)
    assert.ok(mem.heapTotalMb > 0)
  })

  it('checkDatabase succeeds with mock prisma', async () => {
    const prisma = {
      $queryRaw: async () => [{ '?column?': 1 }],
    }
    const db = await checkDatabase(prisma)
    assert.equal(db.ok, true)
    assert.ok(db.latencyMs >= 0)
  })

  it('buildHealthReport marks degraded when db is down', async () => {
    const prisma = {
      $queryRaw: async () => {
        throw new Error('connection refused')
      },
      emailQueue: { count: async () => 0 },
      smsQueue: { count: async () => 0 },
    }
    const report = await buildHealthReport(prisma, { detailed: true })
    assert.equal(report.db, false)
    assert.equal(report.status, 'degraded')
    assert.ok(report.queues)
  })
})
