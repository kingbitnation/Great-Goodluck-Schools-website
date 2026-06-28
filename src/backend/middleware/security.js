const rateLimit = require('express-rate-limit')
const { sanitizeAuditBody } = require('../lib/auditSanitize')
const { redisRateLimitStore } = require('../lib/redis')

function createRateLimiter() {
  const store = redisRateLimitStore()
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later' },
    ...(store ? { store } : {}),
  })
}

function authRateLimiter() {
  const isTest = process.env.NODE_ENV === 'test'
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    max: isTest ? 10_000 : 30,
    skip: () => isTest,
    message: { error: 'Too many auth attempts, please try again later' },
  })
}

function auditLogger(prisma) {
  return async (req, res, next) => {
    const start = Date.now()
    res.on('finish', () => {
      if (!req.user?.userId || req.path === '/api/health') return
      if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return

      prisma.auditLog
        .create({
          data: {
            userId: req.user.userId,
            action: `${req.method} ${req.path}`,
            resource: req.path.split('/')[2] || 'api',
            resourceId: req.params?.id || null,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'] || null,
            changes: req.body && Object.keys(req.body).length ? sanitizeAuditBody(req.body) : undefined,
          },
        })
        .catch((err) => console.error('Audit log error:', err.message))
    })
    next()
  }
}

module.exports = { createRateLimiter, authRateLimiter, auditLogger }
