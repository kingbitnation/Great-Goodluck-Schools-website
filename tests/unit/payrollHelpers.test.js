const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const {
  periodLabel,
  roundMoney,
  computePayslip,
  defaultPayrollSettings,
} = require('../../src/backend/lib/payrollHelpers')

describe('payrollHelpers', () => {
  it('periodLabel formats month and year', () => {
    assert.equal(periodLabel(6, 2026), 'June 2026')
  })

  it('roundMoney rounds to two decimals', () => {
    assert.equal(roundMoney(10.126), 10.13)
    assert.equal(roundMoney(10.124), 10.12)
  })

  it('computePayslip calculates Nigerian statutory deductions', () => {
    const settings = defaultPayrollSettings()
    const employee = {
      id: 'e1',
      employeeNo: 'EMP001',
      firstName: 'Ada',
      lastName: 'Okafor',
      department: 'Science',
      jobTitle: 'Teacher',
    }
    const profile = {
      baseSalary: 200000,
      allowances: [{ name: 'Housing', amount: 20000 }],
      customDeductions: [],
    }

    const slip = computePayslip(profile, employee, settings)
    assert.equal(slip.grossPay, 220000)
    assert.ok(slip.totalDeductions > 0)
    assert.ok(slip.netPay < slip.grossPay)
    assert.equal(slip.employeeName, 'Ada Okafor')
  })
})
