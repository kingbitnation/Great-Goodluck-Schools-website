const crypto = require('crypto')
const { decryptSecret } = require('./credentialCrypto')
const { APP_URL } = require('./oauthProviders')

function generatePaymentReference(prefix = 'GGS-PAY') {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}`
}

async function resolveSchoolGatewaySecret(prisma, schoolId, providerSlug, envKey) {
  if (schoolId) {
    const conn = await prisma.schoolIntegration.findUnique({
      where: { schoolId_providerSlug: { schoolId, providerSlug } },
    })
    if (conn?.status === 'connected' && conn.config?.secretKeyEnc) {
      return decryptSecret(conn.config.secretKeyEnc)
    }
  }
  return process.env[envKey] || null
}

async function resolvePaystackSecret(prisma, schoolId) {
  return resolveSchoolGatewaySecret(prisma, schoolId, 'paystack', 'PAYSTACK_SECRET_KEY')
}

async function resolveFlutterwaveSecret(prisma, schoolId) {
  return resolveSchoolGatewaySecret(prisma, schoolId, 'flutterwave', 'FLUTTERWAVE_SECRET_KEY')
}

async function resolveStripeSecret(prisma, schoolId) {
  return resolveSchoolGatewaySecret(prisma, schoolId, 'stripe', 'STRIPE_SECRET_KEY')
}

async function verifyFlutterwaveKeys(publicKey, secretKey) {
  const res = await fetch('https://api.flutterwave.com/v3/transactions?page=1', {
    headers: { Authorization: `Bearer ${secretKey}` },
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || data.status !== 'success') {
    throw new Error(data.message || 'Invalid Flutterwave secret key')
  }
  if (publicKey && !String(publicKey).startsWith('FLWPUBK')) {
    throw new Error('Flutterwave public key must start with FLWPUBK')
  }
  return { verified: true, currency: 'NGN' }
}

async function flutterwaveRequest(secretKey, path, options = {}) {
  const res = await fetch(`https://api.flutterwave.com/v3${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || data.status !== 'success') {
    throw new Error(data.message || `Flutterwave error (${res.status})`)
  }
  return data
}

async function initializeFlutterwavePayment(secretKey, { email, amount, reference, callbackUrl, metadata, currency = 'NGN' }) {
  const data = await flutterwaveRequest(secretKey, '/payments', {
    method: 'POST',
    body: JSON.stringify({
      tx_ref: reference,
      amount,
      currency,
      redirect_url: callbackUrl,
      customer: { email },
      meta: metadata || {},
      customizations: { title: 'SchoolPilot Fee Payment' },
    }),
  })
  return {
    authorizationUrl: data.data.link,
    reference,
    providerRef: String(data.data.id || reference),
  }
}

async function verifyFlutterwavePayment(secretKey, reference) {
  const data = await flutterwaveRequest(
    secretKey,
    `/transactions/verify_by_reference?tx_ref=${encodeURIComponent(reference)}`
  )
  const tx = data.data
  return {
    status: tx.status === 'successful' ? 'success' : tx.status,
    amount: Number(tx.amount) || 0,
    transactionId: String(tx.id),
    currency: tx.currency || 'NGN',
  }
}

function verifyFlutterwaveWebhookSignature(rawBody, signature, secretHash) {
  if (!secretHash || !signature) return false
  const hash = crypto.createHash('sha256').update(rawBody).digest('hex')
  return hash === signature
}

async function verifyStripeKeys(secretKey) {
  const res = await fetch('https://api.stripe.com/v1/balance', {
    headers: { Authorization: `Bearer ${secretKey}` },
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data.error?.message || 'Invalid Stripe secret key')
  }
  return { verified: true, currency: data.available?.[0]?.currency?.toUpperCase() || 'USD' }
}

async function stripeRequest(secretKey, path, body) {
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(body).toString(),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data.error?.message || `Stripe error (${res.status})`)
  }
  return data
}

