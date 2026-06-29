const crypto = require('crypto')

function schoolIdFromReq(req) {
  if (req.user?.role === 'SuperAdmin' && req.query.schoolId) return req.query.schoolId
  return req.user?.schoolId
}

function slugify(text) {
  return String(text).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80) || `form-${Date.now()}`
}

function registerEnterpriseRoutes(app, { prisma, requireRole, dispatchNotification }) {
  const admin = requireRole('SuperAdmin', 'SchoolAdmin')
  const staff = requireRole('SuperAdmin', 'SchoolAdmin', 'Teacher', 'Accountant', 'HRManager')
  const parent = requireRole('Parent', 'SuperAdmin', 'SchoolAdmin')

  // ===== CUSTOM FORMS =====
  app.get('/api/forms', staff, async (req, res) => {
    try {
      const schoolId = schoolIdFromReq(req)
      const forms = await prisma.customForm.findMany({ where: { schoolId }, orderBy: { updatedAt: 'desc' }, include: { _count: { select: { submissions: true } } } })
      res.json({ forms })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.post('/api/forms', admin, async (req, res) => {
    try {
      const schoolId = schoolIdFromReq(req)
      const { title, description, category, fields, isPublished } = req.body || {}
      if (!schoolId || !title || !fields) return res.status(400).json({ error: 'title and fields required' })
      const form = await prisma.customForm.create({
        data: {
          schoolId,
          title: String(title),
          slug: slugify(title),
          description: description || null,
          category: category || 'general',
          fields,
          isPublished: Boolean(isPublished),
          createdById: req.user.userId,
        },
      })
      res.status(201).json({ form })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.patch('/api/forms/:id', admin, async (req, res) => {
    try {
      const schoolId = schoolIdFromReq(req)
      const existing = await prisma.customForm.findFirst({ where: { id: req.params.id, schoolId } })
      if (!existing) return res.status(404).json({ error: 'Form not found' })
      const { title, description, category, fields, isPublished } = req.body || {}
      const form = await prisma.customForm.update({
        where: { id: existing.id },
        data: {
          ...(title != null ? { title: String(title) } : {}),
          ...(description !== undefined ? { description } : {}),
          ...(category != null ? { category } : {}),
          ...(fields != null ? { fields } : {}),
          ...(isPublished != null ? { isPublished: Boolean(isPublished) } : {}),
        },
      })
      res.json({ form })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.get('/api/forms/:slug/public', async (req, res) => {
    try {
      const form = await prisma.customForm.findFirst({
        where: { slug: req.params.slug, isPublished: true },
      })
      if (!form) return res.status(404).json({ error: 'Form not found' })
      res.json({ form: { id: form.id, title: form.title, description: form.description, fields: form.fields } })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.post('/api/forms/:id/submit', async (req, res) => {
    try {
      const { data, submitterEmail, submitterName } = req.body || {}
      const form = await prisma.customForm.findUnique({ where: { id: req.params.id } })
      if (!form || !form.isPublished) return res.status(404).json({ error: 'Form not found' })
      const submission = await prisma.formSubmission.create({
        data: { formId: form.id, data: data || {}, submitterEmail, submitterName },
      })
      res.status(201).json({ submission })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.get('/api/forms/:id/submissions', staff, async (req, res) => {
    try {
      const schoolId = schoolIdFromReq(req)
      const form = await prisma.customForm.findFirst({ where: { id: req.params.id, schoolId } })
      if (!form) return res.status(404).json({ error: 'Form not found' })
      const submissions = await prisma.formSubmission.findMany({ where: { formId: form.id }, orderBy: { createdAt: 'desc' } })
      res.json({ submissions })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  // ===== VISITORS =====
  app.get('/api/visitors', staff, async (req, res) => {
    try {
      const schoolId = schoolIdFromReq(req)
      const visitors = await prisma.visitorLog.findMany({ where: { schoolId }, orderBy: { checkInAt: 'desc' }, take: 100 })
      res.json({ visitors })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.post('/api/visitors/check-in', staff, async (req, res) => {
    try {
      const schoolId = schoolIdFromReq(req)
      const { fullName, phone, purpose, hostName } = req.body || {}
      if (!schoolId || !fullName || !purpose) return res.status(400).json({ error: 'fullName and purpose required' })
      const passCode = `V-${crypto.randomBytes(3).toString('hex').toUpperCase()}`
      const visitor = await prisma.visitorLog.create({
        data: { schoolId, fullName, phone, purpose, hostName, passCode, registeredById: req.user.userId },
      })
      res.status(201).json({ visitor })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.post('/api/visitors/:id/check-out', staff, async (req, res) => {
    try {
      const schoolId = schoolIdFromReq(req)
      const visitor = await prisma.visitorLog.findFirst({ where: { id: req.params.id, schoolId } })
      if (!visitor) return res.status(404).json({ error: 'Visitor not found' })
      const updated = await prisma.visitorLog.update({
        where: { id: visitor.id },
        data: { status: 'checked_out', checkOutAt: new Date() },
      })
      res.json({ visitor: updated })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  // ===== MAINTENANCE =====
  app.get('/api/maintenance', staff, async (req, res) => {
    try {
      const schoolId = schoolIdFromReq(req)
      const tickets = await prisma.maintenanceTicket.findMany({ where: { schoolId }, orderBy: { createdAt: 'desc' } })
      res.json({ tickets })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.post('/api/maintenance', staff, async (req, res) => {
    try {
      const schoolId = schoolIdFromReq(req)
      const { title, description, category, priority, location } = req.body || {}
      if (!schoolId || !title || !description) return res.status(400).json({ error: 'title and description required' })
      const ticket = await prisma.maintenanceTicket.create({
        data: { schoolId, title, description, category: category || 'general', priority: priority || 'medium', location, reportedById: req.user.userId },
      })
      res.status(201).json({ ticket })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.patch('/api/maintenance/:id', admin, async (req, res) => {
    try {
      const schoolId = schoolIdFromReq(req)
      const ticket = await prisma.maintenanceTicket.findFirst({ where: { id: req.params.id, schoolId } })
      if (!ticket) return res.status(404).json({ error: 'Ticket not found' })
      const { status, priority, assignedToId } = req.body || {}
      const updated = await prisma.maintenanceTicket.update({
        where: { id: ticket.id },
        data: {
          ...(status != null ? { status, resolvedAt: status === 'resolved' ? new Date() : ticket.resolvedAt } : {}),
          ...(priority != null ? { priority } : {}),
          ...(assignedToId !== undefined ? { assignedToId } : {}),
        },
      })
      res.json({ ticket: updated })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  // ===== CONSENT =====
  app.get('/api/consent/forms', staff, async (req, res) => {
    try {
      const schoolId = schoolIdFromReq(req)
      const forms = await prisma.consentForm.findMany({
        where: { schoolId },
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { responses: true } } },
      })
      res.json({ forms })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.post('/api/consent/forms', staff, async (req, res) => {
    try {
      const schoolId = schoolIdFromReq(req)
      const { title, description, body, classId, expiresAt } = req.body || {}
      if (!schoolId || !title || !body) return res.status(400).json({ error: 'title and body required' })
      const form = await prisma.consentForm.create({
        data: {
          schoolId,
          title,
          description,
          body,
          classId: classId || null,
          expiresAt: expiresAt ? new Date(expiresAt) : null,
          createdById: req.user.userId,
        },
      })
      res.json({ form })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.get('/api/consent/pending', parent, async (req, res) => {
    try {
      const schoolId = schoolIdFromReq(req)
      const parentRec = await prisma.parent.findUnique({
        where: { userId: req.user.userId },
        include: { children: { include: { user: { select: { firstName: true, lastName: true } } } } },
      })
      if (!parentRec) return res.json({ forms: [] })
      const studentIds = parentRec.children.map((s) => s.id)
      const forms = await prisma.consentForm.findMany({
        where: { schoolId, isActive: true, OR: [{ expiresAt: null }, { expiresAt: { gte: new Date() } }] },
        include: {
          responses: { where: { studentId: { in: studentIds } } },
        },
      })
      res.json({
        forms: forms.map((f) => ({
          ...f,
          pendingStudents: parentRec.children.filter((s) => !f.responses.some((r) => r.studentId === s.id && r.status === 'approved')),
        })),
      })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.post('/api/consent/forms/:id/respond', parent, async (req, res) => {
    try {
      const { studentId, status, signatureName, note } = req.body || {}
      if (!studentId || !status) return res.status(400).json({ error: 'studentId and status required' })
      const form = await prisma.consentForm.findUnique({ where: { id: req.params.id } })
      if (!form) return res.status(404).json({ error: 'Form not found' })

      const parentRec = await prisma.parent.findUnique({ where: { userId: req.user.userId } })
      const student = await prisma.student.findUnique({ where: { id: studentId } })
      if (!parentRec || !student || student.parentId !== parentRec.id) return res.status(403).json({ error: 'Forbidden' })

      const existing = await prisma.consentResponse.findFirst({
        where: { formId: form.id, studentId },
      })
      const response = existing
        ? await prisma.consentResponse.update({
            where: { id: existing.id },
            data: { status, signatureName, signedAt: status === 'approved' ? new Date() : null, note },
          })
        : await prisma.consentResponse.create({
            data: {
              formId: form.id,
              parentId: parentRec.id,
              studentId,
              status,
              signatureName,
              signedAt: status === 'approved' ? new Date() : null,
              note,
            },
          })

      if (dispatchNotification && form.createdById) {
        await dispatchNotification(prisma, {
          userId: form.createdById,
          schoolId: form.schoolId,
          type: 'consent',
          title: `Consent ${status}`,
          body: `${signatureName || 'Parent'} ${status} consent: ${form.title}`,
          channels: ['in_app'],
        }).catch(() => {})
      }

      res.json({ response })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.post('/api/integrations/google/sync', admin, async (req, res) => {
    try {
      const schoolId = schoolIdFromReq(req)
      const { syncSchoolGoogleCalendar } = require('../lib/googleCalendarSync')
      const result = await syncSchoolGoogleCalendar(prisma, schoolId)
      res.json(result)
    } catch (err) {
      res.status(400).json({ error: err.message })
    }
  })
}

module.exports = { registerEnterpriseRoutes }
