const prisma = require('../prismaClient')
const { evaluateSchoolAccess } = require('../lib/subscriptionHelpers')

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
      const access = await evaluateSchoolAccess(prismaClient, req.user.schoolId, { persist: true })
      if (!access.allowed) {
        return res.status(403).json({ error: access.error, code: access.code })
      }

      req.school = access.school
      req.subscription = access.subscription
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
