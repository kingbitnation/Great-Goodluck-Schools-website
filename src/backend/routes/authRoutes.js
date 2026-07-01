const jwt = require('jsonwebtoken')
const bcrypt = require('bcrypt')
const crypto = require('crypto')
const QRCode = require('qrcode')
const {
  validatePassword,
  parseDeviceLabel,
  generateBackupCodes,
  hashBackupCode,
  verifyBackupCode,
  generateTotpSecret,
  verifyTotpToken,
  getTotpUri,
  isAccountLocked,
  recordLoginAttempt,
  handleFailedLogin,
  clearFailedLogins,
  createAuthToken,
  consumeAuthToken,
} = require('../lib/authHelpers')
const { hashRefreshToken } = require('../lib/refreshTokenStore')
const { signTwoFactorToken, verifyTwoFactorToken, JWT_SECRET, createRequirePermission } = require('../middleware/auth')
const { notifyLoginAlert } = require('../lib/emailNotifications')
const { evaluateSchoolAccess } = require('../lib/subscriptionHelpers')

const REFRESH_SECRET = process.env.REFRESH_SECRET || 'dev_refresh_change_me'
const REFRESH_MAX_AGE = 7 * 24 * 60 * 60
const isProduction = process.env.NODE_ENV === 'production'
const APP_URL = process.env.APP_URL || 'http://localhost:3000'

