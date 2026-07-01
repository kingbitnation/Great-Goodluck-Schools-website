/**
 * Blocks login for suspended / expired schools.
 * Loaded from server.js so authRoutes.js does not need a top-level import when IDE-locked.
 */
const { evaluateSchoolAccess } = require('../lib/subscriptionHelpers')

async function assertSchoolLoginAllowed(prisma, user, res) {
  if (!user?.schoolId || user.role?.name === 'SuperAdmin') return true
  const access = await evaluateSchoolAccess(prisma, user.schoolId, { persist: true })
  if (!access.allowed) {
    res.status(403).json({ error: access.error, code: access.code })
    return false
  }
  return true
}

module.exports = { assertSchoolLoginAllowed }
