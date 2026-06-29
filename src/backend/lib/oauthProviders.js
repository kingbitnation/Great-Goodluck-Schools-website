const crypto = require('crypto')
const { encryptSecret, decryptSecret } = require('./credentialCrypto')

const APP_URL = (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '')

const PROVIDERS = {
  google: {
    slug: 'google-workspace',
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scopes: [
      'https://www.googleapis.com/auth/calendar.readonly',
      'https://www.googleapis.com/auth/drive.readonly',
      'openid',
      'email',
    ],
    clientId: () => process.env.GOOGLE_CLIENT_ID,
    clientSecret: () => process.env.GOOGLE_CLIENT_SECRET,
  },
  zoom: {
    slug: 'zoom',
    authUrl: 'https://zoom.us/oauth/authorize',
    tokenUrl: 'https://zoom.us/oauth/token',
    scopes: ['meeting:write:meeting', 'user:read:user'],
    clientId: () => process.env.ZOOM_CLIENT_ID,
    clientSecret: () => process.env.ZOOM_CLIENT_SECRET,
  },
}

function oauthConfigured(provider) {
  const p = PROVIDERS[provider]
  return !!(p?.clientId() && p?.clientSecret())
}

function buildAuthorizeUrl(provider, { schoolId, userId }) {
  const p = PROVIDERS[provider]
  if (!p || !oauthConfigured(provider)) {
    throw new Error(`${provider} OAuth is not configured on the server`)
  }
  const state = encryptSecret(JSON.stringify({ schoolId, userId, provider, ts: Date.now() }))
  const params = new URLSearchParams({
    client_id: p.clientId(),
    redirect_uri: `${APP_URL}/api/oauth/${provider}/callback`,
    response_type: 'code',
    scope: p.scopes.join(' '),
    state,
    access_type: 'offline',
    prompt: 'consent',
  })
  return `${p.authUrl}?${params.toString()}`
}

async function exchangeCode(provider, code) {
  const p = PROVIDERS[provider]
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: `${APP_URL}/api/oauth/${provider}/callback`,
    client_id: p.clientId(),
    client_secret: p.clientSecret(),
  })
  const res = await fetch(p.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error_description || data.reason || 'Token exchange failed')
  return data
}

function parseOAuthState(state) {
  const raw = decryptSecret(state)
  if (!raw) throw new Error('Invalid OAuth state')
  const parsed = JSON.parse(raw)
  if (Date.now() - parsed.ts > 15 * 60 * 1000) throw new Error('OAuth state expired')
  return parsed
}

async function verifyPaystackKeys(publicKey, secretKey) {
  const res = await fetch('https://api.paystack.co/transaction/totals', {
    headers: { Authorization: `Bearer ${secretKey}` },
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data.status) {
    throw new Error(data.message || 'Invalid Paystack secret key')
  }
  if (publicKey && !String(publicKey).startsWith('pk_')) {
    throw new Error('Paystack public key must start with pk_')
  }
  return { verified: true, currency: data.data?.currency || 'NGN' }
}

async function paystackRequest(secretKey, path, options = {}) {
  const res = await fetch(`https://api.paystack.co${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || data.status === false) {
    throw new Error(data.message || `Paystack error (${res.status})`)
  }
  return data
}

function verifyPaystackWebhookSignature(rawBody, signature, secret) {
  const hash = crypto.createHmac('sha512', secret).update(rawBody).digest('hex')
  return hash === signature
}

async function resolvePaystackSecret(prisma, schoolId) {
  if (schoolId) {
    const conn = await prisma.schoolIntegration.findUnique({
      where: { schoolId_providerSlug: { schoolId, providerSlug: 'paystack' } },
    })
    if (conn?.status === 'connected' && conn.config?.secretKeyEnc) {
      return decryptSecret(conn.config.secretKeyEnc)
    }
  }
  return process.env.PAYSTACK_SECRET_KEY || null
}

module.exports = {
  PROVIDERS,
  APP_URL,
  oauthConfigured,
  buildAuthorizeUrl,
  exchangeCode,
  parseOAuthState,
  verifyPaystackKeys,
  paystackRequest,
  verifyPaystackWebhookSignature,
  resolvePaystackSecret,
}
