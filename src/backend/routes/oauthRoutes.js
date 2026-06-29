const { encryptSecret } = require('../lib/credentialCrypto')
const {
  oauthConfigured,
  buildAuthorizeUrl,
  exchangeCode,
  parseOAuthState,
  verifyPaystackKeys,
  verifyPaystackWebhookSignature,
  resolvePaystackSecret,
  paystackRequest,
  PROVIDERS,
  APP_URL,
} = require('../lib/oauthProviders')
const { completePayment } = require('../lib/financeHelpers')
const { activateSubscription, createReceipt, logTransaction } = require('../lib/subscriptionHelpers')
const { deliverWebhook } = require('../lib/webhookDispatcher')

function registerOAuthRoutes(app, { prisma, requireRole }) {
  const schoolAdmin = requireRole('SuperAdmin', 'SchoolAdmin')

  app.get('/api/oauth/status', schoolAdmin, (_req, res) => {
    res.json({
      google: oauthConfigured('google'),
      zoom: oauthConfigured('zoom'),
      paystack: !!(process.env.PAYSTACK_SECRET_KEY),
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
}

function registerPaymentGatewayRoutes(app, { prisma, requireRole, dispatchNotification }) {
  const payer = requireRole('Student', 'Parent', 'SuperAdmin', 'SchoolAdmin')
  const schoolAdmin = requireRole('SuperAdmin', 'SchoolAdmin')

  app.get('/api/payments/gateways', payer, async (req, res) => {
    try {
      const schoolId = req.user.schoolId || req.query.schoolId
      const gateways = [{ id: 'manual', label: 'Bank transfer', available: true }]
      if (schoolId) {
        const paystack = await prisma.schoolIntegration.findUnique({
          where: { schoolId_providerSlug: { schoolId, providerSlug: 'paystack' } },
        })
        if (paystack?.status === 'connected') {
          gateways.push({ id: 'paystack', label: 'Paystack (card, bank, USSD)', available: true, publicKey: paystack.config?.publicKey })
        }
      }
      if (process.env.PAYSTACK_SECRET_KEY) {
        if (!gateways.find((g) => g.id === 'paystack')) {
          gateways.push({ id: 'paystack', label: 'Paystack', available: true })
        }
      }
      res.json({ gateways, note: 'Manual transfer always available. Online gateways require school or platform Paystack configuration.' })
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
        include: { user: true, school: true },
      })
      if (!student) return res.status(404).json({ error: 'Student not found' })

      const secret = await resolvePaystackSecret(prisma, student.schoolId)
      if (!secret) return res.status(400).json({ error: 'Paystack is not configured for this school' })

      const payAmount = Number(amount)
      if (!payAmount || payAmount <= 0) return res.status(400).json({ error: 'Valid amount required' })

      const reference = `GGS-PAY-${Date.now().toString(36).toUpperCase()}`
      const payment = await prisma.payment.create({
        data: {
          schoolId: student.schoolId,
          studentId,
          feeId: feeId || null,
          installmentId: installmentId || null,
          amount: payAmount,
          paidAmount: 0,
          gateway: 'paystack',
          status: 'pending',
          verificationStatus: 'pending',
          paymentReference: reference,
        },
      })

      const init = await paystackRequest(secret, '/transaction/initialize', {
        method: 'POST',
        body: JSON.stringify({
          email: email || student.user?.email || 'payments@schoolpilot.app',
          amount: Math.round(payAmount * 100),
          reference,
          metadata: { paymentId: payment.id, studentId, schoolId: student.schoolId },
          callback_url: `${APP_URL}/payment/callback?reference=${reference}`,
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

  app.get('/api/payments/paystack/verify', payer, async (req, res) => {
    try {
      const reference = req.query.reference
      if (!reference) return res.status(400).json({ error: 'reference required' })

      const payment = await prisma.payment.findFirst({ where: { paymentReference: String(reference) } })
      if (!payment) return res.status(404).json({ error: 'Payment not found' })

      const student = await prisma.student.findUnique({ where: { id: payment.studentId }, include: { user: true } })
      if (req.user.role === 'Student') {
        const me = await prisma.student.findUnique({ where: { userId: req.user.userId } })
        if (!me || me.id !== payment.studentId) return res.status(403).json({ error: 'Forbidden' })
      }

      const secret = await resolvePaystackSecret(prisma, payment.schoolId)
      if (!secret) return res.status(400).json({ error: 'Paystack not configured' })

      const verified = await paystackRequest(secret, `/transaction/verify/${reference}`)
      const paid = (verified.data.amount || 0) / 100
      if (verified.data.status !== 'success') {
        return res.json({ status: verified.data.status, payment })
      }

      const updated = await completePayment(prisma, payment, paid, {
        transactionId: verified.data.id,
        extra: { verificationStatus: 'approved', gateway: 'paystack' },
      })

      if (dispatchNotification && updated.student?.user) {
        await dispatchNotification(prisma, {
          userId: updated.student.user.id,
          schoolId: payment.schoolId,
          type: 'payment',
          title: 'Payment received',
          body: `Your payment of ₦${paid} was confirmed via Paystack.`,
          channels: ['in_app', 'email'],
          email: updated.student.user.email,
        }).catch(() => {})
      }

      await deliverWebhook(prisma, {
        schoolId: payment.schoolId,
        event: 'payment.approved',
        payload: { paymentId: payment.id, amount: paid, gateway: 'paystack' },
      }).catch(() => {})

      res.json({ status: 'success', payment: updated })
    } catch (err) {
      console.error(err)
      res.status(400).json({ error: err.message })
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
        if (payment && payment.status !== 'completed') {
          const paid = (event.data.amount || 0) / 100
          await completePayment(prisma, payment, paid, {
            transactionId: String(event.data.id),
            extra: { verificationStatus: 'approved' },
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
}

module.exports = { registerOAuthRoutes, registerPaymentGatewayRoutes }
