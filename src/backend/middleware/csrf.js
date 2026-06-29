const crypto = require('crypto')

const tokens = new Map()
const TOKEN_TTL_MS = 60 * 60 * 1000

function parseCookies(req) {
  const header = req.headers.cookie
  if (!header) return {}
  return header.split(';').reduce((acc, pair) => {
    const [k, v] = pair.trim().split('=')
    if (k) acc[k] = decodeURIComponent(v || '')
    return acc
  }, {})
}

function issueCsrfToken(res) {
  const token = crypto.randomBytes(24).toString('hex')
  tokens.set(token, Date.now() + TOKEN_TTL_MS)
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  res.setHeader('Set-Cookie', `csrfToken=${token}; Path=/; SameSite=Strict${secure}`)
  return token
}

function csrfProtection(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next()
  const open = ['/api/auth/login', '/api/auth/register', '/api/auth/refresh', '/api/public/', '/api/webhooks/', '/api/forms/']
  if (open.some((p) => req.path.startsWith(p))) return next()
  if (req.headers.authorization) return next()

  const cookies = parseCookies(req)
  const headerToken = req.headers['x-csrf-token']
  const cookieToken = cookies.csrfToken
  const token = headerToken || cookieToken
  if (!token || token !== cookieToken) {
    return res.status(403).json({ error: 'CSRF validation failed', code: 'CSRF_INVALID' })
  }
  const expires = tokens.get(token)
  if (!expires || expires < Date.now()) {
    tokens.delete(token)
    return res.status(403).json({ error: 'CSRF token expired', code: 'CSRF_EXPIRED' })
  }
  next()
}

function registerCsrfRoute(app) {
  app.get('/api/auth/csrf', (req, res) => {
    const token = issueCsrfToken(res)
    res.json({ csrfToken: token })
  })
}

module.exports = { csrfProtection, registerCsrfRoute, issueCsrfToken }
