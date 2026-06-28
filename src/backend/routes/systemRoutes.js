const { buildSystemStatus } = require('../lib/systemStatus')

function registerSystemRoutes(app, { prisma, requireRole }) {
  app.get('/api/system/status', requireRole('SuperAdmin', 'SchoolAdmin'), async (req, res) => {
    try {
      const schoolId =
        req.user.role === 'SuperAdmin' && req.query.schoolId
          ? String(req.query.schoolId)
          : req.user.schoolId || null

      const status = await buildSystemStatus(prisma, schoolId)
      res.json(status)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })
}

module.exports = { registerSystemRoutes }
