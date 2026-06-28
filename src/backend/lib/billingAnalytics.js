const { mergeLimits, priceForInterval } = require('./planLimits')

function startOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

async function buildBillingAnalytics(prisma) {
  const now = new Date()
  const monthStart = startOfMonth(now)
  const yearStart = new Date(now.getFullYear(), 0, 1)
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

  const [
    schools,
    subscriptions,
    plans,
    paidInvoicesMonth,
    paidInvoicesYear,
    pendingPayments,
    failedPayments,
    trialSubs,
    expiredTrials,
    activeSubs,
    cancelledSubs,
    newSchools,
    transactionLogs,
    usageDaily,
    addons,
  ] = await Promise.all([
    prisma.school.findMany({
      select: { id: true, name: true, status: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.schoolSubscription.findMany({
      include: { plan: true, school: { select: { id: true, name: true, status: true } } },
    }),
    prisma.subscriptionPlan.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } }),
    prisma.subscriptionInvoice.findMany({
      where: { status: 'paid', paidAt: { gte: monthStart } },
      select: { amount: true, paidAt: true, schoolId: true, planId: true },
    }),
    prisma.subscriptionInvoice.aggregate({
      where: { status: 'paid', paidAt: { gte: yearStart } },
      _sum: { amount: true },
    }),
    prisma.subscriptionPayment.findMany({
      where: { status: { in: ['pending', 'under_review'] } },
      include: { school: { select: { name: true } }, invoice: { include: { plan: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
    prisma.subscriptionPayment.findMany({
      where: { status: 'failed' },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: { school: { select: { name: true } } },
    }),
    prisma.schoolSubscription.count({ where: { status: 'trial' } }),
    prisma.schoolSubscription.count({ where: { status: { in: ['expired', 'suspended'] } } }),
    prisma.schoolSubscription.count({ where: { status: 'active' } }),
    prisma.schoolSubscription.count({ where: { status: 'cancelled' } }),
    prisma.school.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    prisma.subscriptionTransactionLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { school: { select: { name: true } } },
    }),
    prisma.schoolUsageDaily.findMany({
      where: { date: { gte: thirtyDaysAgo } },
      select: { schoolId: true, apiRequests: true, aiRequests: true, storageBytes: true },
    }),
    prisma.schoolAddon.findMany({
      where: { status: 'active' },
      include: { addon: true, school: { select: { name: true } } },
    }),
  ])

  const monthlyRevenue = paidInvoicesMonth.reduce((s, i) => s + (i.amount || 0), 0)
  const arr = monthlyRevenue * 12
  const annualRevenue = paidInvoicesYear._sum.amount || 0

  const planMap = Object.fromEntries(plans.map((p) => [p.id, p]))
  const mrr = subscriptions
    .filter((s) => ['active', 'trial'].includes(s.status))
    .reduce((sum, s) => sum + (priceForInterval(s.plan, s.billingInterval) || s.plan?.price || 0), 0)

  const planDistribution = plans.map((plan) => ({
    plan: plan.name,
    slug: plan.slug,
    count: subscriptions.filter((s) => s.planId === plan.id && s.status !== 'cancelled').length,
    revenue: paidInvoicesMonth
      .filter((i) => i.planId === plan.id)
      .reduce((s, i) => s + i.amount, 0),
  }))

  const topSchools = subscriptions
    .filter((s) => s.status === 'active')
    .map((s) => ({
      school: s.school?.name,
      schoolId: s.schoolId,
      plan: s.plan?.name,
      mrr: priceForInterval(s.plan, s.billingInterval) || s.plan?.price || 0,
    }))
    .sort((a, b) => b.mrr - a.mrr)
    .slice(0, 10)

  const storageBySchool = {}
  for (const u of usageDaily) {
    storageBySchool[u.schoolId] = (storageBySchool[u.schoolId] || 0) + Number(u.storageBytes || 0)
  }
  const apiBySchool = {}
  for (const u of usageDaily) {
    apiBySchool[u.schoolId] = (apiBySchool[u.schoolId] || 0) + (u.apiRequests || 0)
  }

  const totalTrials = trialSubs + expiredTrials
  const convertedFromTrial = subscriptions.filter(
    (s) => s.status === 'active' && s.trialEndsAt
  ).length
  const trialConversionRate = totalTrials > 0
    ? Math.round((convertedFromTrial / totalTrials) * 100)
    : 0

  const churnRate = subscriptions.length > 0
    ? Math.round((cancelledSubs / subscriptions.length) * 100)
    : 0

  const revenueByMonth = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0)
    const monthPaid = await prisma.subscriptionInvoice.findMany({
      where: { status: 'paid', paidAt: { gte: d, lte: end } },
      select: { amount: true },
    })
    revenueByMonth.push({
      month: d.toLocaleString('default', { month: 'short', year: '2-digit' }),
      revenue: monthPaid.reduce((s, x) => s + x.amount, 0),
    })
  }

  return {
    summary: {
      mrr,
      arr,
      monthlyRevenue,
      annualRevenue,
      activeSchools: schools.filter((s) => s.status === 'active').length,
      inactiveSchools: schools.filter((s) => s.status !== 'active').length,
      trialSchools: trialSubs,
      expiredSchools: expiredTrials,
      newSchools,
      churnRate,
      trialConversionRate,
      avgRevenuePerSchool: activeSubs > 0 ? Math.round(monthlyRevenue / activeSubs) : 0,
      customerLifetimeValue: activeSubs > 0 ? Math.round(arr / activeSubs) : 0,
      pendingApprovals: pendingPayments.length,
      paymentFailures: failedPayments.length,
    },
    revenue: { monthly: monthlyRevenue, annual: annualRevenue, trend: revenueByMonth },
    planDistribution,
    topSchools,
    fastestGrowing: schools
      .filter((s) => s.createdAt >= thirtyDaysAgo)
      .slice(0, 5)
      .map((s) => ({ name: s.name, joined: s.createdAt })),
    pendingPayments,
    failedPayments,
    recentTransactions: transactionLogs,
    trials: { active: trialSubs, expired: expiredTrials, conversionRate: trialConversionRate },
    featureUsage: {
      topApiSchools: Object.entries(apiBySchool)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([schoolId, requests]) => ({
          school: schools.find((s) => s.id === schoolId)?.name || schoolId,
          apiRequests: requests,
        })),
      topStorageSchools: Object.entries(storageBySchool)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([schoolId, bytes]) => ({
          school: schools.find((s) => s.id === schoolId)?.name || schoolId,
          storageGb: Math.round((bytes / 1024 ** 3) * 100) / 100,
        })),
    },
    activeAddons: addons,
    schools: schools.map((s) => {
      const sub = subscriptions.find((x) => x.schoolId === s.id)
      return {
        ...s,
        subscription: sub
          ? { status: sub.status, plan: sub.plan?.name, trialEndsAt: sub.trialEndsAt, currentPeriodEnd: sub.currentPeriodEnd }
          : null,
      }
    }),
    subscriptions,
  }
}

module.exports = { buildBillingAnalytics }
