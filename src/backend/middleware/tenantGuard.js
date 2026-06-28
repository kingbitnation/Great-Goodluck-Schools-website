const prisma = require('../prismaClient')

function tenantWhere(user) {
  if (user?.role === 'SuperAdmin') return {}
  if (user?.schoolId) return { schoolId: user.schoolId }
  return { schoolId: '__TENANT_BLOCKED__' }
}

function assertSameSchool(user, resourceSchoolId) {
  if (!user) return false
  if (user.role === 'SuperAdmin') return true
  if (!resourceSchoolId || !user.schoolId) return false
  return user.schoolId === resourceSchoolId
}

function createTenantGuard(prismaClient = prisma) {
  function requireSameSchool(getSchoolId) {
    return async (req, res, next) => {
      if (req.user?.role === 'SuperAdmin') return next()
      try {
        const schoolId = typeof getSchoolId === 'function' ? await getSchoolId(req) : getSchoolId
        if (schoolId && !assertSameSchool(req.user, schoolId)) {
          return res.status(403).json({ error: 'Cross-tenant access denied' })
        }
        next()
      } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'Server error' })
      }
    }
  }

  async function requireActiveSchool(req, res, next) {
    if (req.user?.role === 'SuperAdmin') return next()
    if (!req.user?.schoolId) return res.status(403).json({ error: 'No school context' })

    try {
      const school = await prismaClient.school.findUnique({
        where: { id: req.user.schoolId },
        include: { subscription: { include: { plan: true } } },
      })
      if (!school) return res.status(403).json({ error: 'School not found' })
      if (school.status === 'pending') {
        return res.status(403).json({ error: 'School pending approval', code: 'SCHOOL_PENDING' })
      }
      if (school.status === 'suspended') {
        return res.status(403).json({ error: 'School account suspended', code: 'SCHOOL_SUSPENDED' })
      }

      const sub = school.subscription
      if (sub?.status === 'cancelled') {
        return res.status(403).json({ error: 'Subscription cancelled', code: 'SUBSCRIPTION_CANCELLED' })
      }
      if (sub?.trialEndsAt && sub.trialEndsAt < new Date() && sub.status === 'trial' && !sub.manualOverride) {
        await prismaClient.school.update({ where: { id: req.user.schoolId }, data: { status: 'suspended' } })
        await prismaClient.schoolSubscription.update({
          where: { schoolId: req.user.schoolId },
          data: { status: 'expired', suspendedAt: new Date() },
        })
        return res.status(403).json({ error: 'Trial expired — subscribe to reactivate', code: 'TRIAL_EXPIRED' })
      }
      if (school.status === 'suspended' || sub?.status === 'expired' || sub?.status === 'suspended') {
        return res.status(403).json({ error: 'Subscription expired — contact platform admin to reactivate', code: 'SUBSCRIPTION_EXPIRED' })
      }
      if (
        sub?.currentPeriodEnd &&
        sub.currentPeriodEnd < new Date() &&
        ['active', 'past_due'].includes(sub.status) &&
        !sub.manualOverride
      ) {
        if (sub.status !== 'grace') {
          const plan = sub.plan || await prismaClient.subscriptionPlan.findUnique({ where: { id: sub.planId } })
          const graceDays = plan?.graceDays ?? 7
          await prismaClient.schoolSubscription.update({
            where: { schoolId: req.user.schoolId },
            data: {
              status: 'grace',
              graceEndsAt: new Date(Date.now() + graceDays * 24 * 60 * 60 * 1000),
            },
          })
        } else if (sub.graceEndsAt && sub.graceEndsAt < new Date()) {
          return res.status(403).json({ error: 'Subscription expired — renew to continue', code: 'SUBSCRIPTION_EXPIRED' })
        }
      }

      req.school = school
      req.subscription = sub
      next()
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  }

  async function enforceStudentLimit(req, res, next) {
    if (req.user?.role === 'SuperAdmin') return next()
    if (!req.user?.schoolId) return next()
    try {
      const sub = req.subscription || await prismaClient.schoolSubscription.findUnique({
        where: { schoolId: req.user.schoolId },
        include: { plan: true },
      })
      const max = sub?.plan?.maxStudents
      if (!max) return next()

      const count = await prismaClient.student.count({ where: { schoolId: req.user.schoolId } })
      if (count >= max) {
        return res.status(403).json({
          error: `Student limit reached (${max}). Upgrade your plan.`,
          code: 'STUDENT_LIMIT',
        })
      }
      next()
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  }

  return { requireSameSchool, requireActiveSchool, enforceStudentLimit }
}

module.exports = {
  tenantWhere,
  assertSameSchool,
  createTenantGuard,
}