async function initializeStripeCheckout(secretKey, { email, amount, reference, successUrl, cancelUrl, metadata, currency = 'ngn' }) {
  const unitAmount = Math.round(amount * 100)
  const session = await stripeRequest(secretKey, '/checkout/sessions', {
    mode: 'payment',
    'customer_email': email,
    'client_reference_id': reference,
    'success_url': successUrl,
    'cancel_url': cancelUrl,
    'line_items[0][price_data][currency]': currency.toLowerCase(),
    'line_items[0][price_data][unit_amount]': String(unitAmount),
    'line_items[0][price_data][product_data][name]': 'School fee payment',
    'line_items[0][quantity]': '1',
    ...(metadata?.paymentId ? { 'metadata[paymentId]': metadata.paymentId } : {}),
    ...(metadata?.studentId ? { 'metadata[studentId]': metadata.studentId } : {}),
    ...(metadata?.schoolId ? { 'metadata[schoolId]': metadata.schoolId } : {}),
    ...(metadata?.type ? { 'metadata[type]': metadata.type } : {}),
  })
  return {
    authorizationUrl: session.url,
    reference,
    providerRef: session.id,
  }
}

async function verifyStripeCheckout(secretKey, sessionId) {
  const res = await fetch(`https://api.stripe.com/v1/checkout/sessions/${sessionId}`, {
    headers: { Authorization: `Bearer ${secretKey}` },
  })
  const session = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(session.error?.message || 'Stripe verification failed')
  }
  const paid = (session.amount_total || 0) / 100
  return {
    status: session.payment_status === 'paid' ? 'success' : session.payment_status,
    amount: paid,
    transactionId: session.payment_intent || session.id,
    reference: session.client_reference_id,
    currency: (session.currency || 'ngn').toUpperCase(),
  }
}

function verifyStripeWebhookSignature(rawBody, signatureHeader, webhookSecret) {
  if (!signatureHeader || !webhookSecret) return false
  const parts = String(signatureHeader).split(',').reduce((acc, part) => {
    const [k, v] = part.split('=')
    acc[k] = v
    return acc
  }, {})
  const timestamp = parts.t
  const signature = parts.v1
  if (!timestamp || !signature) return false
  const payload = `${timestamp}.${rawBody}`
  const expected = crypto.createHmac('sha256', webhookSecret).update(payload).digest('hex')
  if (expected.length !== signature.length) return false
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
}

async function listAvailableGateways(prisma, schoolId) {
  const gateways = [{ id: 'manual', label: 'Bank transfer', available: true }]

  const checks = [
    { id: 'paystack', label: 'Paystack (card, bank, USSD)', slug: 'paystack', env: 'PAYSTACK_SECRET_KEY', publicKeyField: 'publicKey' },
    { id: 'flutterwave', label: 'Flutterwave (multi-currency)', slug: 'flutterwave', env: 'FLUTTERWAVE_SECRET_KEY', publicKeyField: 'publicKey' },
    { id: 'stripe', label: 'Stripe (international cards)', slug: 'stripe', env: 'STRIPE_SECRET_KEY', publicKeyField: 'publishableKey' },
  ]

  for (const gw of checks) {
    let available = false
    let publicKey = null
    if (schoolId) {
      const conn = await prisma.schoolIntegration.findUnique({
        where: { schoolId_providerSlug: { schoolId, providerSlug: gw.slug } },
      })
      if (conn?.status === 'connected') {
        available = true
        publicKey = conn.config?.[gw.publicKeyField] || null
      }
    }
    if (!available && process.env[gw.env]) {
      available = true
    }
    if (available) {
      gateways.push({ id: gw.id, label: gw.label, available: true, publicKey })
    }
  }

  return gateways
}

function paymentCallbackUrl(reference, gateway) {
  return `${APP_URL}/payment/callback?reference=${encodeURIComponent(reference)}&gateway=${gateway}`
}

module.exports = {
  generatePaymentReference,
  resolvePaystackSecret,
  resolveFlutterwaveSecret,
  resolveStripeSecret,
  verifyFlutterwaveKeys,
  flutterwaveRequest,
  initializeFlutterwavePayment,
  verifyFlutterwavePayment,
  verifyFlutterwaveWebhookSignature,
  verifyStripeKeys,
  initializeStripeCheckout,
  verifyStripeCheckout,
  verifyStripeWebhookSignature,
  listAvailableGateways,
  paymentCallbackUrl,
}
