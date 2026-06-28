const { resolveSmtpConfig } = require('./email')
const { resolveSmsConfig } = require('./smsQueue')
const { resolveVapidForSchool } = require('./pushHelpers')

async function buildSystemStatus(prisma, schoolId) {
  const [smtp, sms, vapid, notificationSetting] = await Promise.all([
    resolveSmtpConfig(schoolId),
    resolveSmsConfig(schoolId),
    resolveVapidForSchool(schoolId),
    schoolId
      ? prisma.notificationSetting.findUnique({ where: { schoolId } }).catch(() => null)
      : Promise.resolve(null),
  ])

  const openAiConfigured = Boolean(process.env.OPENAI_API_KEY)
  const cloudinaryConfigured = Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET
  )

  const smsConfigured =
    Boolean(sms.smsEnabled && (sms.termiiApiKey || sms.twilioAccountSid)) ||
    Boolean(process.env.TERMII_API_KEY || process.env.TWILIO_ACCOUNT_SID)

  const pushConfigured = Boolean(vapid.pushEnabled && vapid.publicKey && vapid.privateKey)

  return {
    schoolId: schoolId || null,
    checkedAt: new Date().toISOString(),
    integrations: [
      {
        id: 'email',
        label: 'Email (SMTP)',
        state: smtp ? 'ready' : 'missing',
        detail: smtp
          ? `Sending as ${String(smtp.from).replace(/<[^>]+>/g, '').trim() || 'configured account'}`
          : 'Add SMTP in .env or Admin → Email system',
        href: '/admin/email-settings',
        required: true,
      },
      {
        id: 'manual_payments',
        label: 'Manual bank payments',
        state: 'ready',
        detail: 'All payments use bank transfer with proof upload or admin verification',
        href: '/accountant/payments',
        required: true,
      },
      {
        id: 'openai',
        label: 'AI features (OpenAI)',
        state: openAiConfigured ? 'ready' : 'demo',
        detail: openAiConfigured
          ? `Model: ${process.env.AI_MODEL || 'gpt-4o-mini'}`
          : 'Demo mode — add OPENAI_API_KEY to .env for live AI tutor & lesson plans',
        href: null,
        envKey: 'OPENAI_API_KEY',
        required: false,
      },
      {
        id: 'sms',
        label: 'SMS notifications',
        state: smsConfigured ? 'ready' : 'optional',
        detail: smsConfigured
          ? `Provider: ${notificationSetting?.smsProvider || sms.smsProvider || 'termii'}`
          : 'Optional — Termii or Twilio in Admin → SMS & push',
        href: '/admin/notification-settings',
        required: false,
      },
      {
        id: 'push',
        label: 'Web push notifications',
        state: pushConfigured ? 'ready' : 'optional',
        detail: pushConfigured
          ? 'VAPID keys configured — users can subscribe in Settings'
          : 'Optional — generate VAPID keys in Admin → SMS & push',
        href: '/admin/notification-settings',
        required: false,
      },
      {
        id: 'uploads',
        label: 'File uploads',
        state: cloudinaryConfigured ? 'ready' : 'ready',
        detail: cloudinaryConfigured
          ? 'Cloudinary cloud storage active'
          : 'Local storage active (/uploads) — Cloudinary optional',
        href: null,
        required: false,
      },
      {
        id: 'redis',
        label: 'Distributed rate limits',
        state: process.env.REDIS_URL ? 'ready' : 'optional',
        detail: process.env.REDIS_URL
          ? 'Redis connected for multi-instance rate limiting'
          : 'Set REDIS_URL when running multiple app instances',
        href: null,
        required: false,
      },
    ],
  }
}

module.exports = { buildSystemStatus }
