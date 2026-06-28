const jwt = require('jsonwebtoken')

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me'
const TWO_FA_SECRET = process.env.TWO_FA_SECRET || JWT_SECRET + '_2fa'

function createRequireRole(JWT_SECRET_KEY = JWT_SECRET) {
  return function requireRole(...roles) {
    return (req, res, next) => {
      const auth = req.headers.authorization
      if (!auth) return res.status(401).json({ error: 'Missing Authorization header' })
      const parts = auth.split(' ')
      if (parts.length !== 2) return res.status(401).json({ error: 'Malformed Authorization header' })
      try {
        const payload = jwt.verify(parts[1], JWT_SECRET_KEY)
        const allowed = payload.role === 'SuperAdmin' || roles.includes(payload.role)
        if (!allowed) return res.status(403).json({ error: 'Forbidden' })
        req.user = payload
        next()
      } catch {
        return res.status(401).json({ error: 'Invalid token' })
      }
    }
  }
}

function createRequirePermission(prisma) {
  return function requirePermission(...permissionNames) {
    return async (req, res, next) => {
      if (!req.user?.userId) return res.status(401).json({ error: 'Unauthorized' })
      if (req.user.role === 'SuperAdmin') return next()

      const user = await prisma.user.findUnique({
        where: { id: req.user.userId },
        include: { role: { include: { permissions: { include: { permission: true } } } } },
      })
      if (!user) return res.status(401).json({ error: 'User not found' })

      const names = user.role.permissions.map((rp) => rp.permission.name)
      const has = permissionNames.some((p) => names.includes(p))
      if (!has) return res.status(403).json({ error: 'Insufficient permissions' })
      next()
    }
  }
}

function signTwoFactorToken(userId) {
  return jwt.sign({ userId, purpose: '2fa' }, TWO_FA_SECRET, { expiresIn: '5m' })
}

function verifyTwoFactorToken(token) {
  try {
    const payload = jwt.verify(token, TWO_FA_SECRET)
    if (payload.purpose !== '2fa') return null
    return payload.userId
  } catch {
    return null
  }
}

module.exports = {
  createRequireRole,
  createRequirePermission,
  signTwoFactorToken,
  verifyTwoFactorToken,
  JWT_SECRET,
  TWO_FA_SECRET,
}
