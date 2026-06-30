const { encryptSecret } = require('../lib/credentialCrypto')
const {
  oauthConfigured,
  buildAuthorizeUrl,
  exchangeCode,
  parseOAuthState,
  verifyPaystackKeys,
  verifyPaystackWebhookSignature,
  paystackRequest,
  PROVIDERS,
  APP_URL,
} = require('../lib/oauthProviders')
const {
  generatePaymentReference,
  resolvePaystackSecret,
  resolveFlutterwaveSecret,
  resolveStripeSecret,
  verifyFlutterwaveKeys,
  initializeFlutterwavePayment,
  verifyFlutterwavePayment,
  verifyFlutterwaveWebhookSignature,
  verifyStripeKeys,
  initializeStripeCheckout,
  verifyStripeCheckout,
  verifyStripeWebhookSignature,
  listAvailableGateways,
  paymentCallbackUrl,
} = require('../lib/paymentProviders')
const { handleSuccessfulFeePayment } = require('../lib/paymentHandlers')
const { activateSubscription, createReceipt, logTransaction } = require('../lib/subscriptionHelpers')

async function createPendingFeePayment(prisma, { student, studentId, feeId, amount, installmentId, gateway }) {
  const reference = generatePaymentReference()
  const payment = await prisma.payment.create({
    data: {
      schoolId: student.schoolId,
      studentId,
      feeId: feeId || null,
      installmentId: installmentId || null,
      amount,
      paidAmount: 0,
      gateway,
      status: 'pending',
      verificationStatus: 'pending',
      paymentReference: reference,
    },
  })
  return { payment, reference }
}

async function assertPayerAccess(prisma, req, payment) {
  if (req.user.role === 'Student') {
    const me = await prisma.student.findUnique({ where: { userId: req.user.userId } })
    if (!me || me.id !== payment.studentId) {
      const err = new Error('Forbidden')
      err.status = 403
      throw err
    }
  }
}

