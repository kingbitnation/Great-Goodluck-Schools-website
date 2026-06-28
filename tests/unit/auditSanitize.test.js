const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const { sanitizeAuditBody, SENSITIVE_KEYS } = require('../../src/backend/lib/auditSanitize')

describe('auditSanitize', () => {
  it('redacts password fields', () => {
    const out = sanitizeAuditBody({ email: 'a@b.com', password: 'secret123' })
    assert.equal(out.email, 'a@b.com')
    assert.equal(out.password, '[REDACTED]')
  })

  it('redacts nested secrets', () => {
    const out = sanitizeAuditBody({ user: { name: 'x', token: 'abc' } })
    assert.equal(out.user.name, 'x')
    assert.equal(out.user.token, '[REDACTED]')
  })

  it('includes common sensitive keys', () => {
    assert.ok(SENSITIVE_KEYS.has('password'))
    assert.ok(SENSITIVE_KEYS.has('vapidPrivateKey'))
  })
})
