const SENSITIVE_KEYS = new Set([
  'password',
  'currentPassword',
  'newPassword',
  'confirmPassword',
  'token',
  'refreshToken',
  'secret',
  'twoFactorSecret',
  'termiiApiKey',
  'twilioAuthToken',
  'vapidPrivateKey',
  'paystackSecretKey',
  'flutterwaveSecretKey',
  'stripeSecretKey',
  'apiKey',
  'authorization',
])

function sanitizeAuditBody(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return body
  const out = {}
  for (const [key, value] of Object.entries(body)) {
    if (SENSITIVE_KEYS.has(key)) {
      out[key] = '[REDACTED]'
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      out[key] = sanitizeAuditBody(value)
    } else {
      out[key] = value
    }
  }
  return out
}

module.exports = { sanitizeAuditBody, SENSITIVE_KEYS }
