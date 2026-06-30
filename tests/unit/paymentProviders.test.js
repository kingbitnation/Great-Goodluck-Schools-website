const { test } = require('node:test')
const assert = require('node:assert/strict')
const {
  generatePaymentReference,
  verifyFlutterwaveWebhookSignature,
  verifyStripeWebhookSignature,
} = require('../../src/backend/lib/paymentProviders')
const { parseCsv, studentsToCsv } = require('../../src/backend/routes/importRoutes')
const { staffNoForRole, ROLE_PROFILE_MODELS } = require('../../src/backend/lib/roleProfiles')

test('generatePaymentReference returns unique prefixed refs', () => {
  const a = generatePaymentReference()
  const b = generatePaymentReference('TEST')
  assert.match(a, /^GGS-PAY-/)
  assert.match(b, /^TEST-/)
  assert.notEqual(a, b)
})

test('verifyFlutterwaveWebhookSignature validates hash', () => {
  const body = '{"event":"charge.completed"}'
  const hash = require('crypto').createHash('sha256').update(body).digest('hex')
  assert.equal(verifyFlutterwaveWebhookSignature(body, hash, hash), true)
  assert.equal(verifyFlutterwaveWebhookSignature(body, 'bad', hash), false)
})

test('verifyStripeWebhookSignature rejects invalid signatures', () => {
  assert.equal(verifyStripeWebhookSignature('{}', 't=1,v1=abc', 'whsec_test'), false)
})

test('parseCsv parses quoted fields', () => {
  const rows = parseCsv('email,firstName,lastName\n"a@b.com","Ada","Okafor"')
  assert.equal(rows.length, 1)
  assert.equal(rows[0].email, 'a@b.com')
  assert.equal(rows[0].firstName, 'Ada')
})

test('studentsToCsv includes headers', () => {
  const csv = studentsToCsv([])
  assert.match(csv, /^email,firstName,lastName/)
})

test('role profile models cover staff roles', () => {
  assert.ok(ROLE_PROFILE_MODELS.Accountant)
  assert.match(staffNoForRole('Accountant'), /^ACC-/)
})
