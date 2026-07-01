const crypto = require('crypto')
const bcrypt = require('bcrypt')

const OTP_PURPOSES = new Set([
  'phone_verification',
  'email_verification',
  'password_reset',
  'login_verification',
])

const OTP_CHANNELS = new Set(['email', 'sms'])

function otpConfig() {
  return {
    length: Math.min(10, Math.max(4, Number(process.env.OTP_LENGTH || 6))),
    expiryMinutes: Math.min(120, Math.max(5, Number(process.env.OTP_EXPIRY_MINUTES || 30))),
    maxAttempts: Math.min(10, Math.max(3, Number(process.env.OTP_MAX_ATTEMPTS || 5))),
    rateWindowMinutes: Math.min(60, Math.max(5, Number(process.env.OTP_RATE_LIMIT_WINDOW_MINUTES || 15))),
    rateMaxSends: Math.min(20, Math.max(1, Number(process.env.OTP_RATE_LIMIT_MAX_SENDS || 5))),
  }
}

function generateOtpCode(length) {
  const max = 10 ** length
  return String(crypto.randomInt(0, max)).padStart(length, '0')
}

function maskDestination(destination, channel) {
  const d = String(destination || '')
  if (channel === 'email') {
    const [user, domain] = d.split('@')
    if (!domain) return '***'
    return `${user.slice(0, 2)}***@${domain}`
  }
  if (d.length <= 4) return '***'
  return `${d.slice(0, 4)}***${d.slice(-2)}`
}

async function logOtpEvent(prisma, { otpId, destination, purpose, event, userId, ipAddress }) {
  try {
    await prisma.otpAuditLog.create({
      data: {
        otpId: otpId || null,
        destination: maskDestination(destination),
        purpose,
        event,
        userId: userId || null,
        ipAddress: ipAddress || null,
      },
    })
  } catch (err) {
    console.error('OTP audit log error:', err.message)
  }
}

async function countRecentSends(prisma, destination, purpose, windowMinutes) {
  const since = new Date(Date.now() - windowMinutes * 60 * 1000)
  return prisma.otpVerification.count({
    where: {
      destination,
      purpose,
      createdAt: { gte: since },
    },
  })
}

async function invalidateActiveOtps(prisma, destination, purpose) {
  await prisma.otpVerification.updateMany({
    where: {
      destination,
      purpose,
      consumedAt: null,
      invalidatedAt: null,
      expiresAt: { gt: new Date() },
    },
    data: { invalidatedAt: new Date() },
  })
}

function buildSmsMessage(code, expiryMinutes) {
  return `Your SchoolPilot verification code is ${code}. It expires in ${expiryMinutes} minutes. SchoolPilot.`
}

function buildEmailContent(code, firstName, expiryMinutes) {
  const name = firstName || 'there'
  return {
    subject: 'Your SchoolPilot verification code',
    text: `Dear ${name}, your SchoolPilot verification code is ${code}. It expires in ${expiryMinutes} minutes.`,
    html: `<p>Dear <strong>${name}</strong>,</p>
      <p>Your SchoolPilot verification code is:</p>
      <p style="font-size:28px;font-weight:700;letter-spacing:4px;">${code}</p>
      <p>It expires in ${expiryMinutes} minutes. Do not share this code with anyone.</p>
      <p>Powered by SchoolPilot.</p>`,
  }
}

/**
 * Create and send a new OTP. Invalidates any previous active OTP for same destination+purpose.
 */
async function sendOtp(prisma, {
  destination,
  channel,
  purpose,
  userId = null,
  firstName = null,
  ipAddress = null,
  metadata = null,
  sendEmail = null,
  sendSms = null,
}) {
  const cfg = otpConfig()
  const dest = String(destination || '').trim()
  const chan = String(channel || '').toLowerCase()
  const purp = String(purpose || '').trim()

  if (!dest) throw Object.assign(new Error('Destination is required'), { code: 'INVALID_DESTINATION' })
  if (!OTP_CHANNELS.has(chan)) throw Object.assign(new Error('Invalid channel'), { code: 'INVALID_CHANNEL' })
  if (!OTP_PURPOSES.has(purp)) throw Object.assign(new Error('Invalid purpose'), { code: 'INVALID_PURPOSE' })

  const recent = await countRecentSends(prisma, dest, purp, cfg.rateWindowMinutes)
  if (recent >= cfg.rateMaxSends) {
    await logOtpEvent(prisma, { destination: dest, purpose: purp, event: 'rate_limited', userId, ipAddress })
    throw Object.assign(new Error('Too many OTP requests. Please try again later.'), { code: 'RATE_LIMITED' })
  }

  await invalidateActiveOtps(prisma, dest, purp)

  const code = generateOtpCode(cfg.length)
  const codeHash = await bcrypt.hash(code, 10)
  const sessionToken = crypto.randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + cfg.expiryMinutes * 60 * 1000)

  const record = await prisma.otpVerification.create({
    data: {
      userId,
      destination: dest,
      channel: chan,
      purpose: purp,
      codeHash,
      sessionToken,
      expiresAt,
      maxAttempts: cfg.maxAttempts,
      ipAddress,
      metadata: metadata || undefined,
    },
  })

  if (chan === 'sms' && sendSms) {
    await sendSms({ to: dest, message: buildSmsMessage(code, cfg.expiryMinutes) })
  } else if (chan === 'email' && sendEmail) {
    const content = buildEmailContent(code, firstName, cfg.expiryMinutes)
    await sendEmail({ to: dest, ...content })
  }

  await logOtpEvent(prisma, {
    otpId: record.id,
    destination: dest,
    purpose: purp,
    event: 'sent',
    userId,
    ipAddress,
  })

  return {
    sessionToken,
    expiresAt,
    expiresInMinutes: cfg.expiryMinutes,
    destination: maskDestination(dest, chan),
  }
}

