const { buildSchoolCalendar, parseRange } = require('../lib/calendarHelpers')

function schoolIdFromReq(req) {
  if (req.user?.role === 'SuperAdmin' && req.query.schoolId) return req.query.schoolId
  return req.user?.schoolId
}

function registerCalendarRoutes(app, { prisma, requireRole }) {
  const staff = requireRole('SuperAdmin', 'SchoolAdmin', 'Teacher', 'Student', 'Parent', 'Accountant')
  const admin = requireRole('SuperAdmin', 'SchoolAdmin')

  app.get('/api/calendar', staff, async (req, res) => {
    try {
      const schoolId = schoolIdFromReq(req)
      if (!schoolId) return res.status(400).json({ error: 'School context required' })
      const range = parseRange(req.query)
      const categories = req.query.categories ? String(req.query.categories).split(',') : null
      res.json(await buildSchoolCalendar(prisma, schoolId, { ...range, categories }))
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.get('/api/calendar/export.ics', staff, async (req, res) => {
    try {
      const schoolId = schoolIdFromReq(req)
      if (!schoolId) return res.status(400).json({ error: 'School context required' })
      const range = parseRange(req.query)
      const { events } = await buildSchoolCalendar(prisma, schoolId, range)
      const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//SchoolPilot//Calendar//EN']
      for (const e of events) {
        const start = new Date(e.startAt).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
        const end = new Date(e.endAt || e.startAt).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
        lines.push('BEGIN:VEVENT', `UID:${e.id}@schoolpilot`, `DTSTART:${start}`, `DTEND:${end}`, `SUMMARY:${e.title.replace(/,/g, '\\,')}`, 'END:VEVENT')
      }
      lines.push('END:VCALENDAR')
      res.setHeader('Content-Type', 'text/calendar; charset=utf-8')
      res.setHeader('Content-Disposition', 'attachment; filename="school-calendar.ics"')
      res.send(lines.join('\r\n'))
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.get('/api/calendar/events', admin, async (req, res) => {
    try {
      const schoolId = schoolIdFromReq(req)
      if (!schoolId) return res.status(400).json({ error: 'School context required' })
      const events = await prisma.calendarEvent.findMany({
        where: { schoolId },
        orderBy: { startAt: 'asc' },
      })
      res.json({ events })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.post('/api/calendar/events', admin, async (req, res) => {
    try {
      const schoolId = schoolIdFromReq(req)
      const { title, description, startAt, endAt, allDay, category, color, location } = req.body || {}
      if (!schoolId || !title || !startAt) return res.status(400).json({ error: 'title and startAt required' })
      const event = await prisma.calendarEvent.create({
        data: {
          schoolId,
          title: String(title),
          description: description || null,
          startAt: new Date(startAt),
          endAt: endAt ? new Date(endAt) : null,
          allDay: !!allDay,
          category: category || 'custom',
          color: color || '#f59e0b',
          location: location || null,
          createdById: req.user.userId,
        },
      })
      res.status(201).json({ event })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.patch('/api/calendar/events/:id', admin, async (req, res) => {
    try {
      const schoolId = schoolIdFromReq(req)
      const existing = await prisma.calendarEvent.findFirst({ where: { id: req.params.id, schoolId } })
      if (!existing) return res.status(404).json({ error: 'Event not found' })
      const { title, description, startAt, endAt, allDay, category, color, location } = req.body || {}
      const event = await prisma.calendarEvent.update({
        where: { id: existing.id },
        data: {
          ...(title != null ? { title: String(title) } : {}),
          ...(description !== undefined ? { description } : {}),
          ...(startAt != null ? { startAt: new Date(startAt) } : {}),
          ...(endAt !== undefined ? { endAt: endAt ? new Date(endAt) : null } : {}),
          ...(allDay != null ? { allDay: !!allDay } : {}),
          ...(category != null ? { category } : {}),
          ...(color != null ? { color } : {}),
          ...(location !== undefined ? { location } : {}),
        },
      })
      res.json({ event })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.delete('/api/calendar/events/:id', admin, async (req, res) => {
    try {
      const schoolId = schoolIdFromReq(req)
      const existing = await prisma.calendarEvent.findFirst({ where: { id: req.params.id, schoolId } })
      if (!existing) return res.status(404).json({ error: 'Event not found' })
      await prisma.calendarEvent.delete({ where: { id: existing.id } })
      res.json({ message: 'Deleted' })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })
}

module.exports = { registerCalendarRoutes }
