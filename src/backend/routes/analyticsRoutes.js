const {
  resolveSchoolId,
  proprietorAnalytics,
  principalAnalytics,
  teacherAnalytics,
} = require('../lib/analyticsHelpers')

function registerAnalyticsRoutes(app, { prisma, requireRole }) {
  // Legacy endpoint — principal academic summary
  app.get('/api/analytics/dashboard', requireRole('SuperAdmin', 'SchoolAdmin'), async (req, res) => {
    try {
      const schoolId = resolveSchoolId(req)
      const data = await principalAnalytics(prisma, schoolId)
      res.json({
        totalStudents: data.kpis.totalStudents,
        totalTeachers: data.kpis.totalTeachers,
        totalClasses: data.kpis.totalClasses,
        averageAttendance: data.kpis.averageAttendance,
        averageScore: data.kpis.averageScore,
        studentsByClass: data.studentsByClass,
        resultsByGrade: data.resultsByGrade,
        subjectPerformance: data.subjectPerformance,
        attendanceByMonth: data.attendanceTrend.map((m) => ({ month: m.month, percentage: m.value })),
      })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.get('/api/analytics/proprietor', requireRole('SuperAdmin', 'SchoolAdmin'), async (req, res) => {
    try {
      const schoolId = resolveSchoolId(req)
      res.json(await proprietorAnalytics(prisma, schoolId))
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.get('/api/analytics/principal', requireRole('SuperAdmin', 'SchoolAdmin'), async (req, res) => {
    try {
      const schoolId = resolveSchoolId(req)
      if (!schoolId) return res.status(400).json({ error: 'School required' })
      res.json(await principalAnalytics(prisma, schoolId))
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.get('/api/analytics/teacher', requireRole('Teacher', 'SchoolAdmin', 'SuperAdmin'), async (req, res) => {
    try {
      const userId = req.user.userId || req.user.id
      if (req.user.role === 'SchoolAdmin' || req.user.role === 'SuperAdmin') {
        const teacherUserId = req.query.teacherUserId
        if (teacherUserId) {
          return res.json(await teacherAnalytics(prisma, String(teacherUserId)))
        }
        return res.status(400).json({ error: 'teacherUserId required for admin view' })
      }
      res.json(await teacherAnalytics(prisma, userId))
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.get('/api/analytics/forecast', requireRole('SuperAdmin', 'SchoolAdmin'), async (req, res) => {
    try {
      const schoolId = resolveSchoolId(req)
      const [proprietor, principal] = await Promise.all([
        proprietorAnalytics(prisma, schoolId),
        principalAnalytics(prisma, schoolId),
      ])
      res.json({
        revenue: proprietor.forecasts.revenue,
        enrollment: proprietor.forecasts.enrollment,
        attendance: principal.forecasts.attendance,
        performance: principal.forecasts.performance,
      })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })
}

module.exports = { registerAnalyticsRoutes }
