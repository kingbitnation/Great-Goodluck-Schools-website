const { describe, it, before } = require('node:test')
const assert = require('node:assert/strict')
const { request, login } = require('../helpers/http')

let backendUp = false

before(async () => {
  try {
    const res = await request('GET', '/api/health/live')
    backendUp = res.status === 200
  } catch {
    backendUp = false
  }
})

function skipUnlessBackend() {
  if (!backendUp) return true
  return false
}

describe('penetration (live API): cross-tenant IDOR', () => {
  it('student cannot read another school billing dashboard', async (t) => {
    if (skipUnlessBackend()) return t.skip('Backend not running')
    const { authHeader, user } = await login('student@demoschool.edu', 'admin123')
    const foreignSchoolId = '00000000-0000-0000-0000-000000000099'
    const res = await request('GET', `/api/schools/${foreignSchoolId}/billing`, null, authHeader)
    assert.ok([403, 404].includes(res.status), `expected 403/404 got ${res.status}`)
    assert.notEqual(user.role, 'SuperAdmin')
  })

  it('student cannot checkout subscription for foreign school', async (t) => {
    if (skipUnlessBackend()) return t.skip('Backend not running')
    const { authHeader } = await login('student@demoschool.edu', 'admin123')
    const res = await request(
      'POST',
      '/api/schools/00000000-0000-0000-0000-000000000099/subscription/checkout',
      { planSlug: 'starter', billingInterval: 'monthly' },
      authHeader
    )
    assert.ok(res.status === 403 || res.status === 401, `got ${res.status}`)
  })
})

describe('penetration (live API): role escalation', () => {
  it('student cannot access platform metrics', async (t) => {
    if (skipUnlessBackend()) return t.skip('Backend not running')
    const { authHeader } = await login('student@demoschool.edu', 'admin123')
    const res = await request('GET', '/api/platform/metrics', null, authHeader)
    assert.equal(res.status, 403)
  })

  it('student cannot list all schools', async (t) => {
    if (skipUnlessBackend()) return t.skip('Backend not running')
    const { authHeader } = await login('student@demoschool.edu', 'admin123')
    const res = await request('GET', '/api/platform/schools', null, authHeader)
    assert.equal(res.status, 403)
  })

  it('parent cannot approve manual payments (accountant action)', async (t) => {
    if (skipUnlessBackend()) return t.skip('Backend not running')
    const { authHeader } = await login('parent@demoschool.edu', 'admin123')
    const res = await request('GET', '/api/payments/pending-verification', null, authHeader)
    assert.equal(res.status, 403)
  })
})

describe('penetration (live API): removed webhooks', () => {
  it('flutterwave webhook endpoint is not exposed', async (t) => {
    if (skipUnlessBackend()) return t.skip('Backend not running')
    const res = await request('POST', '/api/webhooks/flutterwave', { event: 'charge.completed' })
    assert.equal(res.status, 404)
  })
})

describe('penetration (live API): brute force', () => {
  it('rejects repeated invalid credentials without exposing stack traces', async (t) => {
    if (skipUnlessBackend()) return t.skip('Backend not running')
    const email = `pentest-${Date.now()}@example.com`
    let lastStatus = 0
    for (let i = 0; i < 3; i++) {
      const res = await request('POST', '/api/auth/login', { email, password: 'wrong' })
      lastStatus = res.status
      assert.ok([400, 401, 429].includes(res.status))
      assert.ok(!String(res.body).includes('stack'))
    }
    assert.ok([400, 401, 429].includes(lastStatus))
  })
})
