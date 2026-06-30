const { processEmailQueue } = require('./emailQueue')
const { processSmsQueue } = require('./smsQueue')

const LOCK_KEY = 'schoolpilot:queue:lock'
const LOCK_TTL_SEC = 25

let redisClient = null
let redisReady = false

function tryConnectRedis() {
  const url = process.env.REDIS_URL
  if (!url || redisClient) return redisClient

  try {
    // eslint-disable-next-line global-require, import/no-extraneous-dependencies
    const Redis = require('ioredis')
    redisClient = new Redis(url, { maxRetriesPerRequest: 1, lazyConnect: true })
    redisClient.on('error', (err) => {
      console.warn('[queue-worker] Redis error:', err.message)
      redisReady = false
    })
    redisClient.connect?.().then(() => {
      redisReady = true
      console.log('[queue-worker] Redis connected — distributed queue mode enabled')
    }).catch(() => {
      redisReady = false
    })
  } catch {
    redisClient = null
  }
  return redisClient
}

async function acquireLock() {
  const client = tryConnectRedis()
  if (!client || !redisReady) return true
  try {
    const result = await client.set(LOCK_KEY, process.pid, 'EX', LOCK_TTL_SEC, 'NX')
    return result === 'OK'
  } catch {
    return true
  }
}

async function processQueuesOnce() {
  const gotLock = await acquireLock()
  if (!gotLock) return { skipped: true }

  const [email, sms] = await Promise.all([
    processEmailQueue().catch((err) => {
      console.error('[queue-worker] email error:', err.message)
      return { processed: 0, sent: 0, failed: 0 }
    }),
    processSmsQueue().catch((err) => {
      console.error('[queue-worker] sms error:', err.message)
      return { processed: 0, sent: 0, failed: 0 }
    }),
  ])
  return { email, sms }
}

function startQueueWorker(intervalMs = 30000) {
  tryConnectRedis()
  const tick = () => processQueuesOnce().catch((err) => console.error('[queue-worker]', err.message))
  tick()
  return setInterval(tick, intervalMs)
}

module.exports = { startQueueWorker, processQueuesOnce, tryConnectRedis }
