const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const { normalizeDomain, verificationHost, generateVerificationToken } = require('../../src/backend/lib/domainHelpers')
const { billingPeriodEnd } = require('../../src/backend/lib/referralHelpers')

describe('domainHelpers', () => {
  it('normalizes domain strings', () => {
    assert.equal(normalizeDomain('HTTPS://Portal.School.edu/'), 'portal.school.edu')
  })

  it('builds verification host', () => {
    assert.equal(verificationHost('school.edu'), '_schoolpilot-verify.school.edu')
  })

  it('generates verification token', () => {
    const t = generateVerificationToken()
    assert.ok(t.startsWith('ggs-verify-'))
  })
})

describe('referralHelpers billingPeriodEnd', () => {
  it('extends monthly by one month', () => {
    const start = new Date('2026-01-15')
    const end = billingPeriodEnd('monthly', start)
    assert.equal(end.getMonth(), 1)
  })

  it('extends yearly by one year', () => {
    const start = new Date('2026-01-15')
    const end = billingPeriodEnd('yearly', start)
    assert.equal(end.getFullYear(), 2027)
  })
})
