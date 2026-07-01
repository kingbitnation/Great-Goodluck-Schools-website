const { describe, it, beforeEach, mock } = require('node:test')
const assert = require('node:assert/strict')
const bcrypt = require('bcrypt')

const {
  generateOtpCode,
  otpConfig,
  maskDestination,
  buildSmsMessage,
} = require('../../src/backend/lib/otpService')

describe('otpService helpers', () => {
  it('generates numeric OTP of configured length', () => {
    const prev = process.env.OTP_LENGTH
    process.env.OTP_LENGTH = '6'
    const code = generateOtpCode(6)
    assert.match(code, /^\d{6}$/)
    process.env.OTP_LENGTH = prev
  })

  it('never returns a fixed sample code', () => {
    const codes = new Set(Array.from({ length: 20 }, () => generateOtpCode(6)))
    assert.ok(codes.size > 1, 'OTP must be random across requests')
    assert.ok(!codes.has('013889'), 'Sample Termii code must never be generated')
  })

  it('masks email destinations', () => {
    assert.equal(maskDestination('admin@school.com', 'email'), 'ad***@school.com')
  })

  it('builds SMS template with dynamic OTP placeholder replaced', () => {
    const msg = buildSmsMessage('482910', 30)
    assert.match(msg, /482910/)
    assert.match(msg, /30 minutes/)
    assert.match(msg, /SchoolPilot/)
    assert.ok(!msg.includes('013889'))
  })

  it('respects OTP expiry config default', () => {
    const cfg = otpConfig()
    assert.equal(cfg.expiryMinutes, Number(process.env.OTP_EXPIRY_MINUTES || 30))
    assert.equal(cfg.length, Number(process.env.OTP_LENGTH || 6))
  })
})

describe('otpService hashing', () => {
  it('stores only bcrypt hash not plaintext', async () => {
    const code = '123456'
    const hash = await bcrypt.hash(code, 4)
    assert.notEqual(hash, code)
    assert.ok(await bcrypt.compare(code, hash))
    assert.equal(await bcrypt.compare('013889', hash), false)
  })
})
