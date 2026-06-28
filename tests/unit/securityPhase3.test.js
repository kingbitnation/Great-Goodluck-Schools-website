const { describe, it, mock } = require('node:test')
const assert = require('node:assert/strict')
const { MODULE_ROUTES } = require('../../src/backend/middleware/moduleFeatureGuard')

describe('moduleFeatureGuard', () => {
  it('maps marketplace prefix', () => {
    const m = MODULE_ROUTES.find((r) => r.prefix === '/api/marketplace')
    assert.equal(m.key, 'marketplace')
  })

  it('maps ai prefix', () => {
    const m = MODULE_ROUTES.find((r) => r.prefix === '/api/ai/')
    assert.equal(m.key, 'ai')
  })
})

describe('csrf issueCsrfToken', () => {
  it('returns hex token', () => {
    const { issueCsrfToken } = require('../../src/backend/middleware/csrf')
    const headers = []
    const res = { setHeader: (k, v) => headers.push([k, v]) }
    const token = issueCsrfToken(res)
    assert.match(token, /^[a-f0-9]{48}$/)
    assert.ok(headers.some(([k]) => k === 'Set-Cookie'))
  })
})
