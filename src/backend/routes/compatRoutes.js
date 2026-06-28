const crypto = require('crypto')
const { checkTenantAccess } = require('../lib/tenantHelpers')

function schoolScope(user) {
  if (user.role === 'SuperAdmin') return {}
  if (user.schoolId) return { schoolId: user.schoolId }
  return { schoolId: '__none__' }
}

function formatBook(book) {
  return {
    ...book,
    quantity: book.copies,
    availableQuantity: book.availableCopies,
  }
}

function registerCompatRoutes(app, { prisma, requireRole }) {
  // ===== REPORTS =====
  app.get('/api/reports/students', requireRole('SuperAdmin', 'SchoolAdmin', 'Teacher'), async (req, res) => {
    try {
      const schoolId = req.user.schoolId
      const students = await prisma.student.findMany({
        where: schoolId ? { schoolId } : {},
        include: {
          user: { select: { firstName: true, lastName: true, email: true } },
          class: { select: { name: true } },
          results: { include: { subject: { select: { name: true } } } },
        },
      })
      const report = students.map((s) => ({
        studentId: s.id,
        name: `${s.user.firstName} ${s.user.lastName}`,
        class: s.class?.name,
        averageScore:
          s.results.length > 0
            ? Math.round(s.results.reduce((sum, r) => sum + r.totalScore, 0) / s.results.length)
            : 0,
        subjects: s.results.length,
      }))
      res.json(report)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  // ===== PARENT FEES =====
  app.get('/api/parents/fees/:studentId', requireRole('Parent', 'SuperAdmin', 'SchoolAdmin'), async (req, res) => {
    try {
      const student = await prisma.student.findUnique({
        where: { id: req.params.studentId },
        include: { parent: { include: { user: true } } },
      })
      if (!student) return res.status(404).json({ error: 'Student not found' })

      if (req.user.role === 'Parent') {
        const parent = await prisma.parent.findUnique({ where: { userId: req.user.userId } })
        if (!parent || student.parentId !== parent.id) {
          return res.status(403).json({ error: 'Forbidden' })
        }
      }

      const { computeStudentFeesOverview } = require('../lib/financeHelpers')
      const overview = await computeStudentFeesOverview(prisma, student.id)
      res.json({
        fees: overview?.fees || [],
        paidTotal: overview?.totalPaid || 0,
        outstanding: overview?.balance || 0,
      })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  // Gateway verify moved to financeRoutes — stubs removed

  // ===== FILE UPLOAD (Cloudinary optional) =====
  app.post('/api/upload', requireRole('SuperAdmin', 'SchoolAdmin', 'Teacher', 'Student'), async (req, res) => {
    try {
      const { fileBase64, folder, resourceType, originalName } = req.body
      if (!fileBase64) return res.status(400).json({ error: 'No file provided' })

      const { uploadFile } = require('../lib/uploadHelpers')
      const result = await uploadFile({ fileBase64, folder, resourceType, originalName })
      res.json(result)
    } catch (err) {
      console.error(err)
      res.status(400).json({ error: err.message || 'Upload failed' })
    }
  })

  // ===== SUPER ADMIN EXPORT =====
  app.get('/api/admin/export', requireRole('SuperAdmin'), async (req, res) => {
    try {
      const [schools, users, students] = await Promise.all([
        prisma.school.findMany(),
        prisma.user.findMany({ include: { role: true } }),
        prisma.student.findMany({ include: { user: true } }),
      ])
      res.json({ exportedAt: new Date(), schools, users, students })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  // ===== PDF TRANSCRIPTS & REPORT CARDS (see resultsRoutes.js) =====

}

module.exports = { registerCompatRoutes }