function registerOAuthRoutes(app, { prisma, requireRole }) {
  const schoolAdmin = requireRole('SuperAdmin', 'SchoolAdmin')

  app.get('/api/oauth/status', schoolAdmin, (_req, res) => {
    res.json({
      google: oauthConfigured('google'),
      zoom: oauthConfigured('zoom'),
      paystack: !!(process.env.PAYSTACK_SECRET_KEY),
      flutterwave: !!(process.env.FLUTTERWAVE_SECRET_KEY),
      stripe: !!(process.env.STRIPE_SECRET_KEY),
      redirectBase: APP_URL,
    })
  })

  app.get('/api/oauth/:provider/authorize', schoolAdmin, (req, res) => {
    try {
      const provider = req.params.provider
      if (!['google', 'zoom'].includes(provider)) return res.status(400).json({ error: 'Unsupported provider' })
      const schoolId = req.user.schoolId || req.query.schoolId
      if (!schoolId) return res.status(400).json({ error: 'School context required' })
      const url = buildAuthorizeUrl(provider, { schoolId, userId: req.user.userId })
      res.json({ url })
    } catch (err) {
      res.status(400).json({ error: err.message })
    }
  })

  app.get('/api/oauth/:provider/callback', async (req, res) => {
    try {
      const provider = req.params.provider
      const { code, state, error } = req.query
      if (error) return res.redirect(`${APP_URL}/admin/integrations?error=${encodeURIComponent(String(error))}`)
      if (!code || !state) return res.status(400).send('Missing code or state')

      const parsed = parseOAuthState(String(state))
      if (parsed.provider !== provider) throw new Error('Provider mismatch')
      const tokens = await exchangeCode(provider, String(code))
      const slug = PROVIDERS[provider]?.slug || provider

      await prisma.schoolIntegration.upsert({
        where: { schoolId_providerSlug: { schoolId: parsed.schoolId, providerSlug: slug } },
        create: {
          schoolId: parsed.schoolId,
          providerSlug: slug,
          status: 'connected',
          connectedAt: new Date(),
          config: {
            accessTokenEnc: encryptSecret(tokens.access_token),
            refreshTokenEnc: tokens.refresh_token ? encryptSecret(tokens.refresh_token) : null,
            expiresAt: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000).toISOString() : null,
            scope: tokens.scope || PROVIDERS[provider].scopes.join(' '),
          },
        },
        update: {
          status: 'connected',
          connectedAt: new Date(),
          lastError: null,
          config: {
            accessTokenEnc: encryptSecret(tokens.access_token),
            refreshTokenEnc: tokens.refresh_token ? encryptSecret(tokens.refresh_token) : null,
            expiresAt: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000).toISOString() : null,
            scope: tokens.scope || PROVIDERS[provider].scopes.join(' '),
          },
        },
      })

      res.redirect(`${APP_URL}/admin/integrations?connected=${slug}`)
    } catch (err) {
      console.error(err)
      res.redirect(`${APP_URL}/admin/integrations?error=${encodeURIComponent(err.message)}`)
    }
  })

  app.post('/api/oauth/paystack/connect', schoolAdmin, async (req, res) => {
    try {
      const schoolId = req.user.schoolId || req.body.schoolId
      if (!schoolId) return res.status(400).json({ error: 'School context required' })
      const { publicKey, secretKey } = req.body || {}
      if (!secretKey) return res.status(400).json({ error: 'secretKey required' })
      const verified = await verifyPaystackKeys(publicKey, secretKey)
      const connection = await prisma.schoolIntegration.upsert({
        where: { schoolId_providerSlug: { schoolId, providerSlug: 'paystack' } },
        create: {
          schoolId,
          providerSlug: 'paystack',
          status: 'connected',
          connectedAt: new Date(),
          config: {
            publicKey: publicKey || null,
            secretKeyEnc: encryptSecret(secretKey),
            currency: verified.currency,
          },
        },
        update: {
          status: 'connected',
          connectedAt: new Date(),
          lastError: null,
          config: {
            publicKey: publicKey || null,
            secretKeyEnc: encryptSecret(secretKey),
            currency: verified.currency,
          },
        },
      })
      res.json({ connection: { ...connection, config: { publicKey: publicKey, currency: verified.currency } }, message: 'Paystack connected' })
    } catch (err) {
      res.status(400).json({ error: err.message })
    }
  })

  app.post('/api/oauth/flutterwave/connect', schoolAdmin, async (req, res) => {
    try {
      const schoolId = req.user.schoolId || req.body.schoolId
      if (!schoolId) return res.status(400).json({ error: 'School context required' })
      const { publicKey, secretKey, secretHash } = req.body || {}
      if (!secretKey) return res.status(400).json({ error: 'secretKey required' })
      const verified = await verifyFlutterwaveKeys(publicKey, secretKey)
      const connection = await prisma.schoolIntegration.upsert({
        where: { schoolId_providerSlug: { schoolId, providerSlug: 'flutterwave' } },
        create: {
          schoolId,
          providerSlug: 'flutterwave',
          status: 'connected',
          connectedAt: new Date(),
          config: {
            publicKey: publicKey || null,
            secretKeyEnc: encryptSecret(secretKey),
            secretHash: secretHash || null,
            currency: verified.currency,
          },
        },
        update: {
          status: 'connected',
          connectedAt: new Date(),
          lastError: null,
          config: {
            publicKey: publicKey || null,
            secretKeyEnc: encryptSecret(secretKey),
            secretHash: secretHash || null,
            currency: verified.currency,
          },
        },
      })
      res.json({ connection: { ...connection, config: { publicKey, currency: verified.currency } }, message: 'Flutterwave connected' })
    } catch (err) {
      res.status(400).json({ error: err.message })
    }
  })

  app.post('/api/oauth/stripe/connect', schoolAdmin, async (req, res) => {
    try {
      const schoolId = req.user.schoolId || req.body.schoolId
      if (!schoolId) return res.status(400).json({ error: 'School context required' })
      const { publishableKey, secretKey, webhookSecret } = req.body || {}
      if (!secretKey) return res.status(400).json({ error: 'secretKey required' })
      const verified = await verifyStripeKeys(secretKey)
      const connection = await prisma.schoolIntegration.upsert({
        where: { schoolId_providerSlug: { schoolId, providerSlug: 'stripe' } },
        create: {
          schoolId,
          providerSlug: 'stripe',
          status: 'connected',
          connectedAt: new Date(),
          config: {
            publishableKey: publishableKey || null,
            secretKeyEnc: encryptSecret(secretKey),
            webhookSecretEnc: webhookSecret ? encryptSecret(webhookSecret) : null,
            currency: verified.currency,
          },
        },
        update: {
          status: 'connected',
          connectedAt: new Date(),
          lastError: null,
          config: {
            publishableKey: publishableKey || null,
            secretKeyEnc: encryptSecret(secretKey),
            webhookSecretEnc: webhookSecret ? encryptSecret(webhookSecret) : null,
            currency: verified.currency,
          },
        },
      })
      res.json({ connection: { ...connection, config: { publishableKey, currency: verified.currency } }, message: 'Stripe connected' })
    } catch (err) {
      res.status(400).json({ error: err.message })
    }
  })
}

