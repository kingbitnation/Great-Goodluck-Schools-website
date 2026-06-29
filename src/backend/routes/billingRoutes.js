const crypto = require('crypto')
const {
  mergeLimits,
  priceForInterval,
  buildComparisonMatrix,
  PLAN_ORDER,
  resolvePlanSlug,
} = require('../lib/planLimits')
const {
  generateRef,
  applyCoupon,
  applyPromoCode,
  activateSubscription,
  suspendSchool,
  reactivateSchool,
  grantFreeMonths,
  changePlan,
  buildSchoolBillingDashboard,
  createReceipt,
  logTransaction,
  billingPeriodEnd,
  seedPlanFeatures,
  approveManualSubscriptionPayment,
} = require('../lib/subscriptionHelpers')
const { platformBankDetails } = require('../lib/manualPaymentHelpers')
const { streamSubscriptionInvoicePdf } = require('../lib/subscriptionInvoicePdf')
const { assertSameSchool } = require('../middleware/tenantGuard')
const { buildBillingAnalytics } = require('../lib/billingAnalytics')

const APP_URL = process.env.APP_URL || 'http://localhost:3000'
const PLATFORM_BANK = {
  bankName: process.env.PLATFORM_BANK_NAME || 'Zenith Bank',
  accountName: process.env.PLATFORM_BANK_ACCOUNT_NAME || 'SchoolPilot Ltd',
  accountNumber: process.env.PLATFORM_BANK_ACCOUNT_NUMBER || '1234567890',
}

