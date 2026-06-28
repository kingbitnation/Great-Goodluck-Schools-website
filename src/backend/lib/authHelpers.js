const crypto = require('crypto')
const bcrypt = require('bcrypt')
const { authenticator } = require('otplib')

const LOCKOUT_THRESHOLD = 5
const LOCKOUT_MINUTES = 15
const PASSWORD_MIN_LENGTH = 8

function validatePassword(password) {
  const errors = []
  if (!password || password.length < PASSWORD_MIN_LENGTH) {
    errors.push(`Password must be at least ${PASSWORD_MIN_LENGTH} characters`)
  }
  if (!/[A-Z]/.test(password)) errors.push('Password must include an uppercase letter')
  if (!/[a-z]/.test(password)) errors.push('Password must include a lowercase letter')
  if (!/[0-9]/.test(password)) errors.push('Password must include a number')
  return errors
}

function parseDeviceLabel(userAgent = '') {
  if (!userAgent) return 'Unknown device'
  if (/mobile/i.test(userAgent)) return 'Mobile device'
  if (/windows/i.test(userAgent)) return 'Windows'
  if (/mac/i.test(userAgent)) return 'Mac'
  if (/linux/i.test(userAgent)) return 'Linux'
  return 'Web browser'
}

function generateToken() {
  return crypto.randomBytes(32).toString('hex')
}

function hashBackupCode(code) {
  return bcrypt.hashSync(code.replace(/\s/g, ''), 10)
}

function verifyBackupCode(code, hash) {
  return bcrypt.compareSync(code.replace(/\s/g, ''), hash)
}

function generateBackupCodes(count = 8) {
  return Array.from({ length: count }, () =>
    crypto.randomBytes(4).toString('hex').toUpperCase().match(/.{1,4}/g).join('-')
  )
}

function generateTotpSecret() {
  return authenticator.generateSecret()
}

function verifyTotpToken(secret, token) {
  try {
    return authenticator.verify({ token: String(token).replace(/\s/g, ''), secret })
  } catch {
    return false
  }
}

function getTotpUri(email, secret, issuer = 'SchoolPilot') {
  return authenticator.keyuri(email, issuer, secret)
}

async function isAccountLocked(user) {
  if (!user.lockedUntil) return false
  if (user.lockedUntil > new Date()) return true
  return false
}

async function recordLoginAttempt(prisma, { userId, success, ipAddress, userAgent, failureReason }) {
  if (!userId) return
  await prisma.loginHistory.create({
    data: {
      userId,
      ipAddress: ipAddress || null,
      userAgent: userAgent || null,
      deviceLabel: parseDeviceLabel(userAgent),
      success,
      failureReason: failureReason || null,
    },
  })
}

async function handleFailedLogin(prisma, user) {
  const attempts = (user.failedLoginAttempts || 0) + 1
  const data = { failedLoginAttempts: attempts }
  if (attempts >= LOCKOUT_THRESHOLD) {
    data.lockedUntil = new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000)
  }
  await prisma.user.update({ where: { id: user.id }, data })
}

async function clearFailedLogins(prisma, userId) {
  await prisma.user.update({
    where: { id: userId },
    data: { failedLoginAttempts: 0, lockedUntil: null },
  })
}

async function createAuthToken(prisma, userId, type, hoursValid = 24) {
  const token = generateToken()
  await prisma.authToken.create({
    data: {
      userId,
      type,
      token,
      expiresAt: new Date(Date.now() + hoursValid * 60 * 60 * 1000),
    },
  })
  return token
}

async function consumeAuthToken(prisma, token, type) {
  const record = await prisma.authToken.findFirst({
    where: { token, type, usedAt: null, expiresAt: { gt: new Date() } },
    include: { user: { include: { role: true, school: { select: { id: true, name: true } } } } },
  })
  if (!record) return null
  await prisma.authToken.update({ where: { id: record.id }, data: { usedAt: new Date() } })
  return record
}

module.exports = {
  validatePassword,
  parseDeviceLabel,
  generateToken,
  hashBackupCode,
  verifyBackupCode,
  generateBackupCodes,
  generateTotpSecret,
  verifyTotpToken,
  getTotpUri,
  isAccountLocked,
  recordLoginAttempt,
  handleFailedLogin,
  clearFailedLogins,
  createAuthToken,
  consumeAuthToken,
  LOCKOUT_THRESHOLD,
  LOCKOUT_MINUTES,
}
