const { tenantWhere } = require('../middleware/tenantGuard')
const { checkTenantAccess } = require('../lib/tenantHelpers')
const { buildExamInstructions } = require('../lib/cbtHelpers')
const {
  STATUSES,
  generateReferenceNo,
  transitionApplication,
  notifyAdmissionEmails,
  resolveSchoolForPublicApply,
  getActiveCycle,
  enrollApplication,
} = require('../lib/admissionHelpers')

async function resolveTeacherId(prisma, user) {
  if (user.role === 'Teacher') {
    const t = await prisma.teacher.findUnique({ where: { userId: user.userId || user.id } })
    return t?.id || null
  }
  const t = await prisma.teacher.findFirst({ where: user.schoolId ? { schoolId: user.schoolId } : {} })
  return t?.id || null
}

function registerAdmissionRoutes(app, { prisma, requireRole, enqueueEmail }) {
  const staffRoles = ['SuperAdmin', 'SchoolAdmin']

  // ===== PUBLIC =====
  app.get('/api/public/admissions/cycles', async (req, res) => {
    try {
      const schoolId = req.query.schoolId ? String(req.query.schoolId) : null
      const school = await resolveSchoolForPublicApply(prisma, { schoolId })
      if (!school) return res.json([])

      const cycles = await prisma.admissionCycle.findMany({
        where: { schoolId: school.id, isActive: true },
        orderBy: { openDate: 'desc' },
      })
      res.json(cycles.map((c) => ({
        id: c.id,
        name: c.name,
        sessionLabel: c.sessionLabel,
        openDate: c.openDate,
        closeDate: c.closeDate,
        schoolId: school.id,
        schoolName: school.name,
      })))
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.post('/api/public/admissions/apply', handlePublicApply)
  app.post('/api/public/apply', handlePublicApply)

  async function handlePublicApply(req, res) {
    const { studentName, parentName, email, phone, grade, gradeApplied, message, schoolId, dob, gender } = req.body
    const gradeLevel = gradeApplied || grade
    if (!studentName || !parentName || !email || !gradeLevel) {
      return res.status(400).json({ error: 'Required fields missing' })
    }
    try {
      const school = await resolveSchoolForPublicApply(prisma, { schoolId })
      if (!school) return res.status(400).json({ error: 'No school accepting applications' })

      const cycle = await getActiveCycle(prisma, school.id)
      const referenceNo = generateReferenceNo()

      const application = await prisma.admissionApplication.create({
        data: {
          schoolId: school.id,
          cycleId: cycle?.id || null,
          referenceNo,
          studentName,
          parentName,
          email,
          phone: phone || null,
          gradeApplied: gradeLevel,
          message: message || null,
          dob: dob ? new Date(dob) : null,
          gender: gender || null,
          status: 'submitted',
        },
      })

      await prisma.applicationStatusLog.create({
        data: { applicationId: application.id, toStatus: 'submitted', note: 'Application submitted online' },
      })

      const admin = await prisma.user.findFirst({
        where: { schoolId: school.id, role: { name: 'SchoolAdmin' }, isActive: true },
      })
      if (admin) {
        await prisma.notification.create({
          data: {
            userId: admin.id,
            type: 'admission',
            title: `Application: ${studentName}`,
            body: `Ref ${referenceNo} | ${parentName} | ${email} | ${gradeLevel}`,
          },
        })
      }

      await notifyAdmissionEmails(prisma, enqueueEmail, {
        application,
        template: 'admission_confirmation',
        extra: { trackUrl: `${process.env.APP_URL || 'http://localhost:3000'}/application/status` },
      })
      if (admin) {
        await enqueueEmail({
          to: admin.email,
          template: 'admission_application',
          payload: {
            studentName,
            parentName,
            email,
            phone,
            grade: gradeLevel,
            message,
            referenceNo,
          },
          schoolId: school.id,
        })
      }

      res.status(201).json({
        message: 'Application received',
        referenceNo,
        applicationId: application.id,
      })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  }

  app.get('/api/public/admissions/track', async (req, res) => {
    try {
      const { referenceNo, email } = req.query
      if (!referenceNo || !email) {
        return res.status(400).json({ error: 'referenceNo and email required' })
      }
      const application = await prisma.admissionApplication.findFirst({
        where: {
          referenceNo: String(referenceNo),
          email: { equals: String(email), mode: 'insensitive' },
        },
        include: {
          statusLogs: { orderBy: { createdAt: 'asc' } },
          interviews: { orderBy: { scheduledAt: 'asc' } },
          school: { select: { name: true } },
        },
      })
      if (!application) return res.status(404).json({ error: 'Application not found' })

      res.json({
        referenceNo: application.referenceNo,
        studentName: application.studentName,
        gradeApplied: application.gradeApplied,
        status: application.status,
        schoolName: application.school.name,
        examScore: application.examScore,
        timeline: application.statusLogs,
        interviews: application.interviews.map((i) => ({
          scheduledAt: i.scheduledAt,
          location: i.location,
          outcome: i.outcome,
        })),
        submittedAt: application.createdAt,
      })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  // ===== ADMIN CRM =====
  app.get('/api/admissions/stats', requireRole(...staffRoles), async (req, res) => {
    try {
      const scope = tenantWhere(req.user)
      const where = scope.schoolId ? { schoolId: scope.schoolId } : {}
      const apps = await prisma.admissionApplication.groupBy({
        by: ['status'],
        where,
        _count: { id: true },
      })
      const total = apps.reduce((s, a) => s + a._count.id, 0)
      res.json({ total, byStatus: Object.fromEntries(apps.map((a) => [a.status, a._count.id])) })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.get('/api/admissions/cycles', requireRole(...staffRoles), async (req, res) => {
    try {
      const scope = tenantWhere(req.user)
      const cycles = await prisma.admissionCycle.findMany({
        where: scope.schoolId ? { schoolId: scope.schoolId } : {},
        orderBy: { openDate: 'desc' },
      })
      res.json(cycles)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.post('/api/admissions/cycles', requireRole(...staffRoles), async (req, res) => {
    try {
      const { name, sessionLabel, openDate, closeDate } = req.body
      const schoolId = req.user.role === 'SuperAdmin' ? req.body.schoolId : req.user.schoolId
      if (!schoolId || !name || !sessionLabel || !openDate || !closeDate) {
        return res.status(400).json({ error: 'Missing required fields' })
      }
      const cycle = await prisma.admissionCycle.create({
        data: {
          schoolId,
          name,
          sessionLabel,
          openDate: new Date(openDate),
          closeDate: new Date(closeDate),
        },
      })
      res.status(201).json(cycle)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.get('/api/admissions', requireRole(...staffRoles), async (req, res) => {
    try {
      const { status, q } = req.query
      const scope = tenantWhere(req.user)
      const where = scope.schoolId ? { schoolId: scope.schoolId } : {}
      if (status) where.status = String(status)
      if (q) {
        where.OR = [
          { studentName: { contains: String(q), mode: 'insensitive' } },
          { parentName: { contains: String(q), mode: 'insensitive' } },
          { email: { contains: String(q), mode: 'insensitive' } },
          { referenceNo: { contains: String(q), mode: 'insensitive' } },
        ]
      }

      const applications = await prisma.admissionApplication.findMany({
        where,
        include: {
          cycle: true,
          interviews: { orderBy: { scheduledAt: 'desc' }, take: 1 },
          _count: { select: { statusLogs: true, interviews: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 200,
      })
      res.json(applications)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.get('/api/admissions/:id', requireRole(...staffRoles), async (req, res) => {
    try {
      const application = await prisma.admissionApplication.findUnique({
        where: { id: req.params.id },
        include: {
          cycle: true,
          statusLogs: { orderBy: { createdAt: 'asc' } },
          interviews: { orderBy: { scheduledAt: 'asc' } },
          enrolledStudent: { include: { user: true, class: true } },
        },
      })
      if (!application) return res.status(404).json({ error: 'Not found' })
      if (!checkTenantAccess(req.user, application.schoolId, res)) return
      res.json(application)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.patch('/api/admissions/:id/status', requireRole(...staffRoles), async (req, res) => {
    try {
      const { status, note, reviewNote } = req.body
      if (!status || !STATUSES.includes(status)) {
        return res.status(400).json({ error: 'Invalid status' })
      }
      const application = await prisma.admissionApplication.findUnique({ where: { id: req.params.id } })
      if (!application) return res.status(404).json({ error: 'Not found' })
      if (!checkTenantAccess(req.user, application.schoolId, res)) return

      const updated = await transitionApplication(prisma, application, status, {
        note,
        reviewNote,
        changedById: req.user.userId || req.user.id,
      })

      const templateMap = {
        accepted: 'admission_accepted',
        rejected: 'admission_rejected',
        exam_scheduled: 'admission_exam_invite',
        waitlisted: 'admission_waitlisted',
      }
      if (templateMap[status]) {
        await notifyAdmissionEmails(prisma, enqueueEmail, {
          application: updated,
          template: templateMap[status],
          extra: { note, reviewNote },
        })
      }

      res.json(updated)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.post('/api/admissions/:id/schedule-exam', requireRole(...staffRoles), async (req, res) => {
    try {
      const { subjectId, classId, duration, startDate, endDate, title } = req.body
      const application = await prisma.admissionApplication.findUnique({ where: { id: req.params.id } })
      if (!application) return res.status(404).json({ error: 'Not found' })
      if (!checkTenantAccess(req.user, application.schoolId, res)) return

      const teacherId = await resolveTeacherId(prisma, req.user)
      if (!teacherId) return res.status(400).json({ error: 'No teacher profile for exam creation' })

      const sub = subjectId
        ? await prisma.subject.findUnique({ where: { id: subjectId } })
        : await prisma.subject.findFirst({ where: { schoolId: application.schoolId } })
      const cls = classId
        ? await prisma.class.findUnique({ where: { id: classId } })
        : await prisma.class.findFirst({ where: { schoolId: application.schoolId } })
      if (!sub || !cls) return res.status(400).json({ error: 'Subject and class required' })

      const start = startDate ? new Date(startDate) : new Date()
      const end = endDate ? new Date(endDate) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

      const exam = await prisma.exam.create({
        data: {
          schoolId: application.schoolId,
          classId: cls.id,
          subjectId: sub.id,
          teacherId,
          name: title || `Entrance Exam — ${application.studentName}`,
          type: 'CBT',
          startDate: start,
          endDate: end,
          duration: Number(duration) || 60,
          totalMarks: 100,
          instructions: buildExamInstructions(`Entrance exam for ${application.referenceNo}`, 40, 1),
          published: true,
        },
      })

      const updated = await prisma.admissionApplication.update({
        where: { id: application.id },
        data: { examId: exam.id },
      })

      await transitionApplication(prisma, updated, 'exam_scheduled', {
        note: `Entrance exam scheduled: ${exam.name}`,
        changedById: req.user.userId || req.user.id,
      })

      await notifyAdmissionEmails(prisma, enqueueEmail, {
        application: updated,
        template: 'admission_exam_invite',
        extra: {
          examName: exam.name,
          examDate: start.toLocaleDateString(),
          examEnd: end.toLocaleDateString(),
        },
      })

      res.json({ application: updated, exam })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.post('/api/admissions/:id/exam-score', requireRole(...staffRoles), async (req, res) => {
    try {
      const { examScore } = req.body
      const application = await prisma.admissionApplication.findUnique({ where: { id: req.params.id } })
      if (!application) return res.status(404).json({ error: 'Not found' })
      if (!checkTenantAccess(req.user, application.schoolId, res)) return

      const updated = await prisma.admissionApplication.update({
        where: { id: application.id },
        data: { examScore: examScore != null ? Number(examScore) : null },
      })
      res.json(updated)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.post('/api/admissions/:id/interviews', requireRole(...staffRoles), async (req, res) => {
    try {
      const { scheduledAt, location, interviewer, notes } = req.body
      if (!scheduledAt) return res.status(400).json({ error: 'scheduledAt required' })

      const application = await prisma.admissionApplication.findUnique({ where: { id: req.params.id } })
      if (!application) return res.status(404).json({ error: 'Not found' })
      if (!checkTenantAccess(req.user, application.schoolId, res)) return

      const interview = await prisma.admissionInterview.create({
        data: {
          applicationId: application.id,
          scheduledAt: new Date(scheduledAt),
          location: location || null,
          interviewer: interviewer || null,
          notes: notes || null,
        },
      })

      if (application.status !== 'interviewed') {
        await transitionApplication(prisma, application, 'interviewed', {
          note: 'Interview scheduled',
          changedById: req.user.userId || req.user.id,
        })
      }

      await notifyAdmissionEmails(prisma, enqueueEmail, {
        application,
        template: 'admission_interview_invite',
        extra: {
          interviewDate: new Date(scheduledAt).toLocaleString(),
          location,
          interviewer,
        },
      })

      res.status(201).json(interview)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.put('/api/admissions/interviews/:id', requireRole(...staffRoles), async (req, res) => {
    try {
      const { outcome, notes, scheduledAt, location, interviewer } = req.body
      const interview = await prisma.admissionInterview.findUnique({
        where: { id: req.params.id },
        include: { application: true },
      })
      if (!interview) return res.status(404).json({ error: 'Not found' })
      if (!checkTenantAccess(req.user, interview.application.schoolId, res)) return

      const updated = await prisma.admissionInterview.update({
        where: { id: interview.id },
        data: {
          outcome: outcome ?? undefined,
          notes: notes ?? undefined,
          scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
          location: location ?? undefined,
          interviewer: interviewer ?? undefined,
        },
      })
      res.json(updated)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.post('/api/admissions/:id/accept', requireRole(...staffRoles), async (req, res) => {
    try {
      const application = await prisma.admissionApplication.findUnique({ where: { id: req.params.id } })
      if (!application) return res.status(404).json({ error: 'Not found' })
      if (!checkTenantAccess(req.user, application.schoolId, res)) return

      const updated = await transitionApplication(prisma, application, 'accepted', {
        note: req.body.note || 'Application accepted',
        reviewNote: req.body.reviewNote,
        changedById: req.user.userId || req.user.id,
      })

      await notifyAdmissionEmails(prisma, enqueueEmail, {
        application: updated,
        template: 'admission_accepted',
        extra: { note: req.body.note },
      })

      res.json(updated)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.post('/api/admissions/:id/reject', requireRole(...staffRoles), async (req, res) => {
    try {
      const application = await prisma.admissionApplication.findUnique({ where: { id: req.params.id } })
      if (!application) return res.status(404).json({ error: 'Not found' })
      if (!checkTenantAccess(req.user, application.schoolId, res)) return

      const updated = await transitionApplication(prisma, application, 'rejected', {
        note: req.body.note || 'Application not successful',
        reviewNote: req.body.reviewNote,
        changedById: req.user.userId || req.user.id,
      })

      await notifyAdmissionEmails(prisma, enqueueEmail, {
        application: updated,
        template: 'admission_rejected',
        extra: { note: req.body.note },
      })

      res.json(updated)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.post('/api/admissions/:id/enroll', requireRole(...staffRoles), async (req, res) => {
    try {
      const application = await prisma.admissionApplication.findUnique({ where: { id: req.params.id } })
      if (!application) return res.status(404).json({ error: 'Not found' })
      if (!checkTenantAccess(req.user, application.schoolId, res)) return

      const result = await enrollApplication(prisma, application, {
        classId: req.body.classId,
        password: req.body.password,
        changedById: req.user.userId || req.user.id,
      })

      await notifyAdmissionEmails(prisma, enqueueEmail, {
        application: result.application,
        template: 'admission_enrolled',
        extra: result.credentials,
      })

      res.json(result)
    } catch (err) {
      console.error(err)
      res.status(400).json({ error: err.message || 'Enrollment failed' })
    }
  })
}

module.exports = { registerAdmissionRoutes }
