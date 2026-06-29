const crypto = require('crypto')

const KEY_PREFIX = 'sp_live_'

function hashApiKey(rawKey) {
  return crypto.createHash('sha256').update(String(rawKey)).digest('hex')
}

function generateApiKey() {
  const secret = crypto.randomBytes(24).toString('hex')
  const rawKey = `${KEY_PREFIX}${secret}`
  const keyPrefix = rawKey.slice(0, 16)
  return { rawKey, keyPrefix, keyHash: hashApiKey(rawKey) }
}

function generateWebhookSecret() {
  return crypto.randomBytes(32).toString('hex')
}

function signWebhookPayload(secret, payload) {
  const body = typeof payload === 'string' ? payload : JSON.stringify(payload)
  const sig = crypto.createHmac('sha256', secret).update(body).digest('hex')
  return `sha256=${sig}`
}

module.exports = {
  KEY_PREFIX,
  hashApiKey,
  generateApiKey,
  generateWebhookSecret,
  signWebhookPayload,
}
