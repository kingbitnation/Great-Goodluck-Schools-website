const {
  resolveSchoolId,
  generateVerifyCode,
  generateCardNumber,
  defaultExpiry,
  formatIdCard,
  formatVerifyPayload,
  idCardStatsForSchool,
  checkTenantAccess,
} = require('../lib/idCardHelpers')
const { streamIdCardPdf } = require('../lib/idCardPdf')

function registerIdCardRoutes(app, { prisma, requireRole }) {
  const staffRoles = ['SuperAdmin', 'SchoolAdmin']
  const holderRoles = ['Student', 'Teacher', 'HRManager', 'Accountant', 'Librarian', 'HostelManager', 'TransportManager', 'BiometricManager']

  app.get('/api/public/id-cards/verify/:code', async (req, res) => {
    try {
      const card = await prisma.digitalIdCard.findUnique({
        where: { verifyCode: req.params.code },
        include: { school: true },
      })
      if (!card) return res.status(404).json({ valid: false, error: 'ID card not found' })
      res.json(formatVerifyPayload(card, card.school))
    } catch (err) {
      console.error(err)
      res.status(500).json({ valid: false, error: 'Server error' })
    }
  })

  app.get('/api/id-cards/stats', requireRole(...staffRoles), async (req, res) => {
    try {
      const schoolId = resolveSchoolId(req)
      if (!schoolId) return res.status(400).json({ error: 'School required' })
      res.json(await idCardStatsForSchool(prisma, schoolId))
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.get('/api/id-cards', requireRole(...staffRoles), async (req, res) => {
    try {
      const schoolId = resolveSchoolId(req)
      const where = schoolId ? { schoolId } : {}
      if (req.query.cardType) where.cardType = String(req.query.cardType)
      if (req.query.status) where.status = String(req.query.status)
      const cards = await prisma.digitalIdCard.findMany({
        where,
        include: { school: true, student: true, employee: true },
        orderBy: { issuedAt: 'desc' },
        take: Math.min(Number(req.query.limit) || 200, 500),
      })
      res.json(cards.map(formatIdCard))
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.get('/api/id-cards/people', requireRole(...staffRoles), async (req, res) => {
    try {
      const schoolId = resolveSchoolId(req)
      if (!schoolId) return res.json({ students: [], employees: [] })
      const [students, employees] = await Promise.all([
        prisma.student.findMany({
          where: { schoolId },
          include: { user: true, class: true },
          orderBy: { admissionNo: 'asc' },
        }),
        prisma.employee.findMany({
          where: { schoolId, status: 'active' },
          orderBy: { employeeNo: 'asc' },
        }),
      ])
      res.json({
        students: students.map((s) => ({
          id: s.id,
          firstName: s.user.firstName,
          lastName: s.user.lastName,
          admissionNo: s.admissionNo,
          className: s.class?.name,
        })),
        employees: employees.map((e) => ({
          id: e.id,
          firstName: e.firstName,
          lastName: e.lastName,
          employeeNo: e.employeeNo,
          jobTitle: e.jobTitle,
        })),
      })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.get('/api/id-cards/my', requireRole(...holderRoles), async (req, res) => {
    try {
      const userId = req.user.userId || req.user.id
      const student = await prisma.student.findUnique({ where: { userId } })
      if (student) {
        const card = await prisma.digitalIdCard.findFirst({
          where: { studentId: student.id, status: 'active' },
          include: { school: true },
          orderBy: { issuedAt: 'desc' },
        })
        return res.json(card ? formatIdCard(card) : null)
      }
      const employee = await prisma.employee.findFirst({ where: { userId, status: 'active' } })
      if (employee) {
        const card = await prisma.digitalIdCard.findFirst({
          where: { employeeId: employee.id, status: 'active' },
          include: { school: true },
          orderBy: { issuedAt: 'desc' },
        })
        return res.json(card ? formatIdCard(card) : null)
      }
      res.json(null)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.post('/api/id-cards', requireRole(...staffRoles), async (req, res) => {
    try {
      const schoolId = resolveSchoolId(req)
      if (!schoolId) return res.status(400).json({ error: 'School required' })

      const { cardType, studentId, employeeId, expiresAt, photoUrl } = req.body
      if (!cardType || !['student', 'staff'].includes(cardType)) {
        return res.status(400).json({ error: 'Valid card type required' })
      }

      let payload = {
        schoolId,
        cardType,
        holderName: '',
        roleLabel: cardType === 'student' ? 'Student' : 'Staff',
        departmentOrClass: null,
        idNumber: null,
        bloodType: null,
        photoUrl: photoUrl || null,
        expiresAt: expiresAt ? new Date(expiresAt) : defaultExpiry(1),
      }

      if (cardType === 'student') {
        if (!studentId) return res.status(400).json({ error: 'Student required' })
        const student = await prisma.student.findUnique({
          where: { id: studentId },
          include: { user: true, class: true },
        })
        if (!student || student.schoolId !== schoolId) return res.status(404).json({ error: 'Student not found' })
        payload.studentId = student.id
        payload.holderName = `${student.user.firstName} ${student.user.lastName}`
        payload.departmentOrClass = student.class?.name || null
        payload.idNumber = student.admissionNo
        payload.bloodType = student.bloodType || null
        payload.photoUrl = photoUrl || student.user.avatar || null
        await prisma.digitalIdCard.updateMany({
          where: { studentId: student.id, status: 'active' },
          data: { status: 'revoked' },
        })
      } else {
        if (!employeeId) return res.status(400).json({ error: 'Employee required' })
        const employee = await prisma.employee.findUnique({
          where: { id: employeeId },
          include: { user: true },
        })
        if (!employee || employee.schoolId !== schoolId) return res.status(404).json({ error: 'Employee not found' })
        payload.employeeId = employee.id
        payload.holderName = `${employee.firstName} ${employee.lastName}`
        payload.roleLabel = employee.jobTitle
        payload.departmentOrClass = employee.department || null
        payload.idNumber = employee.employeeNo
        payload.photoUrl = photoUrl || employee.user?.avatar || null
        await prisma.digitalIdCard.updateMany({
          where: { employeeId: employee.id, status: 'active' },
          data: { status: 'revoked' },
        })
      }

      const card = await prisma.digitalIdCard.create({
        data: {
          ...payload,
          cardNumber: generateCardNumber(cardType),
          verifyCode: generateVerifyCode(),
          issuedById: req.user.userId || req.user.id,
        },
        include: { school: true },
      })
      res.status(201).json(formatIdCard(card))
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.post('/api/id-cards/:id/revoke', requireRole(...staffRoles), async (req, res) => {
    try {
      const card = await prisma.digitalIdCard.findUnique({ where: { id: req.params.id }, include: { school: true } })
      if (!card || !checkTenantAccess(req, card.schoolId)) return res.status(404).json({ error: 'Not found' })
      const updated = await prisma.digitalIdCard.update({
        where: { id: card.id },
        data: { status: 'revoked' },
        include: { school: true },
      })
      res.json(formatIdCard(updated))
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.get('/api/id-cards/:id/pdf', requireRole(...holderRoles, ...staffRoles), async (req, res) => {
    try {
      const card = await prisma.digitalIdCard.findUnique({
        where: { id: req.params.id },
        include: { school: true, student: true, employee: true },
      })
      if (!card) return res.status(404).json({ error: 'Not found' })

      if (!staffRoles.includes(req.user.role)) {
        const userId = req.user.userId || req.user.id
        const student = await prisma.student.findUnique({ where: { userId } })
        const employee = await prisma.employee.findFirst({ where: { userId } })
        const owns =
          (student && card.studentId === student.id) ||
          (employee && card.employeeId === employee.id)
        if (!owns) return res.status(403).json({ error: 'Forbidden' })
      } else if (req.user.role !== 'SuperAdmin' && card.schoolId !== req.user.schoolId) {
        return res.status(403).json({ error: 'Forbidden' })
      }

      if (card.status === 'revoked') return res.status(410).json({ error: 'ID card revoked' })

      await streamIdCardPdf(res, card, card.school)
    } catch (err) {
      console.error(err)
      if (!res.headersSent) res.status(500).json({ error: 'Server error' })
    }
  })
}

module.exports = { registerIdCardRoutes }
