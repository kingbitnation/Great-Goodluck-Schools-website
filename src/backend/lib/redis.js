let client = null
let warned = false

function getRedis() {
  if (client !== null) return client
  const url = process.env.REDIS_URL
  if (!url) return null
  try {
    const Redis = require('ioredis')
    client = new Redis(url, { maxRetriesPerRequest: 1, lazyConnect: true })
    client.on('error', (err) => {
      if (!warned) {
        console.warn('Redis error — falling back to in-memory:', err.message)
        warned = true
      }
    })
    return client
  } catch {
    if (!warned) {
      console.warn('ioredis not installed — set REDIS_URL after npm install ioredis for distributed caching')
      warned = true
    }
    return null
  }
}

async function cacheGet(key) {
  const redis = getRedis()
  if (!redis) return null
  try {
    if (redis.status !== 'ready') await redis.connect()
    return redis.get(key)
  } catch {
    return null
  }
}

async function cacheSet(key, value, ttlSeconds = 300) {
  const redis = getRedis()
  if (!redis) return false
  try {
    if (redis.status !== 'ready') await redis.connect()
    await redis.set(key, value, 'EX', ttlSeconds)
    return true
  } catch {
    return false
  }
}

function redisRateLimitStore() {
  const redis = getRedis()
  if (!redis) return null

  return {
    async increment(key) {
      try {
        if (redis.status !== 'ready') await redis.connect()
        const count = await redis.incr(key)
        if (count === 1) await redis.expire(key, 900)
        const ttl = await redis.pttl(key)
        return { totalHits: count, resetTime: new Date(Date.now() + ttl) }
      } catch {
        return { totalHits: 1, resetTime: new Date(Date.now() + 900000) }
      }
    },
  }
}

module.exports = { getRedis, cacheGet, cacheSet, redisRateLimitStore }
