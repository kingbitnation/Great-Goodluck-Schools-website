const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const { DEFAULT_CHANNELS } = require('../../src/backend/lib/notificationDispatcher')

describe('notificationDispatcher', () => {
  it('defines default channels for core event types', () => {
    assert.deepEqual(DEFAULT_CHANNELS.results, ['email', 'in_app', 'sms', 'push'])
    assert.deepEqual(DEFAULT_CHANNELS.fee, ['email', 'in_app', 'sms'])
    assert.deepEqual(DEFAULT_CHANNELS.marketplace, ['email', 'in_app', 'push'])
  })

  it('login alerts are email-only by default', () => {
    assert.deepEqual(DEFAULT_CHANNELS.login, ['email'])
  })
})
