const { sendOtp, verifyOtp, resendOtp, OTP_PURPOSES } = require('../lib/otpService')
const { sendMail } = require('../lib/email')
const { resolveSmsConfig } = require('../lib/smsQueue')
const { sendSms } = require('../lib/smsProviders')

function clientIp(req) {
  return req.ip || req.headers['x-forwarded-for']?.split(',')[0]?.trim() || null
}

function registerOtpRoutes(app, { prisma, authRateLimiter, enqueueEmail }) {
  const rateLimit = authRateLimiter || ((_req, _res, next) => next())

  async function emailSender({ to, subject, text, html }) {
    if (enqueueEmail) {
      await enqueueEmail({
        to,
        subject,
        body: text,
        template: 'otp_verification',
        payload: { subject, body: text, htmlBody: html },
      })
      return
    }
    await sendMail({ to, subject, text, html })
  }

  async function smsSender({ to, message }) {
    const smsConfig = await resolveSmsConfig(null)
    if (!smsConfig.smsEnabled) {
      const err = new Error('SMS is not configured')
      err.code = 'SMS_NOT_CONFIGURED'
      throw err
    }
    await sendSms({
      provider: smsConfig.smsProvider,
      config: smsConfig,
      to,
      message,
    })
  }

  app.post('/api/otp/send', rateLimit, async (req, res) => {
    try {
      const { destination, channel, purpose, firstName, userId } = req.body
      if (!OTP_PURPOSES.has(String(purpose))) {
        return res.status(400).json({ error: 'Invalid purpose' })
      }
      const chan = String(channel || 'email').toLowerCase()
      const result = await sendOtp(prisma, {
        destination,
        channel: chan,
        purpose,
        userId: userId || null,
        firstName,
        ipAddress: clientIp(req),
        sendEmail: chan === 'email' ? emailSender : null,
        sendSms: chan === 'sms' ? smsSender : null,
      })
      res.json(result)
    } catch (err) {
      const status = err.code === 'RATE_LIMITED' ? 429 : 400
      res.status(status).json({ error: err.message, code: err.code })
    }
  })

  app.post('/api/otp/verify', rateLimit, async (req, res) => {
    try {
      const { sessionToken, code } = req.body
      const result = await verifyOtp(prisma, {
        sessionToken,
        code,
        ipAddress: clientIp(req),
      })
      res.json(result)
    } catch (err) {
      const status = ['OTP_EXPIRED', 'MAX_ATTEMPTS', 'OTP_REUSED'].includes(err.code) ? 400 : 400
      res.status(status).json({
        error: err.message,
        code: err.code,
        attemptsRemaining: err.attemptsRemaining,
      })
    }
  })

  app.post('/api/otp/resend', rateLimit, async (req, res) => {
    try {
      const { sessionToken, firstName } = req.body
      const result = await resendOtp(prisma, {
        sessionToken,
        firstName,
        ipAddress: clientIp(req),
        sendEmail: emailSender,
        sendSms: smsSender,
      })
      res.json(result)
    } catch (err) {
      const status = err.code === 'RATE_LIMITED' ? 429 : 400
      res.status(status).json({ error: err.message, code: err.code })
    }
  })
}

module.exports = { registerOtpRoutes }
