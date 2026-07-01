const { mergeLimits, planFeaturesFromLimits, priceForInterval } = require('../lib/planLimits')
const { clearFlagCache } = require('../lib/featureFlags')
const {
  buildPlatformMetrics,
  buildBillingOverview,
  buildSchoolUsageReport,
  buildPlatformHealth,
  buildSchoolSuccessMetrics,
} = require('../lib/platformHelpers')
const { processReferralReward } = require('../lib/referralHelpers')
const { PLATFORM_PREFIX } = require('../lib/platformBrand')

function registerPlatformRoutes(app, { prisma, requireRole }) {
  const superAdmin = requireRole('SuperAdmin')
  const schoolAdmin = requireRole('SuperAdmin', 'SchoolAdmin')

  function stripInternalTicketFields(ticket, role) {
    if (role === 'SuperAdmin') return ticket
    const { internalNotes, ...safe } = ticket
    return safe
  }

  // ===== PLATFORM BUSINESS DASHBOARD =====
  app.get('/api/platform/metrics', superAdmin, async (req, res) => {
    try {
      res.json(await buildPlatformMetrics(prisma))
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.post('/api/platform/reset-data', superAdmin, async (req, res) => {
    try {
      if (req.body?.confirm !== 'RESET') {
        return res.status(400).json({ error: 'Send { confirm: "RESET" } to wipe all schools and billing data' })
      }
      const { resetPlatformData } = require('../lib/schoolDeletion')
      await resetPlatformData(prisma)
      res.json({ message: 'Platform reset complete. Schools and billing data cleared.' })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: err.message || 'Reset failed' })
    }
  })

  app.get('/api/platform/health', superAdmin, async (req, res) => {
    try {
      res.json(await buildPlatformHealth(prisma))
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.get('/api/platform/success-metrics', superAdmin, async (_req, res) => {
    try {
      res.json(await buildSchoolSuccessMetrics(prisma))
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.get('/api/platform/billing', superAdmin, async (req, res) => {
    try {
      res.json(await buildBillingOverview(prisma))
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  // ===== SUBSCRIPTION PLAN MANAGEMENT =====
  app.get('/api/platform/plans', superAdmin, async (req, res) => {
    try {
      const plans = await prisma.subscriptionPlan.findMany({ orderBy: { sortOrder: 'asc' } })
      res.json(plans.map((p) => ({ ...p, limits: mergeLimits(p) })))
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.post('/api/platform/plans', superAdmin, async (req, res) => {
    const {
      name, slug, description, price, quarterlyPrice, yearlyPrice,
      limits, trialDays, graceDays, sortOrder, isActive,
    } = req.body
    if (!name || !slug) return res.status(400).json({ error: 'name and slug required' })
    try {
      const merged = mergeLimits({ slug, limits })
      const plan = await prisma.subscriptionPlan.create({
        data: {
          name,
          slug,
          description: description || null,
          price: Number(price) || 0,
          quarterlyPrice: quarterlyPrice != null ? Number(quarterlyPrice) : null,
          yearlyPrice: yearlyPrice != null ? Number(yearlyPrice) : null,
          limits: merged,
          maxStudents: merged.maxStudents,
          features: planFeaturesFromLimits(merged),
          trialDays: trialDays ?? 14,
          graceDays: graceDays ?? 7,
          sortOrder: sortOrder ?? 0,
          isActive: isActive !== false,
        },
      })
      res.status(201).json(plan)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.put('/api/platform/plans/:id', superAdmin, async (req, res) => {
    const { id } = req.params
    const {
      name, slug, description, price, quarterlyPrice, yearlyPrice,
      limits, trialDays, graceDays, sortOrder, isActive,
    } = req.body
    try {
      const existing = await prisma.subscriptionPlan.findUnique({ where: { id } })
      if (!existing) return res.status(404).json({ error: 'Plan not found' })
      const merged = limits ? mergeLimits({ slug: slug || existing.slug, limits }) : undefined
      const plan = await prisma.subscriptionPlan.update({
        where: { id },
        data: {
          ...(name != null && { name }),
          ...(slug != null && { slug }),
          ...(description !== undefined && { description }),
          ...(price != null && { price: Number(price) }),
          ...(quarterlyPrice !== undefined && { quarterlyPrice: quarterlyPrice != null ? Number(quarterlyPrice) : null }),
          ...(yearlyPrice !== undefined && { yearlyPrice: yearlyPrice != null ? Number(yearlyPrice) : null }),
          ...(merged && { limits: merged, maxStudents: merged.maxStudents, features: planFeaturesFromLimits(merged) }),
          ...(trialDays != null && { trialDays: Number(trialDays) }),
          ...(graceDays != null && { graceDays: Number(graceDays) }),
          ...(sortOrder != null && { sortOrder: Number(sortOrder) }),
          ...(isActive != null && { isActive: !!isActive }),
        },
      })
      res.json(plan)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  // ===== FEATURE FLAGS =====
  app.get('/api/platform/feature-flags', superAdmin, async (req, res) => {
    try {
      const flags = await prisma.featureFlag.findMany({ orderBy: { key: 'asc' } })
      res.json(flags)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.put('/api/platform/feature-flags/:id', superAdmin, async (req, res) => {
    const { enabled, planSlugs, label, description } = req.body
    try {
      const flag = await prisma.featureFlag.update({
        where: { id: req.params.id },
        data: {
          ...(enabled != null && { enabled: !!enabled }),
          ...(planSlugs && { planSlugs }),
          ...(label && { label }),
          ...(description !== undefined && { description }),
        },
      })
      clearFlagCache()
      res.json(flag)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  // ===== BILLING COUPONS =====
  app.get('/api/platform/coupons', superAdmin, async (req, res) => {
    try {
      res.json(await prisma.billingCoupon.findMany({ orderBy: { createdAt: 'desc' } }))
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.post('/api/platform/coupons', superAdmin, async (req, res) => {
    const { code, description, discountType, discountValue, maxUses, validUntil, planSlugs } = req.body
    if (!code || discountValue == null) return res.status(400).json({ error: 'code and discountValue required' })
    try {
      const coupon = await prisma.billingCoupon.create({
        data: {
          code: String(code).toUpperCase(),
          description: description || null,
          discountType: discountType || 'percent',
          discountValue: Number(discountValue),
          maxUses: maxUses != null ? Number(maxUses) : null,
          validUntil: validUntil ? new Date(validUntil) : null,
          planSlugs: planSlugs || [],
        },
      })
      res.status(201).json(coupon)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  // ===== SUBSCRIPTION OVERRIDES =====
  app.post('/api/platform/subscriptions/:schoolId/override', superAdmin, async (req, res) => {
    const { schoolId } = req.params
    const { manualOverride, overrideNote, status, graceDays } = req.body
    if (manualOverride !== false && !String(overrideNote || '').trim()) {
      return res.status(400).json({ error: 'overrideNote is required when applying a manual override' })
    }
    try {
      const sub = await prisma.schoolSubscription.findUnique({ where: { schoolId } })
      if (!sub) return res.status(404).json({ error: 'Subscription not found' })
      const plan = await prisma.subscriptionPlan.findUnique({ where: { id: sub.planId } })
      const grace = graceDays ?? plan?.graceDays ?? 7
      const data = {
        manualOverride: manualOverride !== false,
        overrideNote: String(overrideNote || '').trim(),
      }
      if (status) data.status = status
      if (status === 'grace') {
        data.graceEndsAt = new Date(Date.now() + grace * 24 * 60 * 60 * 1000)
      }
      const updated = await prisma.schoolSubscription.update({ where: { schoolId }, data })
      await prisma.subscriptionTransactionLog.create({
        data: {
          schoolId,
          type: 'manual_override',
          description: overrideNote,
          performedById: req.user.userId,
          metadata: { status, manualOverride: data.manualOverride },
        },
      }).catch(() => {})
      res.json(updated)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.post('/api/platform/subscriptions/:schoolId/reactivate', superAdmin, async (req, res) => {
    const { schoolId } = req.params
    const { months = 1 } = req.body
    try {
      const sub = await prisma.schoolSubscription.update({
        where: { schoolId },
        data: {
          status: 'active',
          manualOverride: false,
          graceEndsAt: null,
          cancelledAt: null,
          currentPeriodEnd: new Date(Date.now() + Number(months) * 30 * 24 * 60 * 60 * 1000),
        },
      })
      await prisma.school.update({ where: { id: schoolId }, data: { status: 'active' } })
      res.json(sub)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  // ===== SUPPORT TICKETS =====
  app.get('/api/support/tickets', schoolAdmin, async (req, res) => {
    try {
      const where = req.user.role === 'SuperAdmin'
        ? (req.query.schoolId ? { schoolId: String(req.query.schoolId) } : {})
        : { schoolId: req.user.schoolId }
      if (req.query.status) where.status = String(req.query.status)
      const tickets = await prisma.supportTicket.findMany({
        where,
        include: {
          school: { select: { name: true } },
          createdBy: { select: { firstName: true, lastName: true, email: true } },
          assignedTo: { select: { firstName: true, lastName: true } },
          _count: { select: { messages: true } },
        },
        orderBy: { updatedAt: 'desc' },
        take: 100,
      })
      res.json(tickets.map((t) => stripInternalTicketFields(t, req.user.role)))
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.post('/api/support/tickets', schoolAdmin, async (req, res) => {
    const { subject, category, priority, body, attachmentUrls } = req.body
    if (!subject || !body) return res.status(400).json({ error: 'subject and body required' })
    const schoolId = req.user.role === 'SuperAdmin' ? req.body.schoolId : req.user.schoolId
    if (!schoolId) return res.status(400).json({ error: 'schoolId required' })
    try {
      const ticket = await prisma.supportTicket.create({
        data: {
          schoolId,
          createdById: req.user.userId,
          subject,
          category: category || 'general',
          priority: priority || 'normal',
          attachmentUrls: attachmentUrls || [],
          messages: {
            create: { authorId: req.user.userId, body, isInternal: false },
          },
        },
        include: { messages: true },
      })
      res.status(201).json(ticket)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.get('/api/support/tickets/:id', schoolAdmin, async (req, res) => {
    try {
      const ticket = await prisma.supportTicket.findUnique({
        where: { id: req.params.id },
        include: {
          school: { select: { name: true } },
          messages: {
            include: { author: { select: { firstName: true, lastName: true, role: { select: { name: true } } } } },
            orderBy: { createdAt: 'asc' },
          },
        },
      })
      if (!ticket) return res.status(404).json({ error: 'Not found' })
      if (req.user.role !== 'SuperAdmin' && ticket.schoolId !== req.user.schoolId) {
        return res.status(403).json({ error: 'Forbidden' })
      }
      const messages = ticket.messages.filter(
        (m) => !m.isInternal || req.user.role === 'SuperAdmin'
      )
      res.json(stripInternalTicketFields({ ...ticket, messages }, req.user.role))
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.post('/api/support/tickets/:id/messages', schoolAdmin, async (req, res) => {
    const { body, isInternal } = req.body
    if (!body) return res.status(400).json({ error: 'body required' })
    try {
      const ticket = await prisma.supportTicket.findUnique({ where: { id: req.params.id } })
      if (!ticket) return res.status(404).json({ error: 'Not found' })
      if (req.user.role !== 'SuperAdmin' && ticket.schoolId !== req.user.schoolId) {
        return res.status(403).json({ error: 'Forbidden' })
      }
      const message = await prisma.supportTicketMessage.create({
        data: {
          ticketId: ticket.id,
          authorId: req.user.userId,
          body,
          isInternal: req.user.role === 'SuperAdmin' && !!isInternal,
        },
      })
      await prisma.supportTicket.update({
        where: { id: ticket.id },
        data: { updatedAt: new Date(), status: ticket.status === 'open' ? 'in_progress' : ticket.status },
      })
      res.status(201).json(message)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.patch('/api/support/tickets/:id', superAdmin, async (req, res) => {
    const { status, assignedToId, priority, internalNotes } = req.body
    try {
      const data = { updatedAt: new Date() }
      if (status) {
        data.status = status
        if (status === 'closed' || status === 'resolved') data.closedAt = new Date()
      }
      if (assignedToId !== undefined) data.assignedToId = assignedToId || null
      if (priority) data.priority = priority
      if (internalNotes !== undefined) data.internalNotes = internalNotes
      const ticket = await prisma.supportTicket.update({ where: { id: req.params.id }, data })
      res.json(ticket)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.post('/api/support/tickets/:id/rate', schoolAdmin, async (req, res) => {
    const { rating } = req.body
    if (!rating || rating < 1 || rating > 5) return res.status(400).json({ error: 'rating 1-5 required' })
    try {
      const ticket = await prisma.supportTicket.findUnique({ where: { id: req.params.id } })
      if (!ticket || ticket.schoolId !== req.user.schoolId) return res.status(403).json({ error: 'Forbidden' })
      const updated = await prisma.supportTicket.update({
        where: { id: ticket.id },
        data: { rating: Number(rating) },
      })
      res.json(updated)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  // ===== SCHOOL USAGE ANALYTICS =====
  app.get('/api/schools/:id/usage', schoolAdmin, async (req, res) => {
    const schoolId = req.params.id
    if (req.user.role !== 'SuperAdmin' && req.user.schoolId !== schoolId) {
      return res.status(403).json({ error: 'Forbidden' })
    }
    try {
      const days = Number(req.query.days) || 30
      res.json(await buildSchoolUsageReport(prisma, schoolId, { days }))
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  // ===== PLATFORM ANNOUNCEMENTS =====
  app.get('/api/platform/announcements', async (req, res) => {
    try {
      const now = new Date()
      const items = await prisma.platformAnnouncement.findMany({
        where: {
          isActive: true,
          publishAt: { lte: now },
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
        orderBy: { publishAt: 'desc' },
        take: 10,
      })
      res.json(items)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.post('/api/platform/announcements', superAdmin, async (req, res) => {
    const { title, body, targetRoles, planSlugs, publishAt, expiresAt, broadcast } = req.body
    if (!title || !body) return res.status(400).json({ error: 'title and body required' })
    try {
      const item = await prisma.platformAnnouncement.create({
        data: {
          title,
          body,
          targetRoles: targetRoles || [],
          planSlugs: planSlugs || [],
          publishAt: publishAt ? new Date(publishAt) : new Date(),
          expiresAt: expiresAt ? new Date(expiresAt) : null,
        },
      })

      let sent = 0
      if (broadcast) {
        const userWhere = { isActive: true }
        if (targetRoles?.length) {
          userWhere.role = { name: { in: targetRoles } }
        }
        const users = await prisma.user.findMany({
          where: userWhere,
          select: { id: true },
          take: 5000,
        })
        if (users.length) {
          await prisma.notification.createMany({
            data: users.map((u) => ({
              userId: u.id,
              type: 'announcement',
              title,
              body,
              read: false,
            })),
          })
          sent = users.length
        }
      }

      res.status(201).json({ ...item, notificationsSent: sent })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.get('/api/platform/announcements/all', superAdmin, async (req, res) => {
    try {
      res.json(await prisma.platformAnnouncement.findMany({ orderBy: { createdAt: 'desc' }, take: 100 }))
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  // ===== REFERRAL =====
  app.get('/api/platform/referrals', superAdmin, async (_req, res) => {
    try {
      const codes = await prisma.referralCode.findMany({
        include: {
          school: { select: { id: true, name: true } },
          conversions: true,
        },
        orderBy: { createdAt: 'desc' },
      })
      const schoolIds = [...new Set(codes.flatMap((c) => c.conversions.map((x) => x.referredSchoolId)))]
      const schools = schoolIds.length
        ? await prisma.school.findMany({ where: { id: { in: schoolIds } }, select: { id: true, name: true, status: true } })
        : []
      const schoolMap = Object.fromEntries(schools.map((s) => [s.id, s]))
      res.json(
        codes.map((c) => ({
          ...c,
          conversions: c.conversions.map((cv) => ({
            ...cv,
            referredSchool: schoolMap[cv.referredSchoolId] || { id: cv.referredSchoolId, name: 'Unknown' },
          })),
        }))
      )
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.patch('/api/platform/referrals/:id', superAdmin, async (req, res) => {
    try {
      const { rewardDays, rewardAiCredits, rewardSmsCredits, isActive } = req.body
      const updated = await prisma.referralCode.update({
        where: { id: req.params.id },
        data: {
          ...(rewardDays != null ? { rewardDays: Number(rewardDays) } : {}),
          ...(rewardAiCredits != null ? { rewardAiCredits: Number(rewardAiCredits) } : {}),
          ...(rewardSmsCredits != null ? { rewardSmsCredits: Number(rewardSmsCredits) } : {}),
          ...(isActive != null ? { isActive: !!isActive } : {}),
        },
      })
      res.json(updated)
    } catch (err) {
      console.error(err)
      res.status(400).json({ error: err.message || 'Update failed' })
    }
  })

  app.post('/api/platform/referrals/conversions/:id/reward', superAdmin, async (req, res) => {
    try {
      const conversion = await prisma.referralConversion.findUnique({ where: { id: req.params.id } })
      if (!conversion) return res.status(404).json({ error: 'Conversion not found' })
      if (conversion.status === 'rewarded') {
        return res.json({ message: 'Already rewarded', conversion })
      }
      const result = await processReferralReward(prisma, conversion.referredSchoolId)
      res.json({ message: 'Reward applied', result })
    } catch (err) {
      console.error(err)
      res.status(400).json({ error: err.message || 'Reward failed' })
    }
  })

  app.get('/api/referrals/me', schoolAdmin, async (req, res) => {
    if (!req.user.schoolId) return res.status(400).json({ error: 'No school' })
    try {
      let code = await prisma.referralCode.findFirst({
        where: { schoolId: req.user.schoolId, isActive: true },
        include: { conversions: true },
      })
      if (!code) {
        const slug = req.user.schoolId.slice(0, 8).toUpperCase()
        code = await prisma.referralCode.create({
          data: { schoolId: req.user.schoolId, code: `${PLATFORM_PREFIX}-${slug}` },
          include: { conversions: true },
        })
      }
      res.json({
        code: code.code,
        link: `${process.env.APP_URL || 'http://localhost:3000'}/register-school?ref=${code.code}`,
        conversions: code.conversions.length,
        rewards: {
          days: code.rewardDays,
          aiCredits: code.rewardAiCredits,
          smsCredits: code.rewardSmsCredits,
        },
      })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })
}

module.exports = { registerPlatformRoutes }
