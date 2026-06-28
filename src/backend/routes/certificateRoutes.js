const {
  CERTIFICATE_TYPES,
  resolveSchoolId,
  generateVerifyCode,
  generateCertificateNumber,
  defaultTitle,
  formatCertificate,
  formatVerifyPayload,
  certificateStatsForSchool,
  checkTenantAccess,
} = require('../lib/certificateHelpers')
const { streamSchoolCertificate } = require('../lib/schoolCertificatePdf')

function registerCertificateRoutes(app, { prisma, requireRole }) {
  const staffRoles = ['SuperAdmin', 'SchoolAdmin']

  app.get('/api/public/certificates/verify/:code', async (req, res) => {
    try {
      const code = req.params.code
      const schoolCert = await prisma.schoolCertificate.findUnique({
        where: { verifyCode: code },
        include: { school: true },
      })
      if (schoolCert) {
        if (schoolCert.status === 'revoked') {
          return res.json({ valid: false, revoked: true, error: 'Certificate has been revoked' })
        }
        return res.json(formatVerifyPayload(schoolCert, schoolCert.school))
      }

      const lmsCert = await prisma.lmsCertificate.findUnique({
        where: { verifyCode: code },
        include: {
          course: { select: { title: true } },
          student: {
            include: {
              user: { select: { firstName: true, lastName: true } },
              school: { select: { name: true } },
            },
          },
        },
      })
      if (!lmsCert) return res.status(404).json({ valid: false, error: 'Certificate not found' })

      res.json({
        valid: true,
        source: 'lms',
        certificateType: 'course_completion',
        title: 'Certificate of Completion',
        certificateNumber: lmsCert.certificateNumber,
        courseTitle: lmsCert.course.title,
        recipientName: `${lmsCert.student.user.firstName} ${lmsCert.student.user.lastName}`,
        studentName: `${lmsCert.student.user.firstName} ${lmsCert.student.user.lastName}`,
        schoolName: lmsCert.student.school.name,
        issuedAt: lmsCert.issuedAt,
      })
    } catch (err) {
      console.error(err)
      res.status(500).json({ valid: false, error: 'Server error' })
    }
  })

  app.get('/api/certificates/stats', requireRole(...staffRoles), async (req, res) => {
    try {
      const schoolId = resolveSchoolId(req)
      if (!schoolId) return res.status(400).json({ error: 'School required' })
      res.json(await certificateStatsForSchool(prisma, schoolId))
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.get('/api/certificates/types', requireRole(...staffRoles, 'Teacher', 'Student', 'Parent'), async (_req, res) => {
    res.json(
      Object.entries(CERTIFICATE_TYPES).map(([id, label]) => ({ id, label }))
    )
  })

  app.get('/api/certificates', requireRole(...staffRoles, 'Teacher'), async (req, res) => {
    try {
      const schoolId = resolveSchoolId(req)
      const where = schoolId ? { schoolId } : {}
      if (req.query.type) where.certificateType = String(req.query.type)
      if (req.query.status) where.status = String(req.query.status)
      const certificates = await prisma.schoolCertificate.findMany({
        where,
        include: { student: { include: { user: true } } },
        orderBy: { issuedAt: 'desc' },
        take: Math.min(Number(req.query.limit) || 200, 500),
      })
      res.json(certificates.map(formatCertificate))
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.get('/api/certificates/my', requireRole('Student'), async (req, res) => {
    try {
      const student = await prisma.student.findUnique({ where: { userId: req.user.userId || req.user.id } })
      if (!student) return res.json([])
      const certificates = await prisma.schoolCertificate.findMany({
        where: { studentId: student.id, status: 'active' },
        orderBy: { issuedAt: 'desc' },
      })
      res.json(certificates.map(formatCertificate))
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.post('/api/certificates', requireRole(...staffRoles), async (req, res) => {
    try {
      const schoolId = resolveSchoolId(req)
      if (!schoolId) return res.status(400).json({ error: 'School required' })

      const {
        certificateType,
        studentId,
        employeeId,
        recipientName,
        description,
        sessionLabel,
        className,
        metadata,
        title,
      } = req.body

      if (!certificateType || !CERTIFICATE_TYPES[certificateType]) {
        return res.status(400).json({ error: 'Valid certificate type required' })
      }

      let name = recipientName
      let resolvedStudentId = studentId || null
      let resolvedEmployeeId = employeeId || null

      if (studentId) {
        const student = await prisma.student.findUnique({
          where: { id: studentId },
          include: { user: true, class: true },
        })
        if (!student || student.schoolId !== schoolId) return res.status(404).json({ error: 'Student not found' })
        name = name || `${student.user.firstName} ${student.user.lastName}`
        if (!className && student.class) req.body.className = student.class.name
      } else if (employeeId) {
        const employee = await prisma.employee.findUnique({ where: { id: employeeId } })
        if (!employee || employee.schoolId !== schoolId) return res.status(404).json({ error: 'Employee not found' })
        name = name || `${employee.firstName} ${employee.lastName}`
      }

      if (!name) return res.status(400).json({ error: 'Recipient name required' })

      const certificate = await prisma.schoolCertificate.create({
        data: {
          schoolId,
          certificateType,
          title: title || defaultTitle(certificateType),
          studentId: resolvedStudentId,
          employeeId: resolvedEmployeeId,
          recipientName: name,
          description: description || null,
          sessionLabel: sessionLabel || null,
          className: className || req.body.className || null,
          metadata: metadata || null,
          certificateNumber: generateCertificateNumber(certificateType),
          verifyCode: generateVerifyCode(),
          issuedById: req.user.userId || req.user.id,
        },
        include: { student: { include: { user: true } } },
      })
      res.status(201).json(formatCertificate(certificate))
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.post('/api/certificates/:id/revoke', requireRole(...staffRoles), async (req, res) => {
    try {
      const certificate = await prisma.schoolCertificate.findUnique({ where: { id: req.params.id } })
      if (!certificate || !checkTenantAccess(req, certificate.schoolId)) {
        return res.status(404).json({ error: 'Not found' })
      }
      const updated = await prisma.schoolCertificate.update({
        where: { id: certificate.id },
        data: { status: 'revoked', revokedAt: new Date() },
        include: { student: { include: { user: true } } },
      })
      res.json(formatCertificate(updated))
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.get('/api/certificates/:id/pdf', requireRole('Student', ...staffRoles), async (req, res) => {
    try {
      const certificate = await prisma.schoolCertificate.findUnique({
        where: { id: req.params.id },
        include: { school: true, student: true },
      })
      if (!certificate) return res.status(404).json({ error: 'Not found' })

      if (req.user.role === 'Student') {
        const student = await prisma.student.findUnique({ where: { userId: req.user.userId || req.user.id } })
        if (!student || certificate.studentId !== student.id) return res.status(403).json({ error: 'Forbidden' })
      } else if (req.user.role !== 'SuperAdmin' && certificate.schoolId !== req.user.schoolId) {
        return res.status(403).json({ error: 'Forbidden' })
      }

      if (certificate.status === 'revoked') return res.status(410).json({ error: 'Certificate revoked' })

      await streamSchoolCertificate(res, certificate, certificate.school)
    } catch (err) {
      console.error(err)
      if (!res.headersSent) res.status(500).json({ error: 'Server error' })
    }
  })
}

module.exports = { registerCertificateRoutes }
