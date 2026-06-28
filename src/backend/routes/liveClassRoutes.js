const {
  schoolScope,
  assertLiveClassTenant,
  generateRoomCode,
  buildJitsiUrl,
  getStudentRecord,
  getTeacherRecord,
  formatLiveClassSummary,
} = require('../lib/liveClassHelpers')

const liveClassInclude = {
  class: { select: { id: true, name: true } },
  subject: { select: { id: true, name: true } },
  teacher: { include: { user: { select: { firstName: true, lastName: true } } } },
  _count: { select: { attendance: true } },
}

function registerLiveClassRoutes(app, { prisma, requireRole }) {
  const staffRoles = ['SuperAdmin', 'SchoolAdmin', 'Teacher']
  const joinRoles = [...staffRoles, 'Student']

  async function loadLiveClass(req, res, next) {
    try {
      const liveClass = await prisma.liveClass.findUnique({
        where: { id: req.params.id },
        include: liveClassInclude,
      })
      if (!liveClass) return res.status(404).json({ error: 'Live class not found' })
      if (!assertLiveClassTenant(req.user, liveClass)) {
        return res.status(403).json({ error: 'Cross-tenant access denied' })
      }
      req.liveClass = liveClass
      next()
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  }

  app.get('/api/live-classes', requireRole(...joinRoles), async (req, res) => {
    try {
      const scope = schoolScope(req.user)
      const student = await getStudentRecord(prisma, req.user)
      const teacher = await getTeacherRecord(prisma, req.user)

      const where = { ...scope }
      if (req.user.role === 'Teacher' && teacher) where.teacherId = teacher.id
      if (student) {
        where.OR = [{ classId: null }, { classId: student.classId }]
        where.status = { in: ['scheduled', 'live', 'ended'] }
      }

      const classes = await prisma.liveClass.findMany({
        where,
        include: liveClassInclude,
        orderBy: [{ status: 'asc' }, { scheduledAt: 'desc' }],
      })

      res.json(classes.map((c) => formatLiveClassSummary(c, c._count.attendance)))
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.post('/api/live-classes', requireRole(...staffRoles), async (req, res) => {
    try {
      const { title, description, classId, subjectId, scheduledAt } = req.body
      if (!title) return res.status(400).json({ error: 'Title required' })

      const teacher = await getTeacherRecord(prisma, req.user)
      const schoolId = req.user.role === 'SuperAdmin' ? req.body.schoolId : req.user.schoolId
      if (!schoolId) return res.status(400).json({ error: 'School context required' })

      let roomCode = generateRoomCode()
      for (let i = 0; i < 5; i++) {
        const exists = await prisma.liveClass.findUnique({ where: { roomCode } })
        if (!exists) break
        roomCode = generateRoomCode()
      }

      const liveClass = await prisma.liveClass.create({
        data: {
          schoolId,
          title,
          description: description || null,
          roomCode,
          classId: classId || null,
          subjectId: subjectId || null,
          teacherId: teacher?.id || null,
          scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        },
        include: liveClassInclude,
      })

      res.status(201).json(formatLiveClassSummary(liveClass, 0))
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.get('/api/live-classes/:id', requireRole(...joinRoles), loadLiveClass, async (req, res) => {
    res.json(formatLiveClassSummary(req.liveClass, req.liveClass._count.attendance))
  })

  app.put('/api/live-classes/:id', requireRole(...staffRoles), loadLiveClass, async (req, res) => {
    try {
      const { title, description, classId, subjectId, scheduledAt, recordingUrl } = req.body
      const updated = await prisma.liveClass.update({
        where: { id: req.liveClass.id },
        data: {
          title: title ?? undefined,
          description: description ?? undefined,
          classId: classId ?? undefined,
          subjectId: subjectId ?? undefined,
          scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
          recordingUrl: recordingUrl ?? undefined,
        },
        include: liveClassInclude,
      })
      res.json(formatLiveClassSummary(updated, updated._count.attendance))
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.delete('/api/live-classes/:id', requireRole('SuperAdmin', 'SchoolAdmin'), loadLiveClass, async (req, res) => {
    try {
      await prisma.liveClass.delete({ where: { id: req.liveClass.id } })
      res.json({ message: 'Live class deleted' })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.post('/api/live-classes/:id/start', requireRole(...staffRoles), loadLiveClass, async (req, res) => {
    try {
      const updated = await prisma.liveClass.update({
        where: { id: req.liveClass.id },
        data: { status: 'live', startedAt: new Date(), endedAt: null },
        include: liveClassInclude,
      })
      res.json(formatLiveClassSummary(updated, updated._count.attendance))
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.post('/api/live-classes/:id/end', requireRole(...staffRoles), loadLiveClass, async (req, res) => {
    try {
      const updated = await prisma.liveClass.update({
        where: { id: req.liveClass.id },
        data: {
          status: 'ended',
          endedAt: new Date(),
          recordingUrl: req.body.recordingUrl ?? req.liveClass.recordingUrl,
        },
        include: liveClassInclude,
      })
      res.json(formatLiveClassSummary(updated, updated._count.attendance))
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.post('/api/live-classes/:id/join', requireRole(...joinRoles), loadLiveClass, async (req, res) => {
    try {
      const userId = req.user.userId || req.user.id
      const student = await getStudentRecord(prisma, req.user)

      if (req.user.role === 'Student' && req.liveClass.classId && student?.classId !== req.liveClass.classId) {
        return res.status(403).json({ error: 'This class is not for your class group' })
      }

      await prisma.liveClassAttendance.upsert({
        where: { liveClassId_userId: { liveClassId: req.liveClass.id, userId } },
        update: { leftAt: null },
        create: {
          liveClassId: req.liveClass.id,
          userId,
          studentId: student?.id || null,
        },
      })

      const displayName = `${req.user.firstName || 'User'} ${req.user.lastName || ''}`.trim()
      res.json({
        jitsiUrl: buildJitsiUrl(req.liveClass.roomCode, displayName),
        roomCode: req.liveClass.roomCode,
        status: req.liveClass.status,
        canModerate: staffRoles.includes(req.user.role),
      })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.post('/api/live-classes/:id/leave', requireRole(...joinRoles), loadLiveClass, async (req, res) => {
    try {
      const userId = req.user.userId || req.user.id
      await prisma.liveClassAttendance.updateMany({
        where: { liveClassId: req.liveClass.id, userId },
        data: { leftAt: new Date() },
      })
      res.json({ message: 'Left session' })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.get('/api/live-classes/:id/attendance', requireRole(...staffRoles), loadLiveClass, async (req, res) => {
    try {
      const records = await prisma.liveClassAttendance.findMany({
        where: { liveClassId: req.liveClass.id },
        include: {
          user: { select: { firstName: true, lastName: true, email: true, role: { select: { name: true } } } },
          student: { select: { admissionNo: true } },
        },
        orderBy: { joinedAt: 'asc' },
      })
      res.json(records)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.get('/api/live-classes/:id/messages', requireRole(...joinRoles), loadLiveClass, async (req, res) => {
    try {
      const since = req.query.since ? new Date(String(req.query.since)) : null
      const messages = await prisma.liveClassMessage.findMany({
        where: {
          liveClassId: req.liveClass.id,
          ...(since ? { createdAt: { gt: since } } : {}),
        },
        include: {
          user: { select: { firstName: true, lastName: true, role: { select: { name: true } } } },
        },
        orderBy: { createdAt: 'asc' },
        take: since ? 100 : 200,
      })
      res.json(messages)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.post('/api/live-classes/:id/messages', requireRole(...joinRoles), loadLiveClass, async (req, res) => {
    try {
      const { body } = req.body
      if (!body?.trim()) return res.status(400).json({ error: 'Message required' })
      const userId = req.user.userId || req.user.id
      const message = await prisma.liveClassMessage.create({
        data: { liveClassId: req.liveClass.id, userId, body: body.trim() },
        include: {
          user: { select: { firstName: true, lastName: true, role: { select: { name: true } } } },
        },
      })
      res.status(201).json(message)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.get('/api/live-classes/:id/whiteboard', requireRole(...joinRoles), loadLiveClass, async (req, res) => {
    try {
      const row = await prisma.liveClass.findUnique({
        where: { id: req.liveClass.id },
        select: { whiteboardData: true, updatedAt: true },
      })
      let strokes = []
      if (row?.whiteboardData) {
        try {
          strokes = JSON.parse(row.whiteboardData)
        } catch {
          strokes = []
        }
      }
      res.json({ strokes, updatedAt: row?.updatedAt })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.put('/api/live-classes/:id/whiteboard', requireRole(...staffRoles), loadLiveClass, async (req, res) => {
    try {
      const { strokes } = req.body
      if (!Array.isArray(strokes)) return res.status(400).json({ error: 'strokes array required' })
      await prisma.liveClass.update({
        where: { id: req.liveClass.id },
        data: { whiteboardData: JSON.stringify(strokes) },
      })
      res.json({ ok: true })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })
}

module.exports = { registerLiveClassRoutes }