function registerBillingRoutes(app, { prisma, requireRole, enqueueEmail, dispatchNotification }) {
  const superAdmin = requireRole('SuperAdmin')
  const schoolAdmin = requireRole('SuperAdmin', 'SchoolAdmin')

  async function notifyBilling({ schoolId, userId, type, title, message, channels = ['email', 'in_app'] }) {
    if (dispatchNotification) {
      await dispatchNotification(prisma, { schoolId, userId, type, title, message, channels }).catch(() => {})
    }
    if (enqueueEmail && channels.includes('email') && userId) {
      const user = await prisma.user.findUnique({ where: { id: userId } })
      if (user?.email) {
        await enqueueEmail({ to: user.email, subject: title, body: message, template: type }).catch(() => {})
      }
    }
  }

  // ===== PUBLIC PLANS =====
  app.get('/api/subscription-plans', async (_req, res) => {
    try {
      const plans = await prisma.subscriptionPlan.findMany({
        where: { isActive: true, isArchived: false },
        orderBy: { sortOrder: 'asc' },
        include: { planFeatures: { orderBy: { sortOrder: 'asc' } } },
      })
      res.json(plans.map((p) => ({
        ...p,
        limits: mergeLimits(p),
        priceMonthly: p.price,
        priceQuarterly: p.quarterlyPrice,
        priceYearly: p.yearlyPrice,
        displayPrice: p.contactSales ? null : p.price,
      })))
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.get('/api/subscription-plans/compare', async (_req, res) => {
    try {
      res.json(buildComparisonMatrix())
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  // ===== SCHOOL BILLING DASHBOARD =====
  app.get('/api/schools/:id/billing', schoolAdmin, async (req, res) => {
    try {
      if (!assertSameSchool(req.user, req.params.id)) return res.status(403).json({ error: 'Forbidden' })
      res.json(await buildSchoolBillingDashboard(prisma, req.params.id))
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.get('/api/schools/:id/subscription', schoolAdmin, async (req, res) => {
    try {
      if (!assertSameSchool(req.user, req.params.id)) return res.status(403).json({ error: 'Forbidden' })
      const dash = await buildSchoolBillingDashboard(prisma, req.params.id)
      res.json({
        subscription: dash.subscription,
        invoices: dash.invoices,
        studentCount: dash.usage.students.used,
        usage: dash.usage,
      })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.put('/api/schools/:id/subscription/auto-renew', schoolAdmin, async (req, res) => {
    try {
      if (!assertSameSchool(req.user, req.params.id)) return res.status(403).json({ error: 'Forbidden' })
      const { autoRenew } = req.body
      const sub = await prisma.schoolSubscription.update({
        where: { schoolId: req.params.id },
        data: { autoRenew: !!autoRenew },
      })
      res.json(sub)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.post('/api/schools/:id/subscription/checkout', schoolAdmin, async (req, res) => {
    try {
      if (!assertSameSchool(req.user, req.params.id)) return res.status(403).json({ error: 'Forbidden' })
      const { planSlug, billingInterval = 'monthly', couponCode, promoCode } = req.body
      const gateway = 'manual'
      const plan = await prisma.subscriptionPlan.findUnique({ where: { slug: planSlug } })
      if (!plan) return res.status(404).json({ error: 'Plan not found' })
      if (plan.contactSales) {
        return res.status(400).json({ error: 'Contact sales for Ultimate plan pricing', contactSales: true })
      }

      const school = await prisma.school.findUnique({ where: { id: req.params.id } })
      const reference = generateRef('SUB')

      let amount = priceForInterval(plan, billingInterval)
      const couponResult = await applyCoupon(prisma, couponCode, plan.slug, amount)
      amount = couponResult.amount
      const promoResult = await applyPromoCode(prisma, promoCode, plan.slug, amount)
      amount = promoResult.amount
      const totalDiscount = couponResult.discount + promoResult.discount

      const invoice = await prisma.subscriptionInvoice.create({
        data: {
          schoolId: school.id,
          planId: plan.id,
          amount,
          discountAmount: totalDiscount,
          currency: plan.currency,
          reference,
          gateway,
          billingInterval,
          couponCode: couponResult.coupon?.code || null,
          promoCode: promoResult.promo?.code || null,
          dueAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          metadata: { billingInterval, planSlug },
        },
      })

      if (couponResult.coupon) {
        await prisma.billingCoupon.update({
          where: { id: couponResult.coupon.id },
          data: { usedCount: { increment: 1 } },
        })
      }
      if (promoResult.promo) {
        await prisma.promoCode.update({
          where: { id: promoResult.promo.id },
          data: { usedCount: { increment: 1 } },
        })
      }

      const payment = await prisma.subscriptionPayment.create({
        data: {
          schoolId: school.id,
          invoiceId: invoice.id,
          amount,
          gateway: 'manual',
          reference: generateRef('MAN'),
          status: 'pending',
        },
      })
      return res.json({
        invoiceId: invoice.id,
        paymentId: payment.id,
        reference: payment.reference,
        amount,
        billingInterval,
        bankDetails: platformBankDetails({ amount, reference: payment.reference }),
        manual: true,
        paystackAvailable: !!process.env.PAYSTACK_SECRET_KEY,
        discount: totalDiscount,
      })
    } catch (err) {
      console.error(err)
      res.status(400).json({ error: err.message || 'Checkout failed' })
    }
  })

  app.post('/api/schools/:id/subscription/manual-payment', schoolAdmin, async (req, res) => {
    try {
      if (!assertSameSchool(req.user, req.params.id)) return res.status(403).json({ error: 'Forbidden' })
      const { paymentId, proofUrl, fileBase64, mimeType } = req.body
      if (!paymentId) return res.status(400).json({ error: 'paymentId required' })

      const { storeReceiptUpload } = require('../lib/receiptUploadHelpers')
      let proof = proofUrl?.trim() || null
      if (fileBase64) {
        proof = await storeReceiptUpload({ fileBase64, mimeType, folder: 'subscription-receipts' })
      }
      if (!proof) return res.status(400).json({ error: 'Upload a payment receipt or provide proof URL' })

      const payment = await prisma.subscriptionPayment.findFirst({
        where: { id: paymentId, schoolId: req.params.id },
      })
      if (!payment) return res.status(404).json({ error: 'Payment not found' })

      const updated = await prisma.subscriptionPayment.update({
        where: { id: paymentId },
        data: { proofUrl: proof, status: 'under_review' },
      })

      const superAdmins = await prisma.user.findMany({ where: { role: { name: 'SuperAdmin' } } })
      for (const admin of superAdmins) {
        await notifyBilling({
          schoolId: req.params.id,
          userId: admin.id,
          type: 'payment_pending_review',
          title: 'Manual payment pending review',
          message: `School submitted manual payment ${payment.reference} for review.`,
        })
      }

      res.json(updated)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.post('/api/schools/:id/subscription/cancel', schoolAdmin, async (req, res) => {
    try {
      if (!assertSameSchool(req.user, req.params.id)) return res.status(403).json({ error: 'Forbidden' })
      const sub = await prisma.schoolSubscription.update({
        where: { schoolId: req.params.id },
        data: { status: 'cancelled', cancelledAt: new Date(), autoRenew: false },
      })
      await logTransaction(prisma, {
        schoolId: req.params.id,
        type: 'cancel',
        description: 'Subscription cancelled',
        performedById: req.user.userId,
      })
      res.json(sub)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.post('/api/schools/:id/subscription/change-plan', schoolAdmin, async (req, res) => {
    try {
      if (!assertSameSchool(req.user, req.params.id)) return res.status(403).json({ error: 'Forbidden' })
      const { planSlug, billingInterval } = req.body
      const plan = await prisma.subscriptionPlan.findUnique({ where: { slug: planSlug } })
      if (!plan) return res.status(404).json({ error: 'Plan not found' })
      if (plan.contactSales) return res.status(400).json({ error: 'Contact sales for Ultimate plan' })

      const current = await prisma.schoolSubscription.findUnique({
        where: { schoolId: req.params.id },
        include: { plan: true },
      })
      const isUpgrade = PLAN_ORDER.indexOf(resolvePlanSlug(plan.slug))
        > PLAN_ORDER.indexOf(resolvePlanSlug(current?.plan?.slug))

      if (!isUpgrade) {
        const updated = await changePlan(prisma, req.params.id, plan.id, {
          billingInterval,
          performedById: req.user.userId,
          immediate: false,
        })
        return res.json({ subscription: updated, requiresPayment: false })
      }

      const amount = priceForInterval(plan, billingInterval || current?.billingInterval || 'monthly')
      const reference = generateRef('CHG')
      const invoice = await prisma.subscriptionInvoice.create({
        data: {
          schoolId: req.params.id,
          planId: plan.id,
          amount,
          reference,
          gateway: 'manual',
          billingInterval: billingInterval || current?.billingInterval || 'monthly',
          metadata: { changePlan: true },
        },
      })
      res.json({ requiresPayment: true, invoice, message: 'Complete payment to upgrade' })
    } catch (err) {
      console.error(err)
      res.status(400).json({ error: err.message })
    }
  })

  // ===== ADD-ONS =====
  app.get('/api/addons', async (_req, res) => {
    try {
      const addons = await prisma.addonCatalog.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
      })
      res.json(addons)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.post('/api/schools/:id/addons/purchase', schoolAdmin, async (req, res) => {
    try {
      if (!assertSameSchool(req.user, req.params.id)) return res.status(403).json({ error: 'Forbidden' })
      const { addonSlug, gateway = 'manual' } = req.body
      const addon = await prisma.addonCatalog.findUnique({ where: { slug: addonSlug } })
      if (!addon) return res.status(404).json({ error: 'Add-on not found' })

      const expiresAt = addon.billingType === 'monthly'
        ? billingPeriodEnd('monthly')
        : addon.billingType === 'yearly'
          ? billingPeriodEnd('yearly')
          : null

      const schoolAddon = await prisma.schoolAddon.create({
        data: {
          schoolId: req.params.id,
          addonId: addon.id,
          status: gateway === 'manual' ? 'pending' : 'active',
          price: addon.price,
          expiresAt,
        },
      })

      if (gateway === 'manual') {
        const payment = await prisma.subscriptionPayment.create({
          data: {
            schoolId: req.params.id,
            amount: addon.price,
            gateway: 'manual',
            reference: generateRef('ADD'),
            status: 'pending',
            metadata: { addonId: addon.id, schoolAddonId: schoolAddon.id },
          },
        })
        return res.json({ schoolAddon, payment, bankDetails: { ...PLATFORM_BANK, amount: addon.price, reference: payment.reference } })
      }

      res.json({ schoolAddon })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  // ===== SUPER ADMIN BILLING =====
  app.get('/api/platform/billing/dashboard', superAdmin, async (_req, res) => {
    try {
      res.json(await buildBillingAnalytics(prisma))
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.get('/api/platform/billing/payments', superAdmin, async (req, res) => {
    try {
      const { status } = req.query
      const where = status ? { status: String(status) } : {}
      const payments = await prisma.subscriptionPayment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 100,
        include: { school: { select: { id: true, name: true } }, invoice: { include: { plan: true } } },
      })
      res.json(payments)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.post('/api/platform/billing/payments/:id/approve', superAdmin, async (req, res) => {
    try {
      const result = await approveManualSubscriptionPayment(prisma, req.params.id, req.user.userId)

      const admin = await prisma.user.findFirst({
        where: { schoolId: result.payment.schoolId, role: { name: 'SchoolAdmin' } },
      })
      if (admin) {
        await notifyBilling({
          schoolId: result.payment.schoolId,
          userId: admin.id,
          type: 'payment_approved',
          title: 'Payment approved',
          message: 'Your manual payment has been approved. Your subscription is now active.',
        })
      }

      res.json(result)
    } catch (err) {
      console.error(err)
      res.status(400).json({ error: err.message })
    }
  })

  app.post('/api/platform/billing/payments/:id/reject', superAdmin, async (req, res) => {
    try {
      const { note } = req.body
      const payment = await prisma.subscriptionPayment.update({
        where: { id: req.params.id },
        data: {
          status: 'rejected',
          reviewNote: note || 'Payment rejected',
          reviewedById: req.user.userId,
          reviewedAt: new Date(),
        },
        include: { school: true },
      })

      const admin = await prisma.user.findFirst({
        where: { schoolId: payment.schoolId, role: { name: 'SchoolAdmin' } },
      })
      if (admin) {
        await notifyBilling({
          schoolId: payment.schoolId,
          userId: admin.id,
          type: 'payment_rejected',
          title: 'Payment rejected',
          message: note || 'Your manual payment was rejected. Please contact support.',
        })
      }

      res.json(payment)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.post('/api/platform/schools/:schoolId/suspend', superAdmin, async (req, res) => {
    try {
      const { reason } = req.body
      await suspendSchool(prisma, req.params.schoolId, { reason, performedById: req.user.userId })
      res.json({ message: 'School suspended' })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.post('/api/platform/schools/:schoolId/reactivate', superAdmin, async (req, res) => {
    try {
      const { extendDays } = req.body
      await reactivateSchool(prisma, req.params.schoolId, {
        performedById: req.user.userId,
        extendDays: extendDays || 0,
      })
      const admin = await prisma.user.findFirst({
        where: { schoolId: req.params.schoolId, role: { name: 'SchoolAdmin' } },
      })
      if (admin) {
        await notifyBilling({
          schoolId: req.params.schoolId,
          userId: admin.id,
          type: 'school_reactivated',
          title: 'School reactivated',
          message: 'Your school account has been reactivated by SchoolPilot support.',
        })
      }
      res.json({ message: 'School reactivated' })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.post('/api/platform/schools/:schoolId/grant-months', superAdmin, async (req, res) => {
    try {
      const { months } = req.body
      if (!months || months < 1) return res.status(400).json({ error: 'months required' })
      const end = await grantFreeMonths(prisma, req.params.schoolId, Number(months), req.user.userId)
      res.json({ currentPeriodEnd: end })
    } catch (err) {
      console.error(err)
      res.status(400).json({ error: err.message })
    }
  })

  app.post('/api/platform/schools/:schoolId/change-plan', superAdmin, async (req, res) => {
    try {
      const { planSlug, billingInterval } = req.body
      const plan = await prisma.subscriptionPlan.findUnique({ where: { slug: planSlug } })
      if (!plan) return res.status(404).json({ error: 'Plan not found' })
      const sub = await changePlan(prisma, req.params.schoolId, plan.id, {
        billingInterval,
        performedById: req.user.userId,
        immediate: true,
      })
      res.json(sub)
    } catch (err) {
      console.error(err)
      res.status(400).json({ error: err.message })
    }
  })

  app.get('/api/platform/billing/transactions', superAdmin, async (req, res) => {
    try {
      const { schoolId } = req.query
      const where = schoolId ? { schoolId: String(schoolId) } : {}
      const logs = await prisma.subscriptionTransactionLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 200,
        include: { school: { select: { name: true } } },
      })
      res.json(logs)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.get('/api/platform/billing/reports/:type', superAdmin, async (req, res) => {
    try {
      const analytics = await buildBillingAnalytics(prisma)
      const { type } = req.params
      const format = req.query.format || 'json'

      let data
      switch (type) {
        case 'revenue': data = analytics.revenue; break
        case 'subscriptions': data = analytics.planDistribution; break
        case 'trials': data = analytics.trials; break
        case 'outstanding': data = analytics.pendingPayments; break
        default: data = analytics
      }

      if (format === 'csv') {
        const rows = Array.isArray(data) ? data : [data]
        const headers = rows[0] ? Object.keys(rows[0]).join(',') : ''
        const body = rows.map((r) => Object.values(r).join(',')).join('\n')
        res.type('text/csv').send(`${headers}\n${body}`)
        return
      }
      res.json(data)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  // Plan clone
  app.post('/api/platform/plans/:id/clone', superAdmin, async (req, res) => {
    try {
      const source = await prisma.subscriptionPlan.findUnique({
        where: { id: req.params.id },
        include: { planFeatures: true },
      })
      if (!source) return res.status(404).json({ error: 'Plan not found' })
      const slug = `${source.slug}-copy-${crypto.randomBytes(2).toString('hex')}`
      const plan = await prisma.subscriptionPlan.create({
        data: {
          name: `${source.name} (Copy)`,
          slug,
          description: source.description,
          price: source.price,
          quarterlyPrice: source.quarterlyPrice,
          yearlyPrice: source.yearlyPrice,
          limits: source.limits,
          features: source.features,
          maxStudents: source.maxStudents,
          trialDays: source.trialDays,
          graceDays: source.graceDays,
          sortOrder: source.sortOrder + 1,
          isActive: false,
        },
      })
      if (source.planFeatures.length) {
        await prisma.planFeature.createMany({
          data: source.planFeatures.map((f) => ({
            planId: plan.id,
            key: f.key,
            label: f.label,
            enabled: f.enabled,
            category: f.category,
            sortOrder: f.sortOrder,
          })),
        })
      }
      res.status(201).json(plan)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.delete('/api/platform/plans/:id', superAdmin, async (req, res) => {
    try {
      const subs = await prisma.schoolSubscription.count({ where: { planId: req.params.id } })
      if (subs > 0) {
        const plan = await prisma.subscriptionPlan.update({
          where: { id: req.params.id },
          data: { isArchived: true, isActive: false },
        })
        return res.json({ archived: true, plan })
      }
      await prisma.planFeature.deleteMany({ where: { planId: req.params.id } })
      await prisma.subscriptionPlan.delete({ where: { id: req.params.id } })
      res.json({ deleted: true })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.get('/api/subscription/invoices/:id/pdf', schoolAdmin, async (req, res) => {
    try {
      const invoice = await prisma.subscriptionInvoice.findUnique({
        where: { id: req.params.id },
        include: { plan: true, school: true },
      })
      if (!invoice) return res.status(404).json({ error: 'Not found' })
      if (req.user.role !== 'SuperAdmin' && !assertSameSchool(req.user, invoice.schoolId)) {
        return res.status(403).json({ error: 'Forbidden' })
      }
      await streamSubscriptionInvoicePdf(res, invoice)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.get('/api/subscription/receipts/:id', schoolAdmin, async (req, res) => {
    try {
      const receipt = await prisma.subscriptionReceipt.findUnique({
        where: { id: req.params.id },
        include: { payment: true, invoice: { include: { plan: true } }, school: true },
      })
      if (!receipt) return res.status(404).json({ error: 'Not found' })
      if (req.user.role !== 'SuperAdmin' && !assertSameSchool(req.user, receipt.schoolId)) {
        return res.status(403).json({ error: 'Forbidden' })
      }
      res.json(receipt)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })
}

module.exports = { registerBillingRoutes }
