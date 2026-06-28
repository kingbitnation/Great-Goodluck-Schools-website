const prisma = require('../prismaClient')
const { sendSms } = require('./smsProviders')

const MAX_ATTEMPTS = 5
const BACKOFF_MINUTES = [0, 5, 15, 60, 240]

const SMS_TEMPLATES = {
  results_released: (p) =>
    `Hi ${p.firstName}, ${p.examName || 'Exam'} results: ${p.summary || 'Log in to view details.'}`,
  attendance_alert: (p) =>
    `Attendance alert: ${p.studentName} was ${p.status} on ${p.date}.`,
  fee_reminder: (p) =>
    `Fee reminder: ${p.feeName} — outstanding ₦${p.outstanding}. Due ${p.dueDate}.`,
  login_alert: (p) =>
    `New login to your SchoolPilot account from ${p.device} at ${p.time}.`,
  payment_received: (p) =>
    `Payment of ₦${p.amount} received for ${p.feeName || 'school fees'}. Ref: ${p.reference || '—'}.`,
  admission_update: (p) =>
    `Admission update: ${p.status} — ${p.applicantName || 'your application'}.`,
  library_fine: (p) =>
    `Library fine: ₦${p.fineAmount} for overdue book "${p.bookTitle}".`,
  leave_update: (p) =>
    `Leave request ${p.status}: ${p.leaveType || 'Leave'} (${p.startDate} – ${p.endDate}).`,
  general: (p) => p.message || p.body || 'You have a new notification from SchoolPilot.',
}

function renderSmsBody(template, payload, fallbackBody) {
  if (fallbackBody) return fallbackBody
  const fn = SMS_TEMPLATES[template] || SMS_TEMPLATES.general
  return fn(payload || {})
}

function nextRetryAt(attempts) {
  const mins = BACKOFF_MINUTES[Math.min(attempts, BACKOFF_MINUTES.length - 1)]
  return new Date(Date.now() + mins * 60 * 1000)
}

async function resolveSmsConfig(schoolId) {
  if (!schoolId) {
    return {
      smsEnabled: Boolean(process.env.TERMII_API_KEY || process.env.TWILIO_ACCOUNT_SID),
      smsProvider: process.env.SMS_PROVIDER || 'termii',
      termiiApiKey: process.env.TERMII_API_KEY || null,
      termiiSenderId: process.env.TERMII_SENDER_ID || null,
      termiiBaseUrl: process.env.TERMII_BASE_URL || null,
      twilioAccountSid: process.env.TWILIO_ACCOUNT_SID || null,
      twilioAuthToken: process.env.TWILIO_AUTH_TOKEN || null,
      twilioFromNumber: process.env.TWILIO_FROM_NUMBER || null,
    }
  }

  const setting = await prisma.notificationSetting.findUnique({ where: { schoolId } })
  if (!setting) {
    return {
      smsEnabled: false,
      smsProvider: 'termii',
      termiiApiKey: process.env.TERMII_API_KEY || null,
      termiiSenderId: process.env.TERMII_SENDER_ID || null,
      termiiBaseUrl: process.env.TERMII_BASE_URL || null,
      twilioAccountSid: process.env.TWILIO_ACCOUNT_SID || null,
      twilioAuthToken: process.env.TWILIO_AUTH_TOKEN || null,
      twilioFromNumber: process.env.TWILIO_FROM_NUMBER || null,
    }
  }

  return {
    smsEnabled: setting.smsEnabled,
    smsProvider: setting.smsProvider || 'termii',
    termiiApiKey: setting.termiiApiKey || process.env.TERMII_API_KEY || null,
    termiiSenderId: setting.termiiSenderId || process.env.TERMII_SENDER_ID || null,
    twilioAccountSid: setting.twilioAccountSid || process.env.TWILIO_ACCOUNT_SID || null,
    twilioAuthToken: setting.twilioAuthToken || process.env.TWILIO_AUTH_TOKEN || null,
    twilioFromNumber: setting.twilioFromNumber || process.env.TWILIO_FROM_NUMBER || null,
  }
}

async function enqueueSms({ to, body, template, payload, schoolId, provider, scheduledAt }) {
  const message = renderSmsBody(template, payload, body)
  const config = await resolveSmsConfig(schoolId)
  const smsProvider = provider || config.smsProvider || 'termii'

  return prisma.smsQueue.create({
    data: {
      to,
      body: message,
      template: template || null,
      payload: payload || null,
      schoolId: schoolId || null,
      provider: smsProvider,
      scheduledAt: scheduledAt || new Date(),
    },
  })
}

async function processSmsQueue(limit = 25) {
  const pending = await prisma.smsQueue.findMany({
    where: {
      status: 'pending',
      scheduledAt: { lte: new Date() },
      attempts: { lt: MAX_ATTEMPTS },
    },
    take: limit,
    orderBy: { scheduledAt: 'asc' },
  })

  let sent = 0
  let failed = 0

  for (const job of pending) {
    try {
      const config = await resolveSmsConfig(job.schoolId)
      if (!config.smsEnabled && job.schoolId) {
        await prisma.smsQueue.update({
          where: { id: job.id },
          data: { status: 'failed', lastError: 'SMS disabled for school', attempts: job.attempts + 1 },
        })
        failed++
        continue
      }

      await sendSms({
        provider: job.provider || config.smsProvider,
        config,
        to: job.to,
        message: job.body,
      })

      await prisma.smsQueue.update({
        where: { id: job.id },
        data: { status: 'sent', sentAt: new Date() },
      })
      sent++
    } catch (err) {
      const attempts = job.attempts + 1
      const status = attempts >= MAX_ATTEMPTS ? 'failed' : 'pending'
      await prisma.smsQueue.update({
        where: { id: job.id },
        data: {
          status,
          attempts,
          lastError: err.message || 'SMS send failed',
          scheduledAt: status === 'pending' ? nextRetryAt(attempts) : job.scheduledAt,
        },
      })
      failed++
    }
  }

  return { sent, failed, processed: pending.length }
}

module.exports = {
  enqueueSms,
  processSmsQueue,
  renderSmsBody,
  resolveSmsConfig,
  SMS_TEMPLATES,
}
