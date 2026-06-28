const crypto = require('crypto')
const {
  mergeLimits,
  priceForInterval,
  minimumPlanForFeature,
  comparePlans,
  resolvePlanSlug,
} = require('./planLimits')

function billingPeriodEnd(interval, from = new Date()) {
  const end = new Date(from)
  if (interval === 'yearly') end.setFullYear(end.getFullYear() + 1)
  else if (interval === 'quarterly') end.setMonth(end.getMonth() + 3)
  else end.setMonth(end.getMonth() + 1)
  return end
}

function generateRef(prefix) {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`
}

function generateReceiptNumber() {
  return `RCP-${Date.now().toString(36).toUpperCase()}`
}

async function logTransaction(prisma, { schoolId, type, amount, description, performedById, metadata }) {
  return prisma.subscriptionTransactionLog.create({
    data: {
      schoolId,
      type,
      amount: amount ?? null,
      description: description || null,
      performedById: performedById || null,
      metadata: metadata || null,
    },
  })
}

async function applyCoupon(prisma, code, planSlug, amount) {
  if (!code) return { amount, coupon: null, discount: 0 }
  const coupon = await prisma.billingCoupon.findUnique({
    where: { code: String(code).toUpperCase() },
  })
  if (!coupon || !coupon.isActive) throw new Error('Invalid coupon')
  if (coupon.validUntil && coupon.validUntil < new Date()) throw new Error('Coupon expired')
  if (coupon.maxUses != null && coupon.usedCount >= coupon.maxUses) throw new Error('Coupon fully redeemed')
  if (coupon.planSlugs?.length && !coupon.planSlugs.includes(planSlug)) {
    throw new Error('Coupon not valid for this plan')
  }
  let discount = 0
  if (coupon.discountType === 'percent') discount = amount * (coupon.discountValue / 100)
  else discount = coupon.discountValue
  return { amount: Math.max(0, amount - discount), coupon, discount }
}

async function applyPromoCode(prisma, code, planSlug, amount) {
  if (!code) return { amount, promo: null, discount: 0 }
  const promo = await prisma.promoCode.findUnique({
    where: { code: String(code).toUpperCase() },
  })
  if (!promo || !promo.isActive) throw new Error('Invalid promo code')
  if (promo.validUntil && promo.validUntil < new Date()) throw new Error('Promo code expired')
  if (promo.maxUses != null && promo.usedCount >= promo.maxUses) throw new Error('Promo code fully redeemed')
  if (promo.planSlugs?.length && !promo.planSlugs.includes(planSlug)) {
    throw new Error('Promo code not valid for this plan')
  }
  let discount = 0
  if (promo.discountType === 'percent') discount = amount * (promo.discountValue / 100)
  else discount = promo.discountValue
  return { amount: Math.max(0, amount - discount), promo, discount }
}

async function createReceipt(prisma, { schoolId, paymentId, invoiceId, amount, currency = 'NGN' }) {
  return prisma.subscriptionReceipt.create({
    data: {
      schoolId,
      paymentId: paymentId || null,
      invoiceId: invoiceId || null,
      receiptNumber: generateReceiptNumber(),
      amount,
      currency,
    },
  })
}

async function activateSubscription(prisma, {
  schoolId,
  planId,
  billingInterval = 'monthly',
  invoiceId,
  paymentId,
  performedById,
  freeMonths = 0,
}) {
  let periodEnd = billingPeriodEnd(billingInterval)
  if (freeMonths > 0) periodEnd.setMonth(periodEnd.getMonth() + freeMonths)

  const sub = await prisma.schoolSubscription.upsert({
    where: { schoolId },
    update: {
      planId,
      status: 'active',
      billingInterval,
      currentPeriodEnd: periodEnd,
      graceEndsAt: null,
      cancelledAt: null,
      suspendedAt: null,
      manualOverride: false,
      reactivatedAt: new Date(),
    },
    create: {
      schoolId,
      planId,
      status: 'active',
      billingInterval,
      currentPeriodEnd: periodEnd,
    },
  })

  if (invoiceId) {
    await prisma.subscriptionInvoice.update({
      where: { id: invoiceId },
      data: { status: 'paid', paidAt: new Date() },
    })
  }

  if (paymentId) {
    await prisma.subscriptionPayment.update({
      where: { id: paymentId },
      data: { status: 'completed', reviewedAt: new Date() },
    })
  }

  await prisma.school.update({
    where: { id: schoolId },
    data: { status: 'active' },
  })

  await prisma.schoolOnboarding.updateMany({
    where: { schoolId },
    data: { subscriptionDone: true },
  })

  await logTransaction(prisma, {
    schoolId,
    type: 'activation',
    description: `Subscription activated (${billingInterval})`,
    performedById,
    metadata: { planId, invoiceId, paymentId, freeMonths },
  })

  return sub
}

async function suspendSchool(prisma, schoolId, { reason, performedById } = {}) {
  await prisma.school.update({ where: { id: schoolId }, data: { status: 'suspended' } })
  await prisma.schoolSubscription.updateMany({
    where: { schoolId },
    data: { status: 'suspended', suspendedAt: new Date() },
  })
  await logTransaction(prisma, {
    schoolId,
    type: 'suspend',
    description: reason || 'School suspended',
    performedById,
  })
}

async function reactivateSchool(prisma, schoolId, { performedById, extendDays = 0 } = {}) {
  const sub = await prisma.schoolSubscription.findUnique({ where: { schoolId } })
  const periodEnd = sub?.currentPeriodEnd && sub.currentPeriodEnd > new Date()
    ? sub.currentPeriodEnd
    : billingPeriodEnd(sub?.billingInterval || 'monthly')
  if (extendDays > 0) periodEnd.setDate(periodEnd.getDate() + extendDays)

  await prisma.school.update({ where: { id: schoolId }, data: { status: 'active' } })
  await prisma.schoolSubscription.update({
    where: { schoolId },
    data: {
      status: 'active',
      manualOverride: true,
      currentPeriodEnd: periodEnd,
      reactivatedAt: new Date(),
      suspendedAt: null,
      graceEndsAt: null,
    },
  })
  await logTransaction(prisma, {
    schoolId,
    type: 'reactivate',
    description: 'School reactivated by platform admin',
    performedById,
    metadata: { extendDays },
  })
}

async function grantFreeMonths(prisma, schoolId, months, performedById) {
  const sub = await prisma.schoolSubscription.findUnique({ where: { schoolId } })
  if (!sub) throw new Error('Subscription not found')
  const base = sub.currentPeriodEnd && sub.currentPeriodEnd > new Date()
    ? sub.currentPeriodEnd
    : new Date()
  const extended = new Date(base)
  extended.setMonth(extended.getMonth() + months)
  await prisma.schoolSubscription.update({
    where: { schoolId },
    data: {
      currentPeriodEnd: extended,
      freeMonthsGranted: { increment: months },
      status: 'active',
      manualOverride: true,
    },
  })
  await logTransaction(prisma, {
    schoolId,
    type: 'grant_months',
    description: `Granted ${months} free month(s)`,
    performedById,
    metadata: { months },
  })
  return extended
}

async function changePlan(prisma, schoolId, planId, { billingInterval, performedById, immediate = true } = {}) {
  const plan = await prisma.subscriptionPlan.findUnique({ where: { id: planId } })
  if (!plan) throw new Error('Plan not found')
  const sub = await prisma.schoolSubscription.findUnique({ where: { schoolId }, include: { plan: true } })
  if (!sub) throw new Error('Subscription not found')

  const oldSlug = resolvePlanSlug(sub.plan?.slug)
  const newSlug = resolvePlanSlug(plan.slug)
  const isUpgrade = ['starter', 'standard', 'professional', 'enterprise', 'ultimate'].indexOf(newSlug)
    > ['starter', 'standard', 'professional', 'enterprise', 'ultimate'].indexOf(oldSlug)

  const data = { planId }
  if (billingInterval) data.billingInterval = billingInterval
  if (immediate) {
    data.status = 'active'
    data.currentPeriodEnd = billingPeriodEnd(billingInterval || sub.billingInterval)
  }

  const updated = await prisma.schoolSubscription.update({ where: { schoolId }, data })
  await logTransaction(prisma, {
    schoolId,
    type: isUpgrade ? 'upgrade' : 'downgrade',
    description: `Plan changed from ${sub.plan?.name} to ${plan.name}`,
    performedById,
    metadata: { oldPlanId: sub.planId, newPlanId: planId },
  })
  return updated
}

async function buildSchoolBillingDashboard(prisma, schoolId) {
  const [school, sub, studentCount, teacherCount, staffCount, invoices, payments, receipts, addons, usage, aiBalance, notifSetting] =
    await Promise.all([
      prisma.school.findUnique({ where: { id: schoolId } }),
      prisma.schoolSubscription.findUnique({
        where: { schoolId },
        include: { plan: { include: { planFeatures: { orderBy: { sortOrder: 'asc' } } } } },
      }),
      prisma.student.count({ where: { schoolId } }),
      prisma.teacher.count({ where: { schoolId } }),
      prisma.employee.count({ where: { schoolId } }),
      prisma.subscriptionInvoice.findMany({ where: { schoolId }, orderBy: { createdAt: 'desc' }, take: 20, include: { plan: true } }),
      prisma.subscriptionPayment.findMany({ where: { schoolId }, orderBy: { createdAt: 'desc' }, take: 20 }),
      prisma.subscriptionReceipt.findMany({ where: { schoolId }, orderBy: { issuedAt: 'desc' }, take: 20 }),
      prisma.schoolAddon.findMany({ where: { schoolId, status: 'active' }, include: { addon: true } }),
      prisma.schoolUsageDaily.findFirst({ where: { schoolId }, orderBy: { date: 'desc' } }),
      prisma.aiCreditBalance.findUnique({ where: { schoolId } }),
      prisma.notificationSetting.findUnique({ where: { schoolId } }),
    ])

  const limits = mergeLimits(sub?.plan)
  const trialDaysRemaining = sub?.trialEndsAt
    ? Math.max(0, Math.ceil((sub.trialEndsAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000)))
    : 0

  const storageBytes = usage?.storageBytes ? Number(usage.storageBytes) : 0
  const storageGb = storageBytes / (1024 ** 3)
  const storageLimitGb = limits.storageGb

  return {
    school: { id: school?.id, name: school?.name, status: school?.status },
    subscription: sub
      ? {
          ...sub,
          plan: {
            ...sub.plan,
            limits,
            priceMonthly: sub.plan.price,
            priceQuarterly: sub.plan.quarterlyPrice,
            priceYearly: sub.plan.yearlyPrice,
          },
          trialDaysRemaining,
        }
      : null,
    usage: {
      students: { used: studentCount, limit: limits.maxStudents },
      teachers: { used: teacherCount, limit: limits.maxTeachers },
      staff: { used: staffCount, limit: limits.maxStaff },
      storage: {
        usedGb: Math.round(storageGb * 100) / 100,
        limitGb: storageLimitGb,
        percent: storageLimitGb ? Math.min(100, Math.round((storageGb / storageLimitGb) * 100)) : 0,
      },
      smsBalance: notifSetting ? limits.smsCredits : 0,
      emailsSent: usage?.emailsSent || 0,
      emailLimit: limits.monthlyEmails,
      aiCredits: aiBalance?.balance ?? 0,
      aiUsed: aiBalance?.usedThisMonth ?? 0,
      apiRequests: usage?.apiRequests || 0,
    },
    invoices,
    payments,
    receipts,
    addons,
    bankDetails: {
      bankName: process.env.PLATFORM_BANK_NAME || 'Zenith Bank',
      accountName: process.env.PLATFORM_BANK_ACCOUNT_NAME || 'SchoolPilot Ltd',
      accountNumber: process.env.PLATFORM_BANK_ACCOUNT_NUMBER || '',
    },
    featureAvailability: limits,
  }
}

async function assertFeatureAccess(subscription, featureKey) {
  const limits = mergeLimits(subscription?.plan)
  const key = MODULE_KEY_MAP[featureKey] || featureKey
  const enabled = limits[key]
  if (enabled) return { allowed: true }
  const requiredPlan = minimumPlanForFeature(key)
  return {
    allowed: false,
    requiredPlan,
    message: `Upgrade to ${requiredPlan.charAt(0).toUpperCase() + requiredPlan.slice(1)} to unlock this feature`,
    code: 'PLAN_UPGRADE_REQUIRED',
  }
}

const MODULE_KEY_MAP = {
  marketplace: 'marketplace',
  payroll: 'payroll',
  hostel: 'hostel',
  transport: 'transport',
  alumni: 'alumni',
  biometric: 'biometric',
  liveClasses: 'liveClasses',
  lms: 'lms',
  admission: 'admission',
  hr: 'hr',
  ai: 'ai',
  cbt: 'cbt',
  library: 'library',
}

async function seedPlanFeatures(prisma, planId, slug) {
  const { listPlanFeatures } = require('./planLimits')
  const features = listPlanFeatures(slug)
  await prisma.planFeature.deleteMany({ where: { planId } })
  if (!features.length) return
  await prisma.planFeature.createMany({
    data: features.map((f, i) => ({
      planId,
      key: f.key,
      label: f.label,
      enabled: true,
      sortOrder: i,
    })),
  })
}

async function processExpiredTrials(prisma, { notify } = {}) {
  const now = new Date()
  const expired = await prisma.schoolSubscription.findMany({
    where: {
      status: 'trial',
      trialEndsAt: { lt: now },
      manualOverride: false,
    },
    include: { school: true, plan: true },
  })

  for (const sub of expired) {
    await prisma.school.update({ where: { id: sub.schoolId }, data: { status: 'suspended' } })
    await prisma.schoolSubscription.update({
      where: { schoolId: sub.schoolId },
      data: { status: 'expired', suspendedAt: now },
    })
    await logTransaction(prisma, {
      schoolId: sub.schoolId,
      type: 'trial_expired',
      description: '14-day trial expired — school suspended',
    })
    if (notify) {
      const admin = await prisma.user.findFirst({
        where: { schoolId: sub.schoolId, role: { name: 'SchoolAdmin' } },
      })
      if (admin) {
        await notify({
          schoolId: sub.schoolId,
          userId: admin.id,
          type: 'trial_expired',
          title: 'Trial expired',
          message: 'Your SchoolPilot trial has ended. Subscribe to reactivate your school.',
          channels: ['email', 'in_app'],
        })
      }
    }
  }
  return expired.length
}

async function processRenewalReminders(prisma, { notify } = {}) {
  const in3Days = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
  const subs = await prisma.schoolSubscription.findMany({
    where: {
      status: { in: ['active', 'trial'] },
      currentPeriodEnd: { lte: in3Days, gte: new Date() },
    },
    include: { school: true, plan: true },
  })
  for (const sub of subs) {
    if (notify) {
      const admin = await prisma.user.findFirst({
        where: { schoolId: sub.schoolId, role: { name: 'SchoolAdmin' } },
      })
      if (admin) {
        await notify({
          schoolId: sub.schoolId,
          userId: admin.id,
          type: 'subscription_expiring',
          title: 'Subscription expiring soon',
          message: `Your ${sub.plan?.name} plan renews on ${sub.currentPeriodEnd?.toLocaleDateString()}.`,
          channels: ['email', 'in_app', 'push'],
        })
      }
    }
  }
  return subs.length
}

async function processAutoRenewals(prisma) {
  const now = new Date()
  const due = await prisma.schoolSubscription.findMany({
    where: {
      autoRenew: true,
      status: 'active',
      currentPeriodEnd: { lte: now },
      manualOverride: false,
    },
    include: { plan: true },
  })
  for (const sub of due) {
    await prisma.schoolSubscription.update({
      where: { schoolId: sub.schoolId },
      data: {
        currentPeriodEnd: billingPeriodEnd(sub.billingInterval, sub.currentPeriodEnd || now),
        status: 'active',
      },
    })
    await logTransaction(prisma, {
      schoolId: sub.schoolId,
      type: 'renewal',
      description: 'Auto-renewal period extended',
      metadata: { billingInterval: sub.billingInterval },
    })
  }
  return due.length
}

async function approveManualSubscriptionPayment(prisma, paymentId, performedById) {
  const payment = await prisma.subscriptionPayment.findUnique({
    where: { id: paymentId },
    include: { invoice: { include: { plan: true } }, school: true },
  })
  if (!payment) throw new Error('Payment not found')
  if (!['pending', 'under_review'].includes(payment.status)) {
    throw new Error('Payment not reviewable')
  }

  await prisma.subscriptionPayment.update({
    where: { id: payment.id },
    data: { status: 'approved', reviewedById: performedById, reviewedAt: new Date() },
  })

  let sub = null
  if (payment.invoice) {
    sub = await activateSubscription(prisma, {
      schoolId: payment.schoolId,
      planId: payment.invoice.planId,
      billingInterval: payment.invoice.billingInterval || 'monthly',
      invoiceId: payment.invoice.id,
      paymentId: payment.id,
      performedById,
    })
  } else if (payment.metadata?.schoolAddonId) {
    await prisma.schoolAddon.update({
      where: { id: payment.metadata.schoolAddonId },
      data: { status: 'active' },
    })
    await prisma.subscriptionPayment.update({
      where: { id: payment.id },
      data: { status: 'completed' },
    })
  }

  const receipt = await createReceipt(prisma, {
    schoolId: payment.schoolId,
    paymentId: payment.id,
    invoiceId: payment.invoiceId,
    amount: payment.amount,
  })

  const registrationId = payment.metadata?.registrationId
  if (registrationId) {
    await prisma.schoolRegistration.update({
      where: { id: registrationId },
      data: { paymentStatus: 'verified' },
    }).catch(() => {})
  }

  return { payment, subscription: sub, receipt }
}

module.exports = {
  billingPeriodEnd,
  generateRef,
  generateReceiptNumber,
  logTransaction,
  applyCoupon,
  applyPromoCode,
  createReceipt,
  activateSubscription,
  suspendSchool,
  reactivateSchool,
  grantFreeMonths,
  changePlan,
  buildSchoolBillingDashboard,
  assertFeatureAccess,
  seedPlanFeatures,
  processExpiredTrials,
  processRenewalReminders,
  processAutoRenewals,
  comparePlans,
  priceForInterval,
  approveManualSubscriptionPayment,
}
