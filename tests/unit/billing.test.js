const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const {
  mergeLimits,
  priceForInterval,
  minimumPlanForFeature,
  comparePlans,
  PLAN_ORDER,
} = require('../../src/backend/lib/planLimits')

describe('planLimits', () => {
  it('starter has correct student limit and no AI', () => {
    const limits = mergeLimits({ slug: 'starter' })
    assert.equal(limits.maxStudents, 300)
    assert.equal(limits.ai, false)
    assert.equal(limits.cbt, false)
  })

  it('professional has AI and is popular tier', () => {
    const limits = mergeLimits({ slug: 'professional' })
    assert.equal(limits.maxStudents, 2000)
    assert.equal(limits.ai, true)
    assert.equal(limits.liveClasses, true)
  })

  it('enterprise unlocks payroll and biometric', () => {
    const limits = mergeLimits({ slug: 'enterprise' })
    assert.equal(limits.payroll, true)
    assert.equal(limits.biometric, true)
    assert.equal(limits.gpsTracking, true)
  })

  it('priceForInterval returns correct quarterly price', () => {
    const plan = { slug: 'starter', price: 25000, quarterlyPrice: 70000, yearlyPrice: 270000 }
    assert.equal(priceForInterval(plan, 'quarterly'), 70000)
    assert.equal(priceForInterval(plan, 'yearly'), 270000)
  })

  it('minimumPlanForFeature returns professional for ai', () => {
    assert.equal(minimumPlanForFeature('ai'), 'professional')
  })

  it('comparePlans detects upgrade path', () => {
    assert.equal(comparePlans('starter', 'professional'), false)
    assert.equal(comparePlans('professional', 'starter'), true)
  })

  it('has five production plan slugs in order', () => {
    assert.deepEqual(PLAN_ORDER, ['starter', 'standard', 'professional', 'enterprise', 'ultimate'])
  })
})

describe('subscriptionHelpers billingPeriodEnd', () => {
  const { billingPeriodEnd } = require('../../src/backend/lib/subscriptionHelpers')
  it('extends monthly period', () => {
    const start = new Date('2026-01-15')
    const end = billingPeriodEnd('monthly', start)
    assert.equal(end.getMonth(), 1)
  })
})
