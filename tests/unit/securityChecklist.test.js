const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const { validateProductionSecrets, isWeakSecret, generateSecret } = require('../../src/backend/lib/securityConfig')
const { hashRefreshToken } = require('../../src/backend/lib/refreshTokenStore')
const { sanitizeHtml } = require('../../src/backend/lib/htmlSanitize')
const { sanitizeAuditBody } = require('../../src/backend/lib/auditSanitize')

describe('securityConfig', () => {
  it('rejects weak production secrets', () => {
    const result = validateProductionSecrets({
      NODE_ENV: 'production',
      JWT_SECRET: 'dev_secret_change_me',
      REFRESH_SECRET: 'another_valid_secret_that_is_long_enough_12345',
      TRUST_PROXY: 'true',
    })
    assert.equal(result.ok, false)
    assert.ok(result.errors.some((e) => e.includes('JWT_SECRET')))
  })

  it('accepts strong distinct secrets', () => {
    const result = validateProductionSecrets({
      NODE_ENV: 'production',
      JWT_SECRET: generateSecret(),
      REFRESH_SECRET: generateSecret(),
      TRUST_PROXY: 'true',
    })
    assert.equal(result.ok, true)
  })

  it('flags dev defaults as weak', () => {
    assert.equal(isWeakSecret('dev_secret_change_me'), true)
    assert.equal(isWeakSecret(generateSecret()), false)
  })
})

describe('refreshTokenStore', () => {
  it('hashes tokens deterministically', () => {
    const t = 'sample-refresh-token'
    assert.equal(hashRefreshToken(t), hashRefreshToken(t))
    assert.notEqual(hashRefreshToken(t), t)
  })
})

describe('htmlSanitize', () => {
  it('removes script tags from CMS HTML', () => {
    const dirty = '<p>Hello</p><script>alert(1)</script>'
    assert.equal(sanitizeHtml(dirty), '<p>Hello</p>')
  })

  it('removes inline event handlers', () => {
    const dirty = '<img src="x" onerror="alert(1)" />'
    assert.ok(!sanitizeHtml(dirty).includes('onerror'))
  })
})

describe('auditSanitize', () => {
  it('redacts password fields', () => {
    const out = sanitizeAuditBody({ email: 'a@b.com', password: 'secret123' })
    assert.equal(out.password, '[REDACTED]')
    assert.equal(out.email, 'a@b.com')
  })
})

describe('uploadHelpers', () => {
  it('rejects disallowed MIME types', async () => {
    const { storeLocalUpload } = require('../../src/backend/lib/uploadHelpers')
    const evil = Buffer.from('MZ').toString('base64')
    await assert.rejects(
      () => storeLocalUpload({ fileBase64: `data:application/x-msdownload;base64,${evil}`, folder: 'test' }),
      /not allowed/
    )
  })
})