/**
 * Verify OTP. Returns { verified: true, userId, purpose, destination } on success.
 */
async function verifyOtp(prisma, { sessionToken, code, ipAddress = null }) {
  const token = String(sessionToken || '').trim()
  const plainCode = String(code || '').trim()
  if (!token || !plainCode) {
    throw Object.assign(new Error('Session token and code are required'), { code: 'INVALID_INPUT' })
  }

  const record = await prisma.otpVerification.findUnique({ where: { sessionToken: token } })
  if (!record) {
    throw Object.assign(new Error('Invalid or expired verification session'), { code: 'INVALID_SESSION' })
  }

  if (record.consumedAt) {
    throw Object.assign(new Error('This code has already been used'), { code: 'OTP_REUSED' })
  }
  if (record.invalidatedAt) {
    throw Object.assign(new Error('This code is no longer valid'), { code: 'OTP_INVALIDATED' })
  }
  if (record.expiresAt < new Date()) {
    await logOtpEvent(prisma, {
      otpId: record.id,
      destination: record.destination,
      purpose: record.purpose,
      event: 'expired',
      userId: record.userId,
      ipAddress,
    })
    throw Object.assign(new Error('Verification code has expired'), { code: 'OTP_EXPIRED' })
  }
  if (record.attemptCount >= record.maxAttempts) {
    throw Object.assign(new Error('Maximum verification attempts exceeded'), { code: 'MAX_ATTEMPTS' })
  }

  const match = await bcrypt.compare(plainCode, record.codeHash)
  if (!match) {
    const updated = await prisma.otpVerification.update({
      where: { id: record.id },
      data: { attemptCount: { increment: 1 } },
    })
    await logOtpEvent(prisma, {
      otpId: record.id,
      destination: record.destination,
      purpose: record.purpose,
      event: 'failed',
      userId: record.userId,
      ipAddress,
    })
    const remaining = updated.maxAttempts - updated.attemptCount
    throw Object.assign(
      new Error(remaining > 0 ? `Incorrect code. ${remaining} attempt(s) remaining.` : 'Maximum verification attempts exceeded'),
      { code: 'INVALID_CODE', attemptsRemaining: Math.max(0, remaining) },
    )
  }

  await prisma.otpVerification.update({
    where: { id: record.id },
    data: { consumedAt: new Date() },
  })

  await logOtpEvent(prisma, {
    otpId: record.id,
    destination: record.destination,
    purpose: record.purpose,
    event: 'verified',
    userId: record.userId,
    ipAddress,
  })

  return {
    verified: true,
    userId: record.userId,
    purpose: record.purpose,
    destination: record.destination,
    channel: record.channel,
    sessionToken: record.sessionToken,
    metadata: record.metadata,
  }
}

/**
 * Resend: invalidate previous and issue a completely new OTP.
 */
async function resendOtp(prisma, params) {
  const { sessionToken, sendEmail, sendSms, ipAddress = null } = params
  const token = String(sessionToken || '').trim()
  if (!token) throw Object.assign(new Error('Session token is required'), { code: 'INVALID_SESSION' })

  const previous = await prisma.otpVerification.findUnique({ where: { sessionToken: token } })
  if (!previous) {
    throw Object.assign(new Error('Invalid verification session'), { code: 'INVALID_SESSION' })
  }
  if (previous.consumedAt) {
    throw Object.assign(new Error('This verification is already complete'), { code: 'ALREADY_VERIFIED' })
  }

  await prisma.otpVerification.update({
    where: { id: previous.id },
    data: { invalidatedAt: new Date() },
  })
  await logOtpEvent(prisma, {
    otpId: previous.id,
    destination: previous.destination,
    purpose: previous.purpose,
    event: 'resend',
    userId: previous.userId,
    ipAddress,
  })

  return sendOtp(prisma, {
    destination: previous.destination,
    channel: previous.channel,
    purpose: previous.purpose,
    userId: previous.userId,
    firstName: params.firstName,
    ipAddress,
    metadata: previous.metadata,
    sendEmail,
    sendSms,
  })
}

/** Validate a consumed session token without re-consuming (for registration flow). */
async function assertVerifiedSession(prisma, sessionToken, purpose, destination = null) {
  const record = await prisma.otpVerification.findUnique({ where: { sessionToken: String(sessionToken) } })
  if (!record || !record.consumedAt) {
    throw Object.assign(new Error('Phone verification required'), { code: 'NOT_VERIFIED' })
  }
  if (record.purpose !== purpose) {
    throw Object.assign(new Error('Invalid verification purpose'), { code: 'INVALID_PURPOSE' })
  }
  if (destination) {
    const metaPhone = record.metadata?.phone
    const matches =
      record.destination === destination ||
      (metaPhone && String(metaPhone) === String(destination))
    if (!matches) {
      throw Object.assign(new Error('Verification does not match destination'), { code: 'DESTINATION_MISMATCH' })
    }
  }
  const maxAge = otpConfig().expiryMinutes * 60 * 1000
  if (record.consumedAt.getTime() + maxAge < Date.now()) {
    throw Object.assign(new Error('Verification expired — verify again'), { code: 'SESSION_EXPIRED' })
  }
  return record
}

module.exports = {
  OTP_PURPOSES,
  OTP_CHANNELS,
  otpConfig,
  generateOtpCode,
  sendOtp,
  verifyOtp,
  resendOtp,
  assertVerifiedSession,
  buildSmsMessage,
  buildEmailContent,
  maskDestination,
  logOtpEvent,
}
