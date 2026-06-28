const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const { mergeLimits, priceForInterval, resolvePlanSlug, planFeaturesFromLimits } = require('../../src/backend/lib/planLimits')

describe('planLimits', () => {
  it('resolves legacy slugs', () => {
    assert.equal(resolvePlanSlug('basic'), 'starter')
    assert.equal(resolvePlanSlug('premium'), 'professional')
    assert.equal(resolvePlanSlug('standard'), 'standard')
  })

  it('merges starter limits', () => {
    const limits = mergeLimits({ slug: 'starter', limits: {} })
    assert.equal(limits.maxStudents, 300)
    assert.equal(limits.aiCredits, 0)
    assert.equal(limits.marketplace, false)
  })

  it('merges ultimate unlimited students', () => {
    const limits = mergeLimits({ slug: 'ultimate' })
    assert.equal(limits.maxStudents, null)
    assert.equal(limits.aiCredits, 10000)
    assert.equal(limits.customDomain, true)
  })

  it('priceForInterval picks yearly price', () => {
    const plan = { price: 100, quarterlyPrice: 270, yearlyPrice: 960 }
    assert.equal(priceForInterval(plan, 'yearly'), 960)
    assert.equal(priceForInterval(plan, 'quarterly'), 270)
    assert.equal(priceForInterval(plan, 'monthly'), 100)
  })

  it('planFeaturesFromLimits', () => {
    const enabled = planFeaturesFromLimits({ aiCredits: 100, lms: true })
    assert.equal(enabled.lms, true)
    assert.equal(enabled.ai, true)
    assert.equal(enabled.marketplace, false)

    const disabled = planFeaturesFromLimits({ aiCredits: 0, lms: false })
    assert.equal(disabled.lms, false)
    assert.equal(disabled.ai, false)
  })
})
