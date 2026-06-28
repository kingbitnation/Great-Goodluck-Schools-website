const { buildHealthReport } = require('./monitoring')
const { buildSystemStatus } = require('./systemStatus')
const { mergeLimits, priceForInterval } = require('./planLimits')

function startOfDay(d = new Date()) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function startOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

async function buildPlatformMetrics(prisma) {
  const now = new Date()
  const monthStart = startOfMonth(now)
  const dayStart = startOfDay(now)
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

  const [
    totalSchools,
    activeSchools,
    trialSchools,
    suspendedSchools,
    pendingRegistrations,
    paymentsAwaitingReview,
    expiredTrials,
    expiredSubs,
    activeUsers,
    newRegistrations,
    dailyLogins,
    paidInvoices,
    marketplaceRevenue,
    alumniDonations,
    aiSessions,
    emailsSent,
    smsSent,
    plans,
    subscriptionsByPlan,
  ] = await Promise.all([
    prisma.school.count(),
    prisma.school.count({ where: { status: 'active' } }),
    prisma.schoolSubscription.count({ where: { status: 'trial' } }),
    prisma.school.count({ where: { status: 'suspended' } }),
    prisma.schoolRegistration.count({ where: { status: 'pending' } }),
    prisma.subscriptionPayment.count({ where: { status: { in: ['pending', 'under_review'] } } }),
    prisma.schoolSubscription.count({
      where: { status: 'trial', trialEndsAt: { lt: now } },
    }),
    prisma.schoolSubscription.count({
      where: {
        status: { in: ['active', 'past_due', 'grace'] },
        currentPeriodEnd: { lt: now },
        manualOverride: false,
      },
    }),
    prisma.user.count({ where: { isActive: true } }),
    prisma.schoolRegistration.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    prisma.loginHistory.count({ where: { createdAt: { gte: dayStart }, success: true } }),
    prisma.subscriptionInvoice.findMany({
      where: { status: 'paid', paidAt: { gte: monthStart } },
      select: { amount: true, paidAt: true },
    }),
    prisma.marketplaceOrder.aggregate({
      where: { status: 'paid', createdAt: { gte: monthStart } },
      _sum: { totalAmount: true },
    }),
    prisma.alumniDonation.aggregate({
      where: { status: 'completed', createdAt: { gte: monthStart } },
      _sum: { amount: true },
    }),
    prisma.aiChatSession.count({ where: { createdAt: { gte: monthStart } } }),
    prisma.emailQueue.count({ where: { status: 'sent', sentAt: { gte: monthStart } } }),
    prisma.smsQueue.count({ where: { status: 'sent', sentAt: { gte: monthStart } } }),
    prisma.subscriptionPlan.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } }),
    prisma.schoolSubscription.groupBy({
      by: ['planId', 'status'],
      _count: { _all: true },
    }),
  ])

  const monthlyRevenue = paidInvoices.reduce((s, i) => s + (i.amount || 0), 0)
  const yearlyPaid = await prisma.subscriptionInvoice.aggregate({
    where: { status: 'paid', paidAt: { gte: new Date(now.getFullYear(), 0, 1) } },
    _sum: { amount: true },
  })

  const planMap = Object.fromEntries(plans.map((p) => [p.id, p]))
  const planBreakdown = subscriptionsByPlan.map((row) => ({
    plan: planMap[row.planId]?.name || 'Unknown',
    slug: planMap[row.planId]?.slug || '',
    status: row.status,
    count: row._count._all,
  }))

  const mrr = plans.reduce((sum, plan) => {
    const active = subscriptionsByPlan
      .filter((r) => r.planId === plan.id && ['active', 'trial'].includes(r.status))
      .reduce((n, r) => n + r._count._all, 0)
    return sum + active * (plan.price || 0)
  }, 0)

  return {
    checkedAt: now.toISOString(),
    schools: {
      total: totalSchools,
      active: activeSchools,
      trial: trialSchools,
      suspended: suspendedSchools,
      pending: pendingRegistrations,
      paymentsAwaitingReview,
      expiredTrials,
      expiredSubscriptions: expiredSubs,
    },
    revenue: {
      monthly: monthlyRevenue,
      annual: yearlyPaid._sum.amount || 0,
      mrr,
      arr: mrr * 12,
      marketplaceMonthly: marketplaceRevenue._sum.totalAmount || 0,
      alumniDonationsMonthly: alumniDonations._sum.amount || 0,
    },
    usage: {
      activeUsers,
      newRegistrations30d: newRegistrations,
      dailyLogins,
      aiSessionsMonthly: aiSessions,
      emailsSentMonthly: emailsSent,
      smsSentMonthly: smsSent,
    },
    subscriptions: { planBreakdown },
    plans: plans.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      price: p.price,
      quarterlyPrice: p.quarterlyPrice,
      yearlyPrice: p.yearlyPrice,
      limits: mergeLimits(p),
    })),
  }
}

