const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const { applyAdjustments } = require('../../src/backend/lib/financeHelpers')

describe('financeHelpers.applyAdjustments', () => {
  it('applies percent scholarship discount', () => {
    const result = applyAdjustments(100000, [
      { type: 'scholarship', value: 10, isPercent: true, isActive: true },
    ])
    assert.equal(result.netAmount, 90000)
    assert.equal(result.discountApplied, 10000)
  })

  it('applies fixed penalty', () => {
    const result = applyAdjustments(50000, [
      { type: 'penalty', value: 2500, isPercent: false, isActive: true },
    ])
    assert.equal(result.netAmount, 52500)
    assert.equal(result.penaltyApplied, 2500)
  })

  it('ignores inactive adjustments', () => {
    const result = applyAdjustments(50000, [
      { type: 'waiver', value: 10000, isPercent: false, isActive: false },
    ])
    assert.equal(result.netAmount, 50000)
  })

  it('never returns negative net amount', () => {
    const result = applyAdjustments(1000, [
      { type: 'waiver', value: 5000, isPercent: false, isActive: true },
    ])
    assert.equal(result.netAmount, 0)
  })
})
