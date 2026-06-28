const { clearTransporterCache, resolveSmtpConfig, sendMail } = require('../lib/email')
const { processEmailQueue, queueFeeReminders } = require('../lib/emailQueue')
const { renderEmailTemplate, schoolBrandFromRecord } = require('../lib/emailTemplates')

function getSmtpFromSettings(settings) {
  const smtp = settings?.smtp || {}
  return {
    enabled: Boolean(smtp.enabled),
    host: smtp.host || '',
    port: Number(smtp.port || 587),
    secure: Boolean(smtp.secure),
    user: smtp.user || '',
    from: smtp.from || smtp.user || '',
    hasPassword: Boolean(smtp.pass),
  }
}

function registerEmailRoutes(app, { prisma, requireRole, requirePermission }) {
  app.get('/api/schools/:id/email-settings', requireRole('SuperAdmin', 'SchoolAdmin'), async (req, res) => {
    try {
      if (req.user.role === 'SchoolAdmin' && req.user.schoolId !== req.params.id) {
        return res.status(403).json({ error: 'Forbidden' })
      }
      const school = await prisma.school.findUnique({ where: { id: req.params.id } })
      if (!school) return res.status(404).json({ error: 'School not found' })
      res.json({
        schoolId: school.id,
        schoolName: school.name,
        smtp: getSmtpFromSettings(school.settings),
        globalSmtpConfigured: Boolean(process.env.SMTP_HOST && process.env.SMTP_USER),
      })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.put('/api/schools/:id/email-settings', requireRole('SuperAdmin', 'SchoolAdmin'), async (req, res) => {
    try {
      if (req.user.role === 'SchoolAdmin' && req.user.schoolId !== req.params.id) {
        return res.status(403).json({ error: 'Forbidden' })
      }
      const school = await prisma.school.findUnique({ where: { id: req.params.id } })
      if (!school) return res.status(404).json({ error: 'School not found' })

      const { enabled, host, port, secure, user, pass, from } = req.body
      const current = (school.settings && typeof school.settings === 'object') ? school.settings : {}
      const currentSmtp = current.smtp || {}

      const nextSmtp = {
        enabled: Boolean(enabled),
        host: host || '',
        port: Number(port || 587),
        secure: Boolean(secure),
        user: user || '',
        from: from || user || '',
        pass: pass ? pass : (currentSmtp.pass || ''),
      }

      const updated = await prisma.school.update({
        where: { id: school.id },
        data: {
          settings: { ...current, smtp: nextSmtp },
        },
      })

      clearTransporterCache()
      res.json({ smtp: getSmtpFromSettings(updated.settings) })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.post('/api/schools/:id/email-settings/test', requireRole('SuperAdmin', 'SchoolAdmin'), async (req, res) => {
    try {
      if (req.user.role === 'SchoolAdmin' && req.user.schoolId !== req.params.id) {
        return res.status(403).json({ error: 'Forbidden' })
      }
      const school = await prisma.school.findUnique({ where: { id: req.params.id } })
      if (!school) return res.status(404).json({ error: 'School not found' })

      const user = await prisma.user.findUnique({ where: { id: req.user.userId } })
      const brand = schoolBrandFromRecord(school)
      const rendered = renderEmailTemplate('login_alert', {
        firstName: user?.firstName || 'Admin',
        device: 'Test email',
        time: new Date().toLocaleString(),
      }, brand)

      await sendMail({
        to: user?.email || req.body.to,
        subject: `[Test] ${rendered.subject}`,
        text: rendered.text,
        html: rendered.html,
        schoolId: school.id,
      })

      res.json({ message: 'Test email sent' })
    } catch (err) {
      console.error(err)
      res.status(400).json({ error: err.message || 'Failed to send test email' })
    }
  })

  app.get('/api/email/queue', requireRole('SuperAdmin', 'SchoolAdmin'), requirePermission('reports.view'), async (req, res) => {
    try {
      const { status, limit = '50' } = req.query
      const where = {}
      if (status) where.status = String(status)
      if (req.user.role === 'SchoolAdmin' && req.user.schoolId) {
        where.schoolId = req.user.schoolId
      }

      const [items, stats] = await Promise.all([
        prisma.emailQueue.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take: Math.min(Number(limit) || 50, 200),
        }),
        prisma.emailQueue.groupBy({
          by: ['status'],
          where: req.user.role === 'SchoolAdmin' && req.user.schoolId ? { schoolId: req.user.schoolId } : {},
          _count: { id: true },
        }),
      ])

      res.json({
        items,
        stats: stats.reduce((acc, s) => ({ ...acc, [s.status]: s._count.id }), {}),
      })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.post('/api/email/process', requireRole('SuperAdmin'), async (_req, res) => {
    try {
      const result = await processEmailQueue()
      res.json(result)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.post('/api/email/fee-reminders', requireRole('SuperAdmin', 'SchoolAdmin'), requirePermission('fees.manage'), async (req, res) => {
    try {
      const schoolId = req.user.role === 'SchoolAdmin' ? req.user.schoolId : req.body.schoolId
      if (!schoolId) return res.status(400).json({ error: 'schoolId required' })
      const result = await queueFeeReminders(prisma, schoolId)
      res.json({ message: `Queued ${result.queued} fee reminder emails`, ...result })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })
}

module.exports = { registerEmailRoutes }