function registerPaymentGatewayRoutes(app, { prisma, requireRole, dispatchNotification }) {
  const payer = requireRole('Student', 'Parent', 'SuperAdmin', 'SchoolAdmin')
  const schoolAdmin = requireRole('SuperAdmin', 'SchoolAdmin')

  app.get('/api/payments/gateways', payer, async (req, res) => {
    try {
      const schoolId = req.user.schoolId || req.query.schoolId
      const gateways = await listAvailableGateways(prisma, schoolId)
      res.json({
        gateways,
        note: 'Manual transfer always available. Online gateways require school or platform configuration.',
      })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.post('/api/payments/paystack/initialize', payer, async (req, res) => {
    try {
      const { studentId, feeId, amount, installmentId, email } = req.body || {}
      if (!studentId) return res.status(400).json({ error: 'studentId required' })

      const student = await prisma.student.findUnique({
        where: { id: studentId },
        include: { user: true },
      })
      if (!student) return res.status(404).json({ error: 'Student not found' })

      const secret = await resolvePaystackSecret(prisma, student.schoolId)
      if (!secret) return res.status(400).json({ error: 'Paystack is not configured for this school' })

      const payAmount = Number(amount)
      if (!payAmount || payAmount <= 0) return res.status(400).json({ error: 'Valid amount required' })

      const { payment, reference } = await createPendingFeePayment(prisma, {
        student, studentId, feeId, amount: payAmount, installmentId, gateway: 'paystack',
      })

      const init = await paystackRequest(secret, '/transaction/initialize', {
        method: 'POST',
        body: JSON.stringify({
          email: email || student.user?.email || 'payments@schoolpilot.app',
          amount: Math.round(payAmount * 100),
          reference,
          metadata: { paymentId: payment.id, studentId, schoolId: student.schoolId },
          callback_url: paymentCallbackUrl(reference, 'paystack'),
        }),
      })

      await prisma.payment.update({
        where: { id: payment.id },
        data: { transactionId: init.data.reference },
      })

      res.json({
        paymentId: payment.id,
        reference,
        authorizationUrl: init.data.authorization_url,
        accessCode: init.data.access_code,
      })
    } catch (err) {
      console.error(err)
      res.status(400).json({ error: err.message || 'Paystack init failed' })
    }
  })

  app.post('/api/payments/flutterwave/initialize', payer, async (req, res) => {
    try {
      const { studentId, feeId, amount, installmentId, email } = req.body || {}
      if (!studentId) return res.status(400).json({ error: 'studentId required' })

      const student = await prisma.student.findUnique({
        where: { id: studentId },
        include: { user: true },
      })
      if (!student) return res.status(404).json({ error: 'Student not found' })

      const secret = await resolveFlutterwaveSecret(prisma, student.schoolId)
      if (!secret) return res.status(400).json({ error: 'Flutterwave is not configured for this school' })

      const payAmount = Number(amount)
      if (!payAmount || payAmount <= 0) return res.status(400).json({ error: 'Valid amount required' })

      const { payment, reference } = await createPendingFeePayment(prisma, {
        student, studentId, feeId, amount: payAmount, installmentId, gateway: 'flutterwave',
      })

      const init = await initializeFlutterwavePayment(secret, {
        email: email || student.user?.email || 'payments@schoolpilot.app',
        amount: payAmount,
        reference,
        callbackUrl: paymentCallbackUrl(reference, 'flutterwave'),
        metadata: { paymentId: payment.id, studentId, schoolId: student.schoolId },
      })

      await prisma.payment.update({
        where: { id: payment.id },
        data: { transactionId: init.providerRef },
      })

      res.json({ paymentId: payment.id, reference, authorizationUrl: init.authorizationUrl })
    } catch (err) {
      console.error(err)
      res.status(400).json({ error: err.message || 'Flutterwave init failed' })
    }
  })

  app.post('/api/payments/stripe/initialize', payer, async (req, res) => {
    try {
      const { studentId, feeId, amount, installmentId, email } = req.body || {}
      if (!studentId) return res.status(400).json({ error: 'studentId required' })

      const student = await prisma.student.findUnique({
        where: { id: studentId },
        include: { user: true },
      })
      if (!student) return res.status(404).json({ error: 'Student not found' })

      const secret = await resolveStripeSecret(prisma, student.schoolId)
      if (!secret) return res.status(400).json({ error: 'Stripe is not configured for this school' })

      const payAmount = Number(amount)
      if (!payAmount || payAmount <= 0) return res.status(400).json({ error: 'Valid amount required' })

      const { payment, reference } = await createPendingFeePayment(prisma, {
        student, studentId, feeId, amount: payAmount, installmentId, gateway: 'stripe',
      })

      const init = await initializeStripeCheckout(secret, {
        email: email || student.user?.email || 'payments@schoolpilot.app',
        amount: payAmount,
        reference,
        successUrl: `${paymentCallbackUrl(reference, 'stripe')}&session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${APP_URL}/student/fees?cancelled=1`,
        metadata: { paymentId: payment.id, studentId, schoolId: student.schoolId },
      })

      await prisma.payment.update({
        where: { id: payment.id },
        data: { transactionId: init.providerRef },
      })

      res.json({ paymentId: payment.id, reference, authorizationUrl: init.authorizationUrl })
    } catch (err) {
      console.error(err)
      res.status(400).json({ error: err.message || 'Stripe init failed' })
    }
  })

  app.get('/api/payments/paystack/verify', payer, async (req, res) => {
    try {
      const reference = req.query.reference
      if (!reference) return res.status(400).json({ error: 'reference required' })

      const payment = await prisma.payment.findFirst({ where: { paymentReference: String(reference) } })
      if (!payment) return res.status(404).json({ error: 'Payment not found' })
      await assertPayerAccess(prisma, req, payment)

      const secret = await resolvePaystackSecret(prisma, payment.schoolId)
      if (!secret) return res.status(400).json({ error: 'Paystack not configured' })

      const verified = await paystackRequest(secret, `/transaction/verify/${reference}`)
      const paid = (verified.data.amount || 0) / 100
      if (verified.data.status !== 'success') {
        return res.json({ status: verified.data.status, payment })
      }

      const updated = await handleSuccessfulFeePayment(prisma, payment, paid, {
        transactionId: String(verified.data.id),
        gateway: 'paystack',
        dispatchNotification,
      })
      res.json({ status: 'success', payment: updated })
    } catch (err) {
      console.error(err)
      res.status(err.status || 400).json({ error: err.message })
    }
  })

  app.get('/api/payments/flutterwave/verify', payer, async (req, res) => {
    try {
      const reference = req.query.reference
      if (!reference) return res.status(400).json({ error: 'reference required' })

      const payment = await prisma.payment.findFirst({ where: { paymentReference: String(reference) } })
      if (!payment) return res.status(404).json({ error: 'Payment not found' })
      await assertPayerAccess(prisma, req, payment)

      const secret = await resolveFlutterwaveSecret(prisma, payment.schoolId)
      if (!secret) return res.status(400).json({ error: 'Flutterwave not configured' })

      const verified = await verifyFlutterwavePayment(secret, String(reference))
      if (verified.status !== 'success') {
        return res.json({ status: verified.status, payment })
      }

      const updated = await handleSuccessfulFeePayment(prisma, payment, verified.amount, {
        transactionId: verified.transactionId,
        gateway: 'flutterwave',
        dispatchNotification,
      })
      res.json({ status: 'success', payment: updated })
    } catch (err) {
      console.error(err)
      res.status(err.status || 400).json({ error: err.message })
    }
  })

  app.get('/api/payments/stripe/verify', payer, async (req, res) => {
    try {
      const reference = req.query.reference
      const sessionId = req.query.session_id
      if (!reference && !sessionId) return res.status(400).json({ error: 'reference or session_id required' })

      let payment = reference
        ? await prisma.payment.findFirst({ where: { paymentReference: String(reference) } })
        : await prisma.payment.findFirst({ where: { transactionId: String(sessionId) } })
      if (!payment) return res.status(404).json({ error: 'Payment not found' })
      await assertPayerAccess(prisma, req, payment)

      const secret = await resolveStripeSecret(prisma, payment.schoolId)
      if (!secret) return res.status(400).json({ error: 'Stripe not configured' })

      const verifyId = sessionId || payment.transactionId
      const verified = await verifyStripeCheckout(secret, String(verifyId))
      if (verified.status !== 'success') {
        return res.json({ status: verified.status, payment })
      }

      const updated = await handleSuccessfulFeePayment(prisma, payment, verified.amount, {
        transactionId: String(verified.transactionId),
        gateway: 'stripe',
        dispatchNotification,
      })
      res.json({ status: 'success', payment: updated })
    } catch (err) {
      console.error(err)
      res.status(err.status || 400).json({ error: err.message })
    }
  })

  app.post('/api/schools/:id/subscription/paystack/initialize', schoolAdmin, async (req, res) => {
    try {
      const schoolId = req.params.id
      const { paymentId, email } = req.body || {}
      const payment = await prisma.subscriptionPayment.findFirst({ where: { id: paymentId, schoolId } })
      if (!payment) return res.status(404).json({ error: 'Payment not found' })

      const secret = process.env.PAYSTACK_SECRET_KEY
      if (!secret) return res.status(400).json({ error: 'Platform Paystack not configured' })

      const init = await paystackRequest(secret, '/transaction/initialize', {
        method: 'POST',
        body: JSON.stringify({
          email: email || req.user.email,
          amount: Math.round(payment.amount * 100),
          reference: payment.reference,
          metadata: { paymentId: payment.id, schoolId, type: 'subscription' },
          callback_url: `${APP_URL}/admin/billing?reference=${payment.reference}`,
        }),
      })

      res.json({
        authorizationUrl: init.data.authorization_url,
        reference: payment.reference,
      })
    } catch (err) {
      res.status(400).json({ error: err.message })
    }
  })

  app.post('/api/subscription/verify', schoolAdmin, async (req, res) => {
    try {
      const { reference } = req.body || {}
      if (!reference) {
        return res.status(400).json({ error: 'reference required for online verification' })
      }
      const secret = process.env.PAYSTACK_SECRET_KEY
      if (!secret) {
        return res.status(400).json({ error: 'Online verification requires PAYSTACK_SECRET_KEY. Use manual bank transfer otherwise.' })
      }

      const payment = await prisma.subscriptionPayment.findFirst({ where: { reference: String(reference) } })
      if (!payment) return res.status(404).json({ error: 'Payment not found' })

      const verified = await paystackRequest(secret, `/transaction/verify/${reference}`)
      if (verified.data.status !== 'success') {
        return res.json({ status: verified.data.status })
      }

      const paid = (verified.data.amount || 0) / 100
      const invoice = await prisma.subscriptionInvoice.findUnique({ where: { id: payment.invoiceId } })
      await prisma.subscriptionPayment.update({
        where: { id: payment.id },
        data: { status: 'completed', paidAt: new Date(), gateway: 'paystack', transactionId: String(verified.data.id) },
      })
      await prisma.subscriptionInvoice.update({
        where: { id: payment.invoiceId },
        data: { status: 'paid', paidAt: new Date(), gateway: 'paystack' },
      })

      const sub = await activateSubscription(prisma, {
        schoolId: payment.schoolId,
        planId: invoice.planId,
        billingInterval: invoice.billingInterval,
        performedById: req.user?.userId,
      })

      await createReceipt(prisma, {
        schoolId: payment.schoolId,
        paymentId: payment.id,
        invoiceId: invoice.id,
        amount: paid,
        currency: invoice.currency,
      })

      await logTransaction(prisma, {
        schoolId: payment.schoolId,
        type: 'payment',
        amount: paid,
        description: `Paystack subscription payment ${reference}`,
        performedById: req.user?.userId,
      })

      res.json({ status: 'success', subscription: sub })
    } catch (err) {
      console.error(err)
      res.status(400).json({ error: err.message })
    }
  })

  app.post('/api/webhooks/paystack', async (req, res) => {
    try {
      const rawBody = req.rawBody ? req.rawBody.toString('utf8') : JSON.stringify(req.body)
      const signature = req.headers['x-paystack-signature']
      const secret = process.env.PAYSTACK_SECRET_KEY
      if (!secret) return res.status(503).json({ error: 'Webhook not configured' })
      if (!signature || !verifyPaystackWebhookSignature(rawBody, signature, secret)) {
        return res.status(401).json({ error: 'Invalid signature' })
      }

      const event = typeof req.body === 'object' && req.body.event ? req.body : JSON.parse(rawBody)
      if (event.event === 'charge.success') {
        const reference = event.data?.reference
        const payment = await prisma.payment.findFirst({ where: { paymentReference: reference, gateway: 'paystack' } })
        if (payment && payment.status !== 'completed' && payment.status !== 'partial') {
          const paid = (event.data.amount || 0) / 100
          await handleSuccessfulFeePayment(prisma, payment, paid, {
            transactionId: String(event.data.id),
            gateway: 'paystack',
            dispatchNotification,
          })
        }
        const subPayment = await prisma.subscriptionPayment.findFirst({ where: { reference } })
        if (subPayment && subPayment.status !== 'completed') {
          const invoice = await prisma.subscriptionInvoice.findUnique({ where: { id: subPayment.invoiceId } })
          await prisma.subscriptionPayment.update({
            where: { id: subPayment.id },
            data: { status: 'completed', paidAt: new Date(), gateway: 'paystack' },
          })
          if (invoice) {
            await prisma.subscriptionInvoice.update({ where: { id: invoice.id }, data: { status: 'paid', paidAt: new Date() } })
            await activateSubscription(prisma, {
              schoolId: subPayment.schoolId,
              planId: invoice.planId,
              billingInterval: invoice.billingInterval,
            })
          }
        }
      }
      res.json({ received: true })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Webhook error' })
    }
  })

  app.post('/api/webhooks/flutterwave', async (req, res) => {
    try {
      const rawBody = req.rawBody ? req.rawBody.toString('utf8') : JSON.stringify(req.body)
      const signature = req.headers['verif-hash']
      const secretHash = process.env.FLUTTERWAVE_SECRET_HASH
      if (secretHash && !verifyFlutterwaveWebhookSignature(rawBody, signature, secretHash)) {
        return res.status(401).json({ error: 'Invalid signature' })
      }

      const event = typeof req.body === 'object' ? req.body : JSON.parse(rawBody)
      if (event.event === 'charge.completed' && event.data?.status === 'successful') {
        const reference = event.data.tx_ref
        const payment = await prisma.payment.findFirst({ where: { paymentReference: reference, gateway: 'flutterwave' } })
        if (payment && payment.status !== 'completed' && payment.status !== 'partial') {
          await handleSuccessfulFeePayment(prisma, payment, Number(event.data.amount) || payment.amount, {
            transactionId: String(event.data.id),
            gateway: 'flutterwave',
            dispatchNotification,
          })
        }
      }
      res.json({ received: true })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Webhook error' })
    }
  })

  app.post('/api/webhooks/stripe', async (req, res) => {
    try {
      const rawBody = req.rawBody ? req.rawBody.toString('utf8') : JSON.stringify(req.body)
      const signature = req.headers['stripe-signature']
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
      if (webhookSecret && !verifyStripeWebhookSignature(rawBody, signature, webhookSecret)) {
        return res.status(401).json({ error: 'Invalid signature' })
      }

      const event = typeof req.body === 'object' ? req.body : JSON.parse(rawBody)
      if (event.type === 'checkout.session.completed') {
        const session = event.data.object
        const reference = session.client_reference_id
        const payment = reference
          ? await prisma.payment.findFirst({ where: { paymentReference: reference, gateway: 'stripe' } })
          : null
        if (payment && payment.status !== 'completed' && payment.status !== 'partial') {
          const paid = (session.amount_total || 0) / 100
          await handleSuccessfulFeePayment(prisma, payment, paid, {
            transactionId: session.payment_intent || session.id,
            gateway: 'stripe',
            dispatchNotification,
          })
        }
      }
      res.json({ received: true })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Webhook error' })
    }
  })
}

module.exports = { registerOAuthRoutes, registerPaymentGatewayRoutes }
