const {
  resolveSchoolId,
  hashTemplate,
  formatDevice,
  formatEnrollment,
  formatEvent,
  getOrCreateSettings,
  processBiometricScan,
  biometricStatsForSchool,
  checkTenantAccess,
} = require('../lib/biometricHelpers')

function registerBiometricRoutes(app, { prisma, requireRole }) {
  const staffRoles = ['SuperAdmin', 'SchoolAdmin', 'BiometricManager']

  async function resolveDeviceAuth(req) {
    const apiKey = req.headers['x-device-key'] || req.body.apiKey
    if (apiKey) {
      const device = await prisma.biometricDevice.findFirst({
        where: { apiKey: String(apiKey), isActive: true },
      })
      if (device) return { device, schoolId: device.schoolId }
    }
    if (req.user && staffRoles.includes(req.user.role)) {
      const schoolId = resolveSchoolId(req)
      const deviceId = req.body.deviceId
      if (!deviceId || !schoolId) return null
      const device = await prisma.biometricDevice.findFirst({
        where: { id: deviceId, schoolId, isActive: true },
      })
      if (device) return { device, schoolId }
    }
    return null
  }

  app.get('/api/biometrics/stats', requireRole(...staffRoles), async (req, res) => {
    try {
      const schoolId = resolveSchoolId(req)
      if (!schoolId) return res.status(400).json({ error: 'School required' })
      res.json(await biometricStatsForSchool(prisma, schoolId))
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.get('/api/biometrics/settings', requireRole(...staffRoles), async (req, res) => {
    try {
      const schoolId = resolveSchoolId(req)
      if (!schoolId) return res.status(400).json({ error: 'School required' })
      res.json(await getOrCreateSettings(prisma, schoolId))
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.put('/api/biometrics/settings', requireRole(...staffRoles), async (req, res) => {
    try {
      const schoolId = resolveSchoolId(req)
      if (!schoolId) return res.status(400).json({ error: 'School required' })
      const settings = await prisma.biometricSetting.upsert({
        where: { schoolId },
        update: {
          fingerprintEnabled: req.body.fingerprintEnabled,
          facialEnabled: req.body.facialEnabled,
          autoMarkAttendance: req.body.autoMarkAttendance,
          accessControlEnabled: req.body.accessControlEnabled,
          minMatchScore: req.body.minMatchScore != null ? Number(req.body.minMatchScore) : undefined,
        },
        create: {
          schoolId,
          fingerprintEnabled: req.body.fingerprintEnabled ?? true,
          facialEnabled: req.body.facialEnabled ?? true,
          autoMarkAttendance: req.body.autoMarkAttendance ?? true,
          accessControlEnabled: req.body.accessControlEnabled ?? true,
          minMatchScore: req.body.minMatchScore != null ? Number(req.body.minMatchScore) : 0.85,
        },
      })
      res.json(settings)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  // ===== DEVICES =====
  app.get('/api/biometrics/devices', requireRole(...staffRoles), async (req, res) => {
    try {
      const schoolId = resolveSchoolId(req)
      const devices = await prisma.biometricDevice.findMany({
        where: schoolId ? { schoolId } : {},
        orderBy: { name: 'asc' },
      })
      res.json(devices.map(formatDevice))
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.post('/api/biometrics/devices', requireRole(...staffRoles), async (req, res) => {
    try {
      const schoolId = resolveSchoolId(req)
      if (!schoolId) return res.status(400).json({ error: 'School required' })
      const methods = Array.isArray(req.body.methods) ? req.body.methods.join(',') : (req.body.methods || 'fingerprint,facial')
      const device = await prisma.biometricDevice.create({
        data: {
          schoolId,
          name: req.body.name,
          location: req.body.location,
          deviceType: req.body.deviceType || 'gate',
          methods,
          direction: req.body.direction || 'both',
          isActive: req.body.isActive !== false,
        },
      })
      res.status(201).json(formatDevice(device))
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.put('/api/biometrics/devices/:id', requireRole(...staffRoles), async (req, res) => {
    try {
      const existing = await prisma.biometricDevice.findUnique({ where: { id: req.params.id } })
      if (!existing || !checkTenantAccess(req, existing.schoolId)) return res.status(404).json({ error: 'Not found' })
      const methods = req.body.methods
        ? (Array.isArray(req.body.methods) ? req.body.methods.join(',') : req.body.methods)
        : undefined
      const device = await prisma.biometricDevice.update({
        where: { id: existing.id },
        data: {
          name: req.body.name,
          location: req.body.location,
          deviceType: req.body.deviceType,
          methods,
          direction: req.body.direction,
          isActive: req.body.isActive,
        },
      })
      res.json(formatDevice(device))
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.delete('/api/biometrics/devices/:id', requireRole(...staffRoles), async (req, res) => {
    try {
      const existing = await prisma.biometricDevice.findUnique({ where: { id: req.params.id } })
      if (!existing || !checkTenantAccess(req, existing.schoolId)) return res.status(404).json({ error: 'Not found' })
      await prisma.biometricDevice.delete({ where: { id: existing.id } })
      res.json({ message: 'Deleted' })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.get('/api/biometrics/people', requireRole(...staffRoles), async (req, res) => {
    try {
      const schoolId = resolveSchoolId(req)
      if (!schoolId) return res.json({ students: [], employees: [] })
      const [students, employees] = await Promise.all([
        prisma.student.findMany({
          where: { schoolId },
          include: { user: true },
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
        })),
        employees: employees.map((e) => ({
          id: e.id,
          firstName: e.firstName,
          lastName: e.lastName,
          employeeNo: e.employeeNo,
        })),
      })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.get('/api/biometrics/enrollments', requireRole(...staffRoles), async (req, res) => {
    try {
      const schoolId = resolveSchoolId(req)
      const enrollments = await prisma.biometricEnrollment.findMany({
        where: schoolId ? { schoolId } : {},
        include: {
          student: { include: { user: true } },
          employee: true,
        },
        orderBy: { enrolledAt: 'desc' },
      })
      res.json(enrollments.map(formatEnrollment))
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.post('/api/biometrics/enrollments', requireRole(...staffRoles), async (req, res) => {
    try {
      const schoolId = resolveSchoolId(req)
      if (!schoolId) return res.status(400).json({ error: 'School required' })
      const { personType, studentId, employeeId, method, templateSeed, label } = req.body
      if (!personType || !method) return res.status(400).json({ error: 'Person type and method required' })
      if (personType === 'student' && !studentId) return res.status(400).json({ error: 'Student required' })
      if (personType === 'employee' && !employeeId) return res.status(400).json({ error: 'Employee required' })

      const seed = templateSeed || `${personType}-${studentId || employeeId}-${method}`
      const enrollment = await prisma.biometricEnrollment.create({
        data: {
          schoolId,
          personType,
          studentId: personType === 'student' ? studentId : null,
          employeeId: personType === 'employee' ? employeeId : null,
          method,
          templateHash: hashTemplate(seed),
          label: label || null,
          enrolledById: req.user.userId || req.user.id,
        },
        include: { student: { include: { user: true } }, employee: true },
      })
      res.status(201).json(formatEnrollment(enrollment))
    } catch (err) {
      if (err.code === 'P2002') return res.status(400).json({ error: 'Enrollment already exists for this person and method' })
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.post('/api/biometrics/enrollments/:id/revoke', requireRole(...staffRoles), async (req, res) => {
    try {
      const enrollment = await prisma.biometricEnrollment.findUnique({ where: { id: req.params.id } })
      if (!enrollment || !checkTenantAccess(req, enrollment.schoolId)) return res.status(404).json({ error: 'Not found' })
      const updated = await prisma.biometricEnrollment.update({
        where: { id: enrollment.id },
        data: { status: 'revoked' },
        include: { student: { include: { user: true } }, employee: true },
      })
      res.json(formatEnrollment(updated))
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  // ===== SCAN (device or staff simulation) =====
  app.post('/api/biometrics/scan', async (req, res) => {
    try {
      const auth = await resolveDeviceAuth(req)
      if (!auth) return res.status(401).json({ error: 'Unauthorized device or staff session' })

      const { device } = auth
      const method = req.body.method || 'fingerprint'
      const { enrollmentId, templateSeed, templateHash, direction, matchScore } = req.body

      let enrollment = null
      if (enrollmentId) {
        enrollment = await prisma.biometricEnrollment.findFirst({
          where: { id: enrollmentId, schoolId: device.schoolId, status: 'active' },
        })
      } else {
        const hash = templateHash || (templateSeed ? hashTemplate(templateSeed) : null)
        if (hash) {
          enrollment = await prisma.biometricEnrollment.findFirst({
            where: { schoolId: device.schoolId, templateHash: hash, status: 'active', method },
          })
        }
      }

      const result = await processBiometricScan(prisma, {
        device,
        enrollment,
        method,
        matchScore,
        direction,
        markedById: req.user?.userId || req.user?.id,
      })
      res.json(result)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  // ===== EVENTS / ACCESS LOGS =====
  app.get('/api/biometrics/events', requireRole(...staffRoles), async (req, res) => {
    try {
      const schoolId = resolveSchoolId(req)
      if (!schoolId) return res.json([])
      const where = { schoolId }
      if (req.query.eventType) where.eventType = String(req.query.eventType)
      if (req.query.status) where.status = String(req.query.status)
      const events = await prisma.biometricEvent.findMany({
        where,
        include: {
          device: true,
          student: { include: { user: true } },
          employee: true,
        },
        orderBy: { createdAt: 'desc' },
        take: Math.min(Number(req.query.limit) || 100, 500),
      })
      res.json(events.map(formatEvent))
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.get('/api/biometrics/access-logs', requireRole(...staffRoles), async (req, res) => {
    try {
      const schoolId = resolveSchoolId(req)
      if (!schoolId) return res.json([])
      const events = await prisma.biometricEvent.findMany({
        where: { schoolId, eventType: 'access' },
        include: {
          device: true,
          student: { include: { user: true } },
          employee: true,
        },
        orderBy: { createdAt: 'desc' },
        take: Math.min(Number(req.query.limit) || 100, 500),
      })
      res.json(events.map(formatEvent))
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })
}

module.exports = { registerBiometricRoutes }
