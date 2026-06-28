const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const { renderSmsBody, SMS_TEMPLATES } = require('../../src/backend/lib/smsQueue')

describe('smsQueue', () => {
  it('renders fee reminder template', () => {
    const body = renderSmsBody('fee_reminder', {
      feeName: 'Term 2 fees',
      outstanding: '45000',
      dueDate: '15 Jul',
    })
    assert.match(body, /Term 2 fees/)
    assert.match(body, /45000/)
  })

  it('falls back to general message body', () => {
    const body = renderSmsBody('unknown_template', { message: 'Hello parent' })
    assert.equal(body, 'Hello parent')
  })

  it('exposes core SMS templates', () => {
    assert.ok(SMS_TEMPLATES.payment_received)
    assert.ok(SMS_TEMPLATES.admission_update)
  })
})
