const { assertSameSchool } = require('../middleware/tenantGuard')

function checkTenantAccess(user, resourceSchoolId, res) {
  if (user?.role === 'SuperAdmin') return true
  if (!resourceSchoolId) {
    res.status(403).json({ error: 'Cross-tenant access denied' })
    return false
  }
  if (assertSameSchool(user, resourceSchoolId)) return true
  res.status(403).json({ error: 'Cross-tenant access denied' })
  return false
}

async function ensureStudentViewerAccess(prisma, req, res, studentId) {
  const userId = req.user.userId || req.user.id
  if (req.user.role === 'Student') {
    const me = await prisma.student.findUnique({ where: { userId } })
    if (!me || me.id !== studentId) {
      res.status(403).json({ error: 'Forbidden' })
      return false
    }
  } else if (req.user.role === 'Parent') {
    const parent = await prisma.parent.findUnique({
      where: { userId },
      include: { children: { select: { id: true } } },
    })
    if (!parent || !parent.children.some((c) => c.id === studentId)) {
      res.status(403).json({ error: 'Forbidden' })
      return false
    }
  }
  return true
}

module.exports = { checkTenantAccess, ensureStudentViewerAccess }