async function buildBillingOverview(prisma) {
  const now = new Date()
  const in30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

  const [active, upcoming, failed, coupons, recentInvoices] = await Promise.all([
    prisma.schoolSubscription.findMany({
      where: { status: { in: ['active', 'trial', 'grace'] } },
      include: { school: { select: { name: true } }, plan: true },
      take: 50,
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.schoolSubscription.findMany({
      where: {
        currentPeriodEnd: { gte: now, lte: in30 },
        status: { in: ['active', 'past_due'] },
      },
      include: { school: { select: { name: true } }, plan: true },
      orderBy: { currentPeriodEnd: 'asc' },
      take: 50,
    }),
    prisma.subscriptionInvoice.findMany({
      where: { status: 'failed' },
      include: { school: { select: { name: true } }, plan: true },
      orderBy: { createdAt: 'desc' },
      take: 30,
    }),
    prisma.billingCoupon.findMany({ orderBy: { createdAt: 'desc' }, take: 50 }),
    prisma.subscriptionInvoice.findMany({
      include: { school: { select: { name: true } }, plan: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
  ])

  return {
    activeSubscriptions: active.map((s) => ({
      id: s.id,
      school: s.school.name,
      plan: s.plan.name,
      status: s.status,
      billingInterval: s.billingInterval,
      currentPeriodEnd: s.currentPeriodEnd,
      manualOverride: s.manualOverride,
    })),
    upcomingRenewals: upcoming.map((s) => ({
      school: s.school.name,
      plan: s.plan.name,
      renewsAt: s.currentPeriodEnd,
      amount: priceForInterval(s.plan, s.billingInterval),
    })),
    failedPayments: failed,
    coupons,
    recentInvoices,
  }
}

async function buildSchoolUsageReport(prisma, schoolId, { days = 30 } = {}) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
  const [daily, aiBalance, sub] = await Promise.all([
    prisma.schoolUsageDaily.findMany({
      where: { schoolId, date: { gte: since } },
      orderBy: { date: 'asc' },
    }),
    prisma.aiCreditBalance.findUnique({ where: { schoolId } }),
    prisma.schoolSubscription.findUnique({
      where: { schoolId },
      include: { plan: true },
    }),
  ])

  const totals = daily.reduce(
    (acc, row) => ({
      apiRequests: acc.apiRequests + row.apiRequests,
      aiRequests: acc.aiRequests + row.aiRequests,
      smsSent: acc.smsSent + row.smsSent,
      emailsSent: acc.emailsSent + row.emailsSent,
      logins: acc.logins + row.logins,
      storageBytes: acc.storageBytes + Number(row.storageBytes || 0),
    }),
    { apiRequests: 0, aiRequests: 0, smsSent: 0, emailsSent: 0, logins: 0, storageBytes: 0 }
  )

  return {
    schoolId,
    periodDays: days,
    limits: mergeLimits(sub?.plan),
    aiCredits: aiBalance,
    totals,
    daily: daily.map((d) => ({
      ...d,
      storageBytes: Number(d.storageBytes || 0),
    })),
  }
}

async function recordUsage(prisma, schoolId, patch = {}) {
  const date = startOfDay()
  const existing = await prisma.schoolUsageDaily.findUnique({
    where: { schoolId_date: { schoolId, date } },
  })
  const data = {
    apiRequests: (existing?.apiRequests || 0) + (patch.apiRequests || 0),
    aiRequests: (existing?.aiRequests || 0) + (patch.aiRequests || 0),
    smsSent: (existing?.smsSent || 0) + (patch.smsSent || 0),
    emailsSent: (existing?.emailsSent || 0) + (patch.emailsSent || 0),
    logins: (existing?.logins || 0) + (patch.logins || 0),
    activeUsers: patch.activeUsers ?? existing?.activeUsers ?? 0,
    storageBytes: patch.storageBytes ?? existing?.storageBytes ?? 0,
  }
  return prisma.schoolUsageDaily.upsert({
    where: { schoolId_date: { schoolId, date } },
    create: { schoolId, date, ...data },
    update: data,
  })
}

async function ensureAiCredits(prisma, schoolId, subscription) {
  const limits = mergeLimits(subscription?.plan)
  const grant = limits.aiCredits || 0
  let balance = await prisma.aiCreditBalance.findUnique({ where: { schoolId } })
  const periodStart = startOfMonth()
  if (!balance) {
    balance = await prisma.aiCreditBalance.create({
      data: {
        schoolId,
        monthlyGrant: grant,
        balance: grant,
        usedThisMonth: 0,
        periodStart,
      },
    })
    if (grant > 0) {
      await prisma.aiCreditTransaction.create({
        data: { schoolId, amount: grant, type: 'grant', note: 'Monthly allocation' },
      })
    }
    return balance
  }
  if (!balance.periodStart || balance.periodStart < periodStart) {
    balance = await prisma.aiCreditBalance.update({
      where: { schoolId },
      data: {
        monthlyGrant: grant,
        balance: grant,
        usedThisMonth: 0,
        periodStart,
      },
    })
    if (grant > 0) {
      await prisma.aiCreditTransaction.create({
        data: { schoolId, amount: grant, type: 'grant', note: 'Monthly reset' },
      })
    }
  }
  return balance
}

async function consumeAiCredit(prisma, schoolId, subscription, amount = 1) {
  const balance = await ensureAiCredits(prisma, schoolId, subscription)
  if (balance.balance < amount) {
    return { ok: false, balance: balance.balance, required: amount }
  }
  const updated = await prisma.aiCreditBalance.update({
    where: { schoolId },
    data: {
      balance: { decrement: amount },
      usedThisMonth: { increment: amount },
    },
  })
  await prisma.aiCreditTransaction.create({
    data: { schoolId, amount: -amount, type: 'consume', note: 'AI request' },
  })
  await recordUsage(prisma, schoolId, { aiRequests: amount })
  return { ok: true, balance: updated.balance }
}

async function buildPlatformHealth(prisma) {
  const [health, systemStatus, incidents, queuePending] = await Promise.all([
    buildHealthReport(prisma, { detailed: true }),
    buildSystemStatus(prisma, null),
    prisma.platformHealthIncident.findMany({ orderBy: { startedAt: 'desc' }, take: 20 }),
    Promise.all([
      prisma.emailQueue.count({ where: { status: 'pending' } }),
      prisma.smsQueue.count({ where: { status: 'pending' } }),
    ]),
  ])

  return {
    ...health,
    integrations: systemStatus.integrations,
    incidents,
    queues: { emailPending: queuePending[0], smsPending: queuePending[1] },
    redis: { status: 'not_configured', note: 'Optional — add REDIS_URL for distributed caching' },
  }
}

module.exports = {
  buildPlatformMetrics,
  buildBillingOverview,
  buildSchoolUsageReport,
  recordUsage,
  ensureAiCredits,
  consumeAiCredit,
  buildPlatformHealth,
  startOfDay,
  startOfMonth,
}
