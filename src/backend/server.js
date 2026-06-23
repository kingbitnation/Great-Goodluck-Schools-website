const express = require('express')
const cors = require('cors')
const jwt = require('jsonwebtoken')
const bcrypt = require('bcrypt')
const crypto = require('crypto')
require('dotenv').config()

const prisma = require('./prismaClient')
const { registerResourceRoutes } = require('./routes/resourceRoutes')

const app = express()
app.use(cors({ origin: true, credentials: true }))
app.use(express.json())

function parseCookies(req) {
  const header = req.headers.cookie
  if (!header) return {}
  return header.split(';').map(c => c.trim()).reduce((acc, pair) => {
    const [k, v] = pair.split('=')
    acc[k] = decodeURIComponent(v)
    return acc
  }, {})
}

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me'
const REFRESH_SECRET = process.env.REFRESH_SECRET || 'dev_refresh_change_me'
const REFRESH_MAX_AGE = 7 * 24 * 60 * 60
const isProduction = process.env.NODE_ENV === 'production'

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
  res.setHeader(
    'Set-Cookie',
    `refreshToken=; HttpOnly; Path=/; Max-Age=0; SameSite=Strict${secure}`
  )
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
  }
}

async function persistRefreshToken(userId, refreshToken) {
  const expiresAt = new Date(Date.now() + REFRESH_MAX_AGE * 1000)
  await prisma.refreshToken.create({
    data: { token: refreshToken, userId, expiresAt },
  })
}

async function issueTokens(user, res) {
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

  await persistRefreshToken(user.id, refreshToken)
  setRefreshCookie(res, refreshToken)
  return accessToken
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

async function rotateRefreshToken(oldToken, res) {
  let payload
  try {
    payload = jwt.verify(oldToken, REFRESH_SECRET)
  } catch {
    return null
  }

  const stored = await prisma.refreshToken.findUnique({ where: { token: oldToken } })
  if (!stored) return null

  if (stored.revoked) {
    await prisma.refreshToken.updateMany({
      where: { userId: stored.userId },
      data: { revoked: true },
    })
    return null
  }

  if (stored.expiresAt < new Date()) {
    await prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revoked: true },
    })
    return null
  }

  await prisma.refreshToken.update({
    where: { id: stored.id },
    data: { revoked: true },
  })

  const user = await findUserById(payload.userId)
  if (!user || !user.isActive) return null
  return issueTokens(user, res)
}

app.get('/api/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`
    res.json({ status: 'ok', backend: 'running', db: true })
  } catch {
    res.status(503).json({ status: 'degraded', backend: 'running', db: false })
  }
})

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body
  if (!email || !password) return res.status(400).json({ error: 'Missing credentials' })

  try {
    const user = await findUserByEmail(email)
    if (!user || !user.isActive) return res.status(401).json({ error: 'Invalid credentials' })
    const ok = await bcrypt.compare(password, user.password)
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' })

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    })

    const accessToken = await issueTokens(user, res)
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
    const accessToken = await rotateRefreshToken(token, res)
    if (!accessToken) return res.status(401).json({ error: 'Invalid refresh token' })
    return res.json({ accessToken })
  } catch (err) {
    console.error(err)
    return res.status(401).json({ error: 'Invalid refresh token' })
  }
})

app.post('/api/auth/logout', async (req, res) => {
  const cookies = parseCookies(req)
  const token = cookies.refreshToken || req.body.refreshToken

  if (token) {
    await prisma.refreshToken.updateMany({
      where: { token },
      data: { revoked: true },
    })
  }

  clearRefreshCookie(res)
  return res.json({ message: 'Logged out' })
})

app.get('/api/auth/me', async (req, res) => {
  const auth = req.headers.authorization
  if (!auth) return res.status(401).json({ error: 'Missing Authorization header' })
  const parts = auth.split(' ')
  if (parts.length !== 2) return res.status(401).json({ error: 'Malformed Authorization header' })
  const token = parts[1]

  try {
    const payload = jwt.verify(token, JWT_SECRET)
    const user = await findUserById(payload.userId)
    if (!user) return res.status(404).json({ error: 'User not found' })
    return res.json({ user: userPayload(user) })
  } catch {
    return res.status(401).json({ error: 'Invalid token' })
  }
})

function requireRole(...roles) {
  return (req, res, next) => {
    const auth = req.headers.authorization
    if (!auth) return res.status(401).json({ error: 'Missing Authorization header' })
    const parts = auth.split(' ')
    if (parts.length !== 2) return res.status(401).json({ error: 'Malformed Authorization header' })
    const token = parts[1]
    try {
      const payload = jwt.verify(token, JWT_SECRET)
      const allowed = payload.role === 'SuperAdmin' || roles.includes(payload.role)
      if (!allowed) {
        return res.status(403).json({ error: 'Forbidden' })
      }
      req.user = payload
      next()
    } catch {
      return res.status(401).json({ error: 'Invalid token' })
    }
  }
}

app.post('/api/auth/register', async (req, res) => {
  const { email, password, firstName, lastName, roleName, schoolId } = req.body

  if (!email || !password || !firstName || !lastName || !roleName) {
    return res.status(400).json({ error: 'Missing required fields' })
  }

  try {
    const existingUser = await prisma.user.findUnique({ where: { email } })
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' })
    }

    const role = await prisma.role.findUnique({ where: { name: roleName } })
    if (!role) {
      return res.status(400).json({ error: 'Invalid role' })
    }

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
      },
    })

    return res.status(201).json({
      id: user.id,
      email: user.email,
      role: role.name,
      schoolId: user.schoolId,
    })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Server error' })
  }
})

registerResourceRoutes(app, { prisma, requireRole })

const port = process.env.PORT || 4000
app.listen(port, () => {
  console.log(`Backend server running on http://localhost:${port}`)
  console.log(`Health check: http://localhost:${port}/api/health`)
})