function registerAuthRoutes(app, { prisma, authRateLimiter, enqueueEmail, parseCookies }) {
  function setRefreshCookie(res, token) {
    const secure = isProduction ? '; Secure' : ''
    const sameSite = isProduction ? 'Strict' : 'Lax'
    res.setHeader(
      'Set-Cookie',
      `refreshToken=${encodeURIComponent(token)}; HttpOnly; Path=/; Max-Age=${REFRESH_MAX_AGE}; SameSite=${sameSite}${secure}`
    )
  }

  function clearRefreshCookie(res) {
    const secure = isProduction ? '; Secure' : ''
    res.setHeader('Set-Cookie', `refreshToken=; HttpOnly; Path=/; Max-Age=0; SameSite=Strict${secure}`)
  }

  function userPayload(user) {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role.name,
      schoolId: user.schoolId || null,
      schoolName: user.school?.name || null,
      emailVerified: user.emailVerified,
      twoFactorEnabled: user.twoFactorEnabled,
    }
  }

  async function findUserByEmail(email) {
    return prisma.user.findUnique({
      where: { email },
      include: { role: true, school: { select: { id: true, name: true } } },
    })
  }

  async function findUserById(id) {
    return prisma.user.findUnique({
      where: { id },
      include: { role: true, school: { select: { id: true, name: true } } },
    })
  }

  async function persistRefreshToken(userId, refreshToken, req) {
    const expiresAt = new Date(Date.now() + REFRESH_MAX_AGE * 1000)
    await prisma.refreshToken.create({
      data: {
        token: hashRefreshToken(refreshToken),
        userId,
        expiresAt,
        ipAddress: req.ip || null,
        userAgent: req.headers['user-agent'] || null,
        deviceName: parseDeviceLabel(req.headers['user-agent']),
      },
    })
  }

  async function issueTokens(user, res, req) {
    const role = user.role.name
    const accessToken = jwt.sign(
      { userId: user.id, role, schoolId: user.schoolId || null },
      JWT_SECRET,
      { expiresIn: '15m' }
    )
    const refreshToken = jwt.sign(
      { userId: user.id, jti: crypto.randomUUID() },
      REFRESH_SECRET,
      { expiresIn: '7d' }
    )
    await persistRefreshToken(user.id, refreshToken, req)
    setRefreshCookie(res, refreshToken)
    return accessToken
  }

  async function rotateRefreshToken(oldToken, res, req) {
    let payload
    try {
      payload = jwt.verify(oldToken, REFRESH_SECRET)
    } catch {
      return null
    }
    const stored = await prisma.refreshToken.findUnique({ where: { token: hashRefreshToken(oldToken) } })
    if (!stored || stored.revoked || stored.expiresAt < new Date()) return null

    await prisma.refreshToken.update({ where: { id: stored.id }, data: { revoked: true } })
    const user = await findUserById(payload.userId)
    if (!user || !user.isActive) return null
    return issueTokens(user, res, req)
  }

  function requireRole(...roles) {
    return (req, res, next) => {
      const auth = req.headers.authorization
      if (!auth) return res.status(401).json({ error: 'Missing Authorization header' })
      const parts = auth.split(' ')
      if (parts.length !== 2) return res.status(401).json({ error: 'Malformed Authorization header' })
      try {
        const payload = jwt.verify(parts[1], JWT_SECRET)
        const allowed = payload.role === 'SuperAdmin' || roles.includes(payload.role)
        if (!allowed) return res.status(403).json({ error: 'Forbidden' })
        req.user = payload
        next()
      } catch {
        return res.status(401).json({ error: 'Invalid token' })
      }
    }
  }

  const requirePermission = createRequirePermission(prisma)

  async function sendVerificationEmail(user) {
    const token = await createAuthToken(prisma, user.id, 'email_verify', 48)
    const link = `${APP_URL}/verify-email?token=${token}`
    if (enqueueEmail) {
      await enqueueEmail({
        to: user.email,
        template: 'email_verify',
        payload: { firstName: user.firstName, link },
        schoolId: user.schoolId,
      })
    }
    return link
  }

  // ===== LOGIN =====
  app.post('/api/auth/login', authRateLimiter(), async (req, res) => {
    const { email, password } = req.body
    if (!email || !password) return res.status(400).json({ error: 'Missing credentials' })

    try {
      const user = await findUserByEmail(email)
      if (!user || !user.isActive) {
        return res.status(401).json({ error: 'Invalid credentials' })
      }

      if (await isAccountLocked(user)) {
        return res.status(423).json({
          error: 'Account temporarily locked due to failed login attempts. Try again later.',
        })
      }

      const ok = await bcrypt.compare(password, user.password)
      if (!ok) {
        await handleFailedLogin(prisma, user)
        await recordLoginAttempt(prisma, {
          userId: user.id,
          success: false,
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
          failureReason: 'Invalid password',
        })
        return res.status(401).json({ error: 'Invalid credentials' })
      }

      if (user.twoFactorEnabled && user.twoFactorSecret) {
        const tempToken = signTwoFactorToken(user.id)
        return res.json({ requires2FA: true, tempToken })
      }

      if (user.schoolId && user.role?.name !== 'SuperAdmin') {
        const access = await evaluateSchoolAccess(prisma, user.schoolId, { persist: true })
        if (!access.allowed) {
          return res.status(403).json({ error: access.error, code: access.code })
        }
      }

      await clearFailedLogins(prisma, user.id)
      await prisma.user.update({ where: { id: user.id }, data: { lastLogin: new Date() } })
      await recordLoginAttempt(prisma, {
        userId: user.id,
        success: true,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      })

      if (enqueueEmail) {
        await notifyLoginAlert({ prisma, user, req })
      }

      const accessToken = await issueTokens(user, res, req)
      return res.json({ accessToken, user: userPayload(user) })
    } catch (err) {
      console.error(err)
      return res.status(500).json({ error: 'Server error' })
    }
  })

  app.post('/api/auth/login/2fa', authRateLimiter(), async (req, res) => {
    const { tempToken, code } = req.body
    if (!tempToken || !code) return res.status(400).json({ error: 'tempToken and code required' })

    const userId = verifyTwoFactorToken(tempToken)
    if (!userId) return res.status(401).json({ error: '2FA session expired. Please login again.' })

    try {
      const user = await findUserById(userId)
      if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) {
        return res.status(401).json({ error: 'Invalid 2FA session' })
      }

      let valid = verifyTotpToken(user.twoFactorSecret, code)
      if (!valid) {
        const backups = await prisma.twoFactorBackupCode.findMany({
          where: { userId: user.id, usedAt: null },
        })
        for (const b of backups) {
          if (verifyBackupCode(code, b.codeHash)) {
            valid = true
            await prisma.twoFactorBackupCode.update({ where: { id: b.id }, data: { usedAt: new Date() } })
            break
          }
        }
      }

      if (!valid) return res.status(401).json({ error: 'Invalid authentication code' })

      if (user.schoolId && user.role?.name !== 'SuperAdmin') {
        const access = await evaluateSchoolAccess(prisma, user.schoolId, { persist: true })
        if (!access.allowed) {
          return res.status(403).json({ error: access.error, code: access.code })
        }
      }

      await clearFailedLogins(prisma, user.id)
      await prisma.user.update({ where: { id: user.id }, data: { lastLogin: new Date() } })
      await recordLoginAttempt(prisma, {
        userId: user.id,
        success: true,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      })

      const accessToken = await issueTokens(user, res, req)
      return res.json({ accessToken, user: userPayload(user) })
    } catch (err) {
      console.error(err)
      return res.status(500).json({ error: 'Server error' })
    }
  })

  app.post('/api/auth/refresh', async (req, res) => {
    const cookies = parseCookies(req)
    const token = cookies.refreshToken || req.body.refreshToken
    if (!token) return res.status(401).json({ error: 'Missing refresh token' })
    try {
      const accessToken = await rotateRefreshToken(token, res, req)
      if (!accessToken) return res.status(401).json({ error: 'Invalid refresh token' })
      return res.json({ accessToken })
    } catch {
      return res.status(401).json({ error: 'Invalid refresh token' })
    }
  })

  app.post('/api/auth/logout', async (req, res) => {
    const cookies = parseCookies(req)
    const token = cookies.refreshToken || req.body.refreshToken
    if (token) {
      await prisma.refreshToken.updateMany({ where: { token: hashRefreshToken(token) }, data: { revoked: true } })
    }
    clearRefreshCookie(res)
    return res.json({ message: 'Logged out' })
  })

  app.get('/api/auth/me', async (req, res) => {
    const auth = req.headers.authorization
    if (!auth) return res.status(401).json({ error: 'Missing Authorization header' })
    const token = auth.split(' ')[1]
    try {
      const payload = jwt.verify(token, JWT_SECRET)
      const user = await findUserById(payload.userId)
      if (!user) return res.status(404).json({ error: 'User not found' })
      return res.json({ user: userPayload(user) })
    } catch {
      return res.status(401).json({ error: 'Invalid token' })
    }
  })

  app.post('/api/auth/register', requireRole('SuperAdmin', 'SchoolAdmin'), async (req, res) => {
    const { email, password, firstName, lastName, roleName, schoolId } = req.body
    if (!email || !password || !firstName || !lastName || !roleName) {
      return res.status(400).json({ error: 'Missing required fields' })
    }

    const pwErrors = validatePassword(password)
    if (pwErrors.length) return res.status(400).json({ error: pwErrors.join('. ') })

    try {
      const existing = await prisma.user.findUnique({ where: { email } })
      if (existing) return res.status(400).json({ error: 'Email already registered' })

      const role = await prisma.role.findUnique({ where: { name: roleName } })
      if (!role) return res.status(400).json({ error: 'Invalid role' })

      const hashedPassword = await bcrypt.hash(password, 10)
      const user = await prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          firstName,
          lastName,
          roleId: role.id,
          schoolId: schoolId || null,
          isActive: true,
          emailVerified: false,
        },
        include: { role: true },
      })

      await sendVerificationEmail(user)

      return res.status(201).json({
        id: user.id,
        email: user.email,
        role: role.name,
        schoolId: user.schoolId,
        message: 'User created. Verification email sent.',
      })
    } catch (err) {
      console.error(err)
      return res.status(500).json({ error: 'Server error' })
    }
  })

  // ===== EMAIL VERIFICATION =====
  app.post('/api/auth/verify-email', async (req, res) => {
    const { token } = req.body
    if (!token) return res.status(400).json({ error: 'Token required' })
    try {
      const record = await consumeAuthToken(prisma, token, 'email_verify')
      if (!record) return res.status(400).json({ error: 'Invalid or expired token' })

      await prisma.user.update({
        where: { id: record.userId },
        data: { emailVerified: true, emailVerifiedAt: new Date() },
      })
      return res.json({ message: 'Email verified successfully' })
    } catch (err) {
      console.error(err)
      return res.status(500).json({ error: 'Server error' })
    }
  })

  app.post('/api/auth/resend-verification', authRateLimiter(), async (req, res) => {
    const { email } = req.body
    if (!email) return res.status(400).json({ error: 'Email required' })
    try {
      const user = await findUserByEmail(email)
      if (!user) return res.json({ message: 'If the email exists, a verification link was sent' })
      if (user.emailVerified) return res.json({ message: 'Email already verified' })
      await sendVerificationEmail(user)
      return res.json({ message: 'If the email exists, a verification link was sent' })
    } catch (err) {
      console.error(err)
      return res.status(500).json({ error: 'Server error' })
    }
  })

  // ===== PASSWORD RESET =====
  app.post('/api/auth/forgot-password', authRateLimiter(), async (req, res) => {
    const { email } = req.body
    if (!email) return res.status(400).json({ error: 'Email required' })
    try {
      const user = await findUserByEmail(email)
      if (user) {
        const token = await createAuthToken(prisma, user.id, 'password_reset', 2)
        const link = `${APP_URL}/reset-password?token=${token}`
        if (enqueueEmail) {
          await enqueueEmail({
            to: user.email,
            template: 'password_reset',
            payload: { firstName: user.firstName, link },
            schoolId: user.schoolId,
          })
        }
      }
      return res.json({ message: 'If the email exists, a reset link was sent' })
    } catch (err) {
      console.error(err)
      return res.status(500).json({ error: 'Server error' })
    }
  })

  app.post('/api/auth/reset-password', authRateLimiter(), async (req, res) => {
    const { token, password } = req.body
    if (!token || !password) return res.status(400).json({ error: 'Token and password required' })

    const pwErrors = validatePassword(password)
    if (pwErrors.length) return res.status(400).json({ error: pwErrors.join('. ') })

    try {
      const record = await consumeAuthToken(prisma, token, 'password_reset')
      if (!record) return res.status(400).json({ error: 'Invalid or expired token' })

      const hashed = await bcrypt.hash(password, 10)
      await prisma.user.update({
        where: { id: record.userId },
        data: { password: hashed, failedLoginAttempts: 0, lockedUntil: null },
      })
      await prisma.refreshToken.updateMany({
        where: { userId: record.userId },
        data: { revoked: true },
      })
      return res.json({ message: 'Password reset successfully' })
    } catch (err) {
      console.error(err)
      return res.status(500).json({ error: 'Server error' })
    }
  })

  app.post('/api/auth/change-password', requireRole('SuperAdmin', 'SchoolAdmin', 'Teacher', 'Student', 'Parent', 'Accountant', 'Librarian', 'HostelManager', 'TransportManager'), async (req, res) => {
    const { currentPassword, newPassword } = req.body
    if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Both passwords required' })

    const pwErrors = validatePassword(newPassword)
    if (pwErrors.length) return res.status(400).json({ error: pwErrors.join('. ') })

    try {
      const user = await prisma.user.findUnique({ where: { id: req.user.userId } })
      if (!user) return res.status(404).json({ error: 'User not found' })
      const ok = await bcrypt.compare(currentPassword, user.password)
      if (!ok) return res.status(401).json({ error: 'Current password is incorrect' })

      await prisma.user.update({
        where: { id: user.id },
        data: { password: await bcrypt.hash(newPassword, 10) },
      })
      return res.json({ message: 'Password changed' })
    } catch (err) {
      console.error(err)
      return res.status(500).json({ error: 'Server error' })
    }
  })

  // ===== 2FA SETUP =====
  app.get('/api/auth/2fa/setup', requireRole('SuperAdmin', 'SchoolAdmin', 'Teacher', 'Student', 'Parent', 'Accountant', 'Librarian', 'HostelManager', 'TransportManager'), async (req, res) => {
    try {
      const user = await findUserById(req.user.userId)
      if (!user) return res.status(404).json({ error: 'User not found' })
      if (user.twoFactorEnabled) return res.status(400).json({ error: '2FA already enabled' })

      const secret = generateTotpSecret()
      const otpauthUrl = getTotpUri(user.email, secret)
      const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl)

      await prisma.user.update({
        where: { id: user.id },
        data: { twoFactorSecret: secret, twoFactorEnabled: false },
      })

      return res.json({ secret, otpauthUrl, qrCodeDataUrl })
    } catch (err) {
      console.error(err)
      return res.status(500).json({ error: 'Server error' })
    }
  })

  app.post('/api/auth/2fa/confirm', requireRole('SuperAdmin', 'SchoolAdmin', 'Teacher', 'Student', 'Parent', 'Accountant', 'Librarian', 'HostelManager', 'TransportManager'), async (req, res) => {
    const { code } = req.body
    if (!code) return res.status(400).json({ error: 'Code required' })
    try {
      const user = await prisma.user.findUnique({ where: { id: req.user.userId } })
      if (!user?.twoFactorSecret) return res.status(400).json({ error: 'Run 2FA setup first' })
      if (!verifyTotpToken(user.twoFactorSecret, code)) {
        return res.status(401).json({ error: 'Invalid code' })
      }

      const plainCodes = generateBackupCodes()
      await prisma.twoFactorBackupCode.deleteMany({ where: { userId: user.id } })
      await prisma.twoFactorBackupCode.createMany({
        data: plainCodes.map((c) => ({ userId: user.id, codeHash: hashBackupCode(c) })),
      })
      await prisma.user.update({
        where: { id: user.id },
        data: { twoFactorEnabled: true },
      })

      return res.json({ enabled: true, backupCodes: plainCodes })
    } catch (err) {
      console.error(err)
      return res.status(500).json({ error: 'Server error' })
    }
  })

  app.post('/api/auth/2fa/disable', requireRole('SuperAdmin', 'SchoolAdmin', 'Teacher', 'Student', 'Parent', 'Accountant', 'Librarian', 'HostelManager', 'TransportManager'), async (req, res) => {
    const { password, code } = req.body
    if (!password) return res.status(400).json({ error: 'Password required' })
    try {
      const user = await prisma.user.findUnique({ where: { id: req.user.userId } })
      if (!user) return res.status(404).json({ error: 'User not found' })
      const ok = await bcrypt.compare(password, user.password)
      if (!ok) return res.status(401).json({ error: 'Invalid password' })
      if (user.twoFactorEnabled && user.twoFactorSecret && code) {
        if (!verifyTotpToken(user.twoFactorSecret, code)) {
          return res.status(401).json({ error: 'Invalid 2FA code' })
        }
      }

      await prisma.twoFactorBackupCode.deleteMany({ where: { userId: user.id } })
      await prisma.user.update({
        where: { id: user.id },
        data: { twoFactorSecret: null, twoFactorEnabled: false },
      })
      return res.json({ enabled: false })
    } catch (err) {
      console.error(err)
      return res.status(500).json({ error: 'Server error' })
    }
  })

  // ===== SESSIONS =====
  app.get('/api/auth/sessions', requireRole('SuperAdmin', 'SchoolAdmin', 'Teacher', 'Student', 'Parent', 'Accountant', 'Librarian', 'HostelManager', 'TransportManager'), async (req, res) => {
    try {
      const sessions = await prisma.refreshToken.findMany({
        where: { userId: req.user.userId, revoked: false, expiresAt: { gt: new Date() } },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          createdAt: true,
          expiresAt: true,
          ipAddress: true,
          userAgent: true,
          deviceName: true,
        },
      })
      res.json(sessions)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.delete('/api/auth/sessions/:id', requireRole('SuperAdmin', 'SchoolAdmin', 'Teacher', 'Student', 'Parent', 'Accountant', 'Librarian', 'HostelManager', 'TransportManager'), async (req, res) => {
    try {
      const session = await prisma.refreshToken.findFirst({
        where: { id: req.params.id, userId: req.user.userId },
      })
      if (!session) return res.status(404).json({ error: 'Session not found' })
      await prisma.refreshToken.update({ where: { id: session.id }, data: { revoked: true } })
      res.json({ message: 'Session revoked' })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.get('/api/auth/login-history', requireRole('SuperAdmin', 'SchoolAdmin', 'Teacher', 'Student', 'Parent', 'Accountant', 'Librarian', 'HostelManager', 'TransportManager'), async (req, res) => {
    try {
      const history = await prisma.loginHistory.findMany({
        where: { userId: req.user.userId },
        orderBy: { createdAt: 'desc' },
        take: 50,
      })
      res.json(history)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  // ===== AUDIT LOGS =====
  app.get('/api/audit-logs', requireRole('SuperAdmin', 'SchoolAdmin'), requirePermission('reports.view'), async (req, res) => {
    try {
      const { limit = '50', userId } = req.query
      const where = {}
      if (userId) where.userId = String(userId)
      if (req.user.role === 'SchoolAdmin' && req.user.schoolId) {
        const schoolUsers = await prisma.user.findMany({
          where: { schoolId: req.user.schoolId },
          select: { id: true },
        })
        where.userId = { in: schoolUsers.map((u) => u.id) }
      }

      const logs = await prisma.auditLog.findMany({
        where,
        include: {
          user: { select: { email: true, firstName: true, lastName: true, role: { select: { name: true } } } },
        },
        orderBy: { createdAt: 'desc' },
        take: Math.min(Number(limit) || 50, 200),
      })
      res.json(logs)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  return { requireRole, requirePermission }
}

module.exports = { registerAuthRoutes }

