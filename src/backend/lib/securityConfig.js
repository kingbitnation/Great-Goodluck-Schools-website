const crypto = require('crypto')

const DEV_SECRETS = new Set([
  'dev_secret_change_me',
  'dev_refresh_change_me',
  'test_secret_ci',
  'test_refresh_ci',
  'secret',
  'changeme',
])

const MIN_SECRET_LENGTH = 32

function isWeakSecret(value) {
  if (!value || typeof value !== 'string') return true
  if (value.length < MIN_SECRET_LENGTH) return true
  if (DEV_SECRETS.has(value)) return true
  return false
}

function validateProductionSecrets(env = process.env) {
  const errors = []
  const warnings = []

  if (env.NODE_ENV === 'production') {
    if (isWeakSecret(env.JWT_SECRET)) {
      errors.push(`JWT_SECRET must be unique and at least ${MIN_SECRET_LENGTH} characters (not a dev default)`)
    }
    if (isWeakSecret(env.REFRESH_SECRET)) {
      errors.push(`REFRESH_SECRET must be unique and at least ${MIN_SECRET_LENGTH} characters (not a dev default)`)
    }
    if (env.JWT_SECRET === env.REFRESH_SECRET) {
      errors.push('JWT_SECRET and REFRESH_SECRET must be different values')
    }
    if (env.TRUST_PROXY !== 'true') {
      warnings.push('TRUST_PROXY should be "true" when behind a reverse proxy in production')
    }
  }

  return { ok: errors.length === 0, errors, warnings }
}

function assertProductionSecrets(env = process.env) {
  const result = validateProductionSecrets(env)
  for (const w of result.warnings) {
    console.warn(`[security] ${w}`)
  }
  if (!result.ok) {
    const msg = result.errors.join('; ')
    throw new Error(`Production security configuration invalid: ${msg}`)
  }
}

function generateSecret(bytes = 48) {
  return crypto.randomBytes(bytes).toString('base64url')
}

module.exports = {
  DEV_SECRETS,
  MIN_SECRET_LENGTH,
  isWeakSecret,
  validateProductionSecrets,
  assertProductionSecrets,
  generateSecret,
}
