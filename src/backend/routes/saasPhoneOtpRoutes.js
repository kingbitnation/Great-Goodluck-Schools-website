const { sendOtp, verifyOtp } = require('../lib/otpService')
const { authRateLimiter } = require('../middleware/security')
const { sendMail } = require('../lib/email')

function normalizeNgPhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '')
  if (!digits) return null
  if (digits.startsWith('234') && digits.length >= 12) return `+${digits}`
  if (digits.startsWith('0') && digits.length === 11) return `+234${digits.slice(1)}`
  if (digits.length === 10) return `+234${digits}`
  return null
}

function registerSaasPhoneOtpRoutes(app, { prisma }) {
  const phoneOtpLimit = authRateLimiter()

  app.post('/api/public/schools/register/phone/send', phoneOtpLimit, async (req, res) => {
    try {
      const phone = normalizeNgPhone(req.body.phone)
      const email = String(req.body.email || req.body.adminEmail || '').trim().toLowerCase()
      if (!phone) return res.status(400).json({ error: 'Enter a valid Nigerian phone number' })

      const { resolveSmsConfig } = require('../lib/smsQueue')
      const { sendSms } = require('../lib/smsProviders')
      const smsConfig = await resolveSmsConfig(null)

      let channel = 'sms'
      let destination = phone
      let sendSmsFn = null
      let sendEmailFn = null

      if (smsConfig.smsEnabled) {
        sendSmsFn = async ({ to, message }) => {
          await sendSms({ provider: smsConfig.smsProvider, config: smsConfig, to, message })
        }
      } else if (email) {
        channel = 'email'
        destination = email
        sendEmailFn = async ({ to, subject, text, html }) => {
          await sendMail({ to, subject, text, html })
        }
      } else {
        return res.status(503).json({
          error: 'SMS is not configured on the server. Enter your email above and try again, or contact support.',
          code: 'SMS_NOT_CONFIGURED',
        })
      }

      const result = await sendOtp(prisma, {
        destination,
        channel,
        purpose: 'phone_verification',
        ipAddress: req.ip,
        metadata: channel === 'email' ? { phone } : undefined,
        sendSms: sendSmsFn,
        sendEmail: sendEmailFn,
      })

      const via = channel === 'email' ? 'email' : 'phone'
      res.json({
        message:
          channel === 'email'
            ? `Verification code sent to ${email}`
            : 'Verification code sent to your phone',
        sessionToken: result.sessionToken,
        phoneVerificationToken: result.sessionToken,
        expiresInMinutes: result.expiresInMinutes,
        channel: via,
      })
    } catch (err) {
      const status = err.code === 'RATE_LIMITED' ? 429 : err.code === 'SMS_NOT_CONFIGURED' ? 503 : 500
      console.error(err)
      res.status(status).json({ error: err.message || 'Could not send verification code', code: err.code })
    }
  })

  app.post('/api/public/schools/register/phone/verify', phoneOtpLimit, async (req, res) => {
    try {
      const phone = normalizeNgPhone(req.body.phone)
      const { code, sessionToken } = req.body
      const token = sessionToken || req.body.phoneVerificationToken
      if (!phone || !code) return res.status(400).json({ error: 'Phone and code required' })
      if (!token) return res.status(400).json({ error: 'Request a new code first' })

      const verified = await verifyOtp(prisma, { sessionToken: token, code, ipAddress: req.ip })
      const verifiedPhone = verified.metadata?.phone || verified.destination
      if (normalizeNgPhone(verifiedPhone) !== phone && verified.destination !== phone) {
        return res.status(400).json({ error: 'Phone does not match verification session' })
      }
      res.json({ verified: true, phoneVerificationToken: token, sessionToken: token })
    } catch (err) {
      console.error(err)
      res.status(400).json({ error: err.message || 'Verification failed', code: err.code })
    }
  })
}

module.exports = { registerSaasPhoneOtpRoutes }
