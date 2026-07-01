/**
 * Super-admin school suspend — registered before legacy saasRoutes handler.
 */
function registerSchoolSuspendRoutes(app, { prisma, requireRole }) {
  const { suspendSchool } = require('../lib/subscriptionHelpers')

  app.post('/api/schools/:id/suspend', requireRole('SuperAdmin'), async (req, res) => {
    try {
      await suspendSchool(prisma, req.params.id, {
        reason: req.body?.reason || 'Suspended by platform admin',
        performedById: req.user.userId,
      })
      res.json({ message: 'School suspended' })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })
}

module.exports = { registerSchoolSuspendRoutes }
