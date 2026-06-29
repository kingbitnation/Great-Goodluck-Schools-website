const crypto = require('crypto')

const ALGO = 'aes-256-gcm'

function encryptionKey() {
  const raw = process.env.INTEGRATION_ENCRYPTION_KEY || process.env.JWT_SECRET || 'dev-integration-key-change-me'
  return crypto.createHash('sha256').update(raw).digest()
}

function encryptSecret(plain) {
  if (!plain) return null
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv(ALGO, encryptionKey(), iv)
  const enc = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${iv.toString('base64')}:${tag.toString('base64')}:${enc.toString('base64')}`
}

function decryptSecret(payload) {
  if (!payload) return null
  const [ivB64, tagB64, dataB64] = String(payload).split(':')
  if (!ivB64 || !tagB64 || !dataB64) return null
  const decipher = crypto.createDecipheriv(ALGO, encryptionKey(), Buffer.from(ivB64, 'base64'))
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'))
  const dec = Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()])
  return dec.toString('utf8')
}

module.exports = { encryptSecret, decryptSecret }
