const { tenantWhere } = require('../middleware/tenantGuard')
const { checkTenantAccess, ensureStudentViewerAccess } = require('../lib/tenantHelpers')
const { buildBroadsheet, summarizeResults } = require('../lib/resultsHelpers')
const { streamReportCardPdf, streamTranscriptPdf, streamBroadsheetPdf } = require('../lib/resultsPdf')

function registerResultsRoutes(app, { prisma, requireRole }) {
  const staffRoles = ['SuperAdmin', 'SchoolAdmin', 'Teacher']
  const viewRoles = [...staffRoles, 'Student', 'Parent']

  app.get('/api/broadsheets/:classId', requireRole(...staffRoles), async (req, res) => {
    try {
      const classId = req.params.classId
      const { examId, publishedOnly } = req.query
      const scope = tenantWhere(req.user)

      const classRow = await prisma.class.findUnique({
        where: { id: classId },
        include: { school: true },
      })
      if (!classRow) return res.status(404).json({ error: 'Class not found' })
      if (!checkTenantAccess(req.user, classRow.schoolId, res)) return

      const students = await prisma.student.findMany({
        where: { classId, ...(scope.schoolId ? { schoolId: scope.schoolId } : {}) },
        include: { user: { select: { firstName: true, lastName: true } } },
        orderBy: { admissionNo: 'asc' },
      })

      const subjects = await prisma.subject.findMany({
        where: { classId },
        orderBy: { name: 'asc' },
      })

      const resultWhere = {
        student: { classId },
        ...(examId ? { examId: String(examId) } : {}),
      }
      const results = await prisma.result.findMany({
        where: resultWhere,
        include: { subject: true },
      })

      const broadsheet = buildBroadsheet(students, subjects, results, {
        publishedOnly: publishedOnly !== 'false',
      })

      res.json({
        class: { id: classRow.id, name: classRow.name },
        school: classRow.school?.name,
        examId: examId || null,
        ...broadsheet,
      })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.get('/api/broadsheets/:classId/pdf', requireRole(...staffRoles), async (req, res) => {
    try {
      const classId = req.params.classId
      const { examId, termLabel } = req.query

      const classRow = await prisma.class.findUnique({
        where: { id: classId },
        include: { school: true },
      })
      if (!classRow) return res.status(404).json({ error: 'Class not found' })
      if (!checkTenantAccess(req.user, classRow.schoolId, res)) return

      const students = await prisma.student.findMany({
        where: { classId },
        include: { user: { select: { firstName: true, lastName: true } } },
      })
      const subjects = await prisma.subject.findMany({ where: { classId }, orderBy: { name: 'asc' } })
      const results = await prisma.result.findMany({
        where: { student: { classId }, ...(examId ? { examId: String(examId) } : {}) },
        include: { subject: true },
      })

      const broadsheet = buildBroadsheet(students, subjects, results, { publishedOnly: true })
      streamBroadsheetPdf(res, classRow.school, classRow.name, broadsheet, termLabel ? String(termLabel) : '')
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.get('/api/reportcards/:studentId/pdf', requireRole(...viewRoles), async (req, res) => {
    try {
      const student = await prisma.student.findUnique({
        where: { id: req.params.studentId },
        include: {
          user: true,
          class: true,
          school: true,
          results: {
            where: req.user.role === 'Student' || req.user.role === 'Parent' ? { published: true } : {},
            include: { subject: true, exam: true },
            orderBy: { createdAt: 'desc' },
          },
        },
      })
      if (!student) return res.status(404).json({ error: 'Student not found' })
      if (!checkTenantAccess(req.user, student.schoolId, res)) return
      if (!(await ensureStudentViewerAccess(prisma, req, res, student.id))) return

      streamReportCardPdf(res, student, student.school, student.results)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.get('/api/transcripts/:studentId/pdf', requireRole(...viewRoles), async (req, res) => {
    try {
      const publishedFilter =
        req.user.role === 'Student' || req.user.role === 'Parent' ? { published: true } : {}

      const student = await prisma.student.findUnique({
        where: { id: req.params.studentId },
        include: {
          user: true,
          class: true,
          school: true,
          results: {
            where: publishedFilter,
            include: { subject: true, exam: true },
            orderBy: { createdAt: 'desc' },
          },
        },
      })
      if (!student) return res.status(404).json({ error: 'Student not found' })
      if (!checkTenantAccess(req.user, student.schoolId, res)) return
      if (!(await ensureStudentViewerAccess(prisma, req, res, student.id))) return

      streamTranscriptPdf(res, student, student.school, student.results)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.get('/api/reportcards/:studentId/summary', requireRole(...viewRoles), async (req, res) => {
    try {
      const student = await prisma.student.findUnique({
        where: { id: req.params.studentId },
        include: {
          user: true,
          class: true,
          results: {
            where: { published: true },
            include: { subject: true },
          },
        },
      })
      if (!student) return res.status(404).json({ error: 'Student not found' })
      if (!checkTenantAccess(req.user, student.schoolId, res)) return
      if (!(await ensureStudentViewerAccess(prisma, req, res, student.id))) return

      res.json({
        student: {
          name: `${student.user.firstName} ${student.user.lastName}`,
          admissionNo: student.admissionNo,
          class: student.class?.name,
        },
        results: student.results.map((r) => ({
          subject: r.subject.name,
          code: r.subject.code,
          score: r.totalScore,
          grade: r.grade,
          gpa: r.gpa,
          feedback: r.feedback,
        })),
        summary: summarizeResults(student.results),
        generatedAt: new Date().toISOString(),
      })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })
}

module.exports = { registerResultsRoutes }
