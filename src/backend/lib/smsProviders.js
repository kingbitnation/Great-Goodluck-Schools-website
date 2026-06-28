function normalizePhone(phone) {
  if (!phone) return ''
  const digits = String(phone).replace(/\D/g, '')
  if (digits.startsWith('0') && digits.length === 11) return `234${digits.slice(1)}`
  if (digits.length === 10) return `234${digits}`
  return digits
}

async function sendTermiiSms({ apiKey, senderId, to, message, baseUrl }) {
  if (!apiKey || !senderId) throw new Error('Termii SMS is not configured')
  const recipient = normalizePhone(to)
  if (!recipient) throw new Error('Invalid phone number')

  const root = (baseUrl || process.env.TERMII_BASE_URL || 'https://v3.api.termii.com').replace(/\/$/, '')
  const res = await fetch(`${root}/api/sms/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: apiKey,
      to: recipient,
      from: senderId,
      sms: message,
      type: 'plain',
      channel: 'generic',
    }),
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data.message || data.error || 'Termii SMS failed')
  }
  return data
}

async function sendTwilioSms({ accountSid, authToken, from, to, message }) {
  if (!accountSid || !authToken || !from) throw new Error('Twilio SMS is not configured')
  const recipient = normalizePhone(to)
  if (!recipient) throw new Error('Invalid phone number')

  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`
  const body = new URLSearchParams({
    To: `+${recipient}`,
    From: from.startsWith('+') ? from : `+${from}`,
    Body: message,
  })

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data.message || 'Twilio SMS failed')
  }
  return data
}

async function sendSms({ provider, config, to, message }) {
  if (provider === 'twilio') {
    return sendTwilioSms({
      accountSid: config.twilioAccountSid,
      authToken: config.twilioAuthToken,
      from: config.twilioFromNumber,
      to,
      message,
    })
  }
  return sendTermiiSms({
    apiKey: config.termiiApiKey,
    senderId: config.termiiSenderId,
    baseUrl: config.termiiBaseUrl,
    to,
    message,
  })
}

module.exports = {
  normalizePhone,
  sendTermiiSms,
  sendTwilioSms,
  sendSms,
}
