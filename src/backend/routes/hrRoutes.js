const { tenantWhere } = require('../middleware/tenantGuard')
const { checkTenantAccess } = require('../lib/tenantHelpers')
const {
  JOB_STATUSES,
  generateJobReference,
  generateEmployeeNo,
  resolveSchoolForPublic,
  syncTeachersToEmployees,
  resolveEmployeeForUser,
} = require('../lib/hrHelpers')
const { dispatchNotification } = require('../lib/notificationDispatcher')

function registerHrRoutes(app, { prisma, requireRole, enqueueEmail }) {
  const hrRoles = ['SuperAdmin', 'SchoolAdmin', 'HRManager']
  const staffViewRoles = [...hrRoles, 'Teacher']

  // ===== PUBLIC CAREERS =====
  app.get('/api/public/jobs', async (req, res) => {
    try {
      const school = await resolveSchoolForPublic(prisma, req.query.schoolId ? String(req.query.schoolId) : null)
      if (!school) return res.json([])
      const jobs = await prisma.jobPosting.findMany({
        where: { schoolId: school.id, status: 'open' },
        orderBy: { createdAt: 'desc' },
      })
      res.json(jobs.map((j) => ({
        id: j.id,
        title: j.title,
        department: j.department,
        description: j.description,
        employmentType: j.employmentType,
        closesAt: j.closesAt,
        schoolName: school.name,
      })))
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.post('/api/public/jobs/:id/apply', async (req, res) => {
    try {
      const { fullName, email, phone, coverLetter, resumeUrl } = req.body
      if (!fullName || !email) return res.status(400).json({ error: 'Name and email required' })

      const posting = await prisma.jobPosting.findUnique({ where: { id: req.params.id } })
      if (!posting || posting.status !== 'open') return res.status(404).json({ error: 'Job not found or closed' })

      const application = await prisma.jobApplication.create({
        data: {
          schoolId: posting.schoolId,
          postingId: posting.id,
          referenceNo: generateJobReference(),
          fullName,
          email,
          phone: phone || null,
          coverLetter: coverLetter || null,
          resumeUrl: resumeUrl || null,
        },
      })

      const hrUser = await prisma.user.findFirst({
        where: { schoolId: posting.schoolId, role: { name: { in: ['SchoolAdmin', 'HRManager'] } }, isActive: true },
      })
      if (hrUser) {
        await prisma.notification.create({
          data: {
            userId: hrUser.id,
            type: 'recruitment',
            title: `Job application: ${fullName}`,
            body: `${posting.title} — ${email}`,
          },
        })
      }
      if (enqueueEmail) {
        await enqueueEmail({
          to: email,
          template: 'job_application_received',
          payload: { fullName, jobTitle: posting.title, referenceNo: application.referenceNo },
          schoolId: posting.schoolId,
        })
        if (hrUser) {
          await enqueueEmail({
            to: hrUser.email,
            template: 'job_application_admin',
            payload: { fullName, email, phone, jobTitle: posting.title, referenceNo: application.referenceNo },
            schoolId: posting.schoolId,
          })
        }
      }

      res.status(201).json({ referenceNo: application.referenceNo, message: 'Application submitted' })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  // ===== HR DASHBOARD =====
  app.get('/api/hr/stats', requireRole(...hrRoles), async (req, res) => {
    try {
      const scope = tenantWhere(req.user)
      const where = scope.schoolId ? { schoolId: scope.schoolId } : {}
      const [employees, openJobs, pendingApps, pendingLeave] = await Promise.all([
        prisma.employee.count({ where: { ...where, status: 'active' } }),
        prisma.jobPosting.count({ where: { ...where, status: 'open' } }),
        prisma.jobApplication.count({ where: { ...where, status: { in: ['submitted', 'screening', 'interview'] } } }),
        prisma.leaveRequest.count({ where: { employee: where.schoolId ? { schoolId: scope.schoolId } : {}, status: 'pending' } }),
      ])
      res.json({ employees, openJobs, pendingApplications: pendingApps, pendingLeave })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  // ===== JOB POSTINGS =====
  app.get('/api/hr/jobs', requireRole(...hrRoles), async (req, res) => {
    try {
      const scope = tenantWhere(req.user)
      const jobs = await prisma.jobPosting.findMany({
        where: scope.schoolId ? { schoolId: scope.schoolId } : {},
        include: { _count: { select: { applications: true } } },
        orderBy: { createdAt: 'desc' },
      })
      res.json(jobs)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.post('/api/hr/jobs', requireRole(...hrRoles), async (req, res) => {
    try {
      const { title, department, description, employmentType, closesAt } = req.body
      const schoolId = req.user.role === 'SuperAdmin' ? req.body.schoolId : req.user.schoolId
      if (!schoolId || !title) return res.status(400).json({ error: 'Title and school required' })

      const job = await prisma.jobPosting.create({
        data: {
          schoolId,
          title,
          department: department || null,
          description: description || null,
          employmentType: employmentType || 'full_time',
          closesAt: closesAt ? new Date(closesAt) : null,
        },
      })
      res.status(201).json(job)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.patch('/api/hr/jobs/:id', requireRole(...hrRoles), async (req, res) => {
    try {
      const job = await prisma.jobPosting.findUnique({ where: { id: req.params.id } })
      if (!job) return res.status(404).json({ error: 'Not found' })
      if (!checkTenantAccess(req.user, job.schoolId, res)) return

      const { title, department, description, employmentType, status, closesAt } = req.body
      const updated = await prisma.jobPosting.update({
        where: { id: job.id },
        data: {
          title: title ?? undefined,
          department: department ?? undefined,
          description: description ?? undefined,
          employmentType: employmentType ?? undefined,
          status: status ?? undefined,
          closesAt: closesAt ? new Date(closesAt) : closesAt === null ? null : undefined,
        },
      })
      res.json(updated)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  // ===== JOB APPLICATIONS =====
  app.get('/api/hr/applications', requireRole(...hrRoles), async (req, res) => {
    try {
      const { status, postingId } = req.query
      const scope = tenantWhere(req.user)
      const where = scope.schoolId ? { schoolId: scope.schoolId } : {}
      if (status) where.status = String(status)
      if (postingId) where.postingId = String(postingId)

      const apps = await prisma.jobApplication.findMany({
        where,
        include: { posting: { select: { title: true, department: true } }, interviews: true },
        orderBy: { createdAt: 'desc' },
      })
      res.json(apps)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.get('/api/hr/applications/:id', requireRole(...hrRoles), async (req, res) => {
    try {
      const app = await prisma.jobApplication.findUnique({
        where: { id: req.params.id },
        include: { posting: true, interviews: { orderBy: { scheduledAt: 'asc' } } },
      })
      if (!app) return res.status(404).json({ error: 'Not found' })
      if (!checkTenantAccess(req.user, app.schoolId, res)) return
      res.json(app)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.patch('/api/hr/applications/:id/status', requireRole(...hrRoles), async (req, res) => {
    try {
      const { status, reviewNote } = req.body
      if (!status || !JOB_STATUSES.includes(status)) return res.status(400).json({ error: 'Invalid status' })

      const application = await prisma.jobApplication.findUnique({
        where: { id: req.params.id },
        include: { posting: true },
      })
      if (!application) return res.status(404).json({ error: 'Not found' })
      if (!checkTenantAccess(req.user, application.schoolId, res)) return

      const updated = await prisma.jobApplication.update({
        where: { id: application.id },
        data: { status, reviewNote: reviewNote ?? undefined },
      })

      if (enqueueEmail) {
        const template =
          status === 'offered' ? 'job_offer' : status === 'rejected' ? 'job_rejected' : status === 'interview' ? 'job_interview_invite' : null
        if (template) {
          await enqueueEmail({
            to: application.email,
            template,
            payload: {
              fullName: application.fullName,
              jobTitle: application.posting.title,
              referenceNo: application.referenceNo,
              note: reviewNote,
            },
            schoolId: application.schoolId,
          })
        }
      }

      res.json(updated)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.post('/api/hr/applications/:id/interviews', requireRole(...hrRoles), async (req, res) => {
    try {
      const { scheduledAt, location, interviewer, notes } = req.body
      if (!scheduledAt) return res.status(400).json({ error: 'scheduledAt required' })

      const application = await prisma.jobApplication.findUnique({
        where: { id: req.params.id },
        include: { posting: true },
      })
      if (!application) return res.status(404).json({ error: 'Not found' })
      if (!checkTenantAccess(req.user, application.schoolId, res)) return

      const interview = await prisma.recruitmentInterview.create({
        data: {
          applicationId: application.id,
          scheduledAt: new Date(scheduledAt),
          location: location || null,
          interviewer: interviewer || null,
          notes: notes || null,
        },
      })

      await prisma.jobApplication.update({
        where: { id: application.id },
        data: { status: 'interview' },
      })

      if (enqueueEmail) {
        await enqueueEmail({
          to: application.email,
          template: 'job_interview_invite',
          payload: {
            fullName: application.fullName,
            jobTitle: application.posting.title,
            interviewDate: new Date(scheduledAt).toLocaleString(),
            location,
            interviewer,
          },
          schoolId: application.schoolId,
        })
      }

      res.status(201).json(interview)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  // ===== EMPLOYEES =====
  app.get('/api/hr/employees', requireRole(...hrRoles), async (req, res) => {
    try {
      const scope = tenantWhere(req.user)
      const employees = await prisma.employee.findMany({
        where: scope.schoolId ? { schoolId: scope.schoolId } : {},
        include: {
          _count: { select: { contracts: true, leaveRequests: true, performanceReviews: true } },
        },
        orderBy: { lastName: 'asc' },
      })
      res.json(employees)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.get('/api/hr/employees/:id', requireRole(...hrRoles), async (req, res) => {
    try {
      const employee = await prisma.employee.findUnique({
        where: { id: req.params.id },
        include: {
          contracts: { orderBy: { startDate: 'desc' } },
          leaveRequests: { orderBy: { createdAt: 'desc' } },
          performanceReviews: { orderBy: { createdAt: 'desc' } },
          user: { select: { email: true, firstName: true, lastName: true } },
        },
      })
      if (!employee) return res.status(404).json({ error: 'Not found' })
      if (!checkTenantAccess(req.user, employee.schoolId, res)) return
      res.json(employee)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.post('/api/hr/employees', requireRole(...hrRoles), async (req, res) => {
    try {
      const { firstName, lastName, email, phone, department, jobTitle, employeeType, hireDate } = req.body
      const schoolId = req.user.role === 'SuperAdmin' ? req.body.schoolId : req.user.schoolId
      if (!schoolId || !firstName || !lastName || !email || !jobTitle) {
        return res.status(400).json({ error: 'Missing required fields' })
      }

      const employee = await prisma.employee.create({
        data: {
          schoolId,
          employeeNo: generateEmployeeNo(schoolId),
          firstName,
          lastName,
          email,
          phone: phone || null,
          department: department || null,
          jobTitle,
          employeeType: employeeType || 'staff',
          hireDate: hireDate ? new Date(hireDate) : new Date(),
        },
      })
      res.status(201).json(employee)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.post('/api/hr/employees/sync-staff', requireRole(...hrRoles), async (req, res) => {
    try {
      const schoolId = req.user.role === 'SuperAdmin' ? req.body.schoolId : req.user.schoolId
      if (!schoolId) return res.status(400).json({ error: 'School required' })
      const created = await syncTeachersToEmployees(prisma, schoolId)
      res.json({ created })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.post('/api/hr/employees/:id/contracts', requireRole(...hrRoles), async (req, res) => {
    try {
      const { title, startDate, endDate, salary, currency, terms } = req.body
      const employee = await prisma.employee.findUnique({ where: { id: req.params.id } })
      if (!employee) return res.status(404).json({ error: 'Employee not found' })
      if (!checkTenantAccess(req.user, employee.schoolId, res)) return

      const contract = await prisma.employeeContract.create({
        data: {
          employeeId: employee.id,
          title: title || `${employee.jobTitle} Contract`,
          startDate: new Date(startDate || Date.now()),
          endDate: endDate ? new Date(endDate) : null,
          salary: salary != null ? Number(salary) : null,
          currency: currency || 'NGN',
          terms: terms || null,
        },
      })
      res.status(201).json(contract)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.post('/api/hr/employees/:id/reviews', requireRole(...hrRoles), async (req, res) => {
    try {
      const { periodLabel, rating, strengths, improvements, goals, status } = req.body
      const employee = await prisma.employee.findUnique({ where: { id: req.params.id } })
      if (!employee) return res.status(404).json({ error: 'Employee not found' })
      if (!checkTenantAccess(req.user, employee.schoolId, res)) return

      const review = await prisma.performanceReview.create({
        data: {
          employeeId: employee.id,
          periodLabel: periodLabel || `Review ${new Date().getFullYear()}`,
          reviewerId: req.user.userId || req.user.id,
          rating: rating != null ? Number(rating) : null,
          strengths: strengths || null,
          improvements: improvements || null,
          goals: goals || null,
          status: status || 'draft',
        },
      })
      res.status(201).json(review)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  // ===== LEAVE =====
  app.get('/api/hr/leave', requireRole(...hrRoles), async (req, res) => {
    try {
      const { status } = req.query
      const scope = tenantWhere(req.user)
      const where = {}
      if (status) where.status = String(status)
      if (scope.schoolId) where.employee = { schoolId: scope.schoolId }

      const requests = await prisma.leaveRequest.findMany({
        where,
        include: { employee: { select: { firstName: true, lastName: true, jobTitle: true, department: true } } },
        orderBy: { createdAt: 'desc' },
      })
      res.json(requests)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.get('/api/hr/leave/mine', requireRole('Teacher', 'HRManager', 'SchoolAdmin', 'Accountant', 'Librarian', 'HostelManager', 'TransportManager'), async (req, res) => {
    try {
      const employee = await resolveEmployeeForUser(prisma, req.user)
      if (!employee) return res.json([])
      const requests = await prisma.leaveRequest.findMany({
        where: { employeeId: employee.id },
        orderBy: { createdAt: 'desc' },
      })
      res.json(requests)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.post('/api/hr/leave', requireRole('Teacher', 'HRManager', 'SchoolAdmin', 'Accountant', 'Librarian', 'HostelManager', 'TransportManager'), async (req, res) => {
    try {
      const { leaveType, startDate, endDate, reason, employeeId } = req.body
      if (!leaveType || !startDate || !endDate) return res.status(400).json({ error: 'Missing fields' })

      let employee = null
      if (employeeId && hrRoles.includes(req.user.role)) {
        employee = await prisma.employee.findUnique({ where: { id: employeeId } })
      } else {
        employee = await resolveEmployeeForUser(prisma, req.user)
      }
      if (!employee) return res.status(404).json({ error: 'Employee profile not found' })
      if (!checkTenantAccess(req.user, employee.schoolId, res)) return

      const request = await prisma.leaveRequest.create({
        data: {
          employeeId: employee.id,
          leaveType,
          startDate: new Date(startDate),
          endDate: new Date(endDate),
          reason: reason || null,
        },
      })
      res.status(201).json(request)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.post('/api/hr/leave/:id/review', requireRole(...hrRoles), async (req, res) => {
    try {
      const { status, reviewNote } = req.body
      if (!['approved', 'rejected'].includes(status)) return res.status(400).json({ error: 'Invalid status' })

      const leave = await prisma.leaveRequest.findUnique({
        where: { id: req.params.id },
        include: { employee: true },
      })
      if (!leave) return res.status(404).json({ error: 'Not found' })
      if (!checkTenantAccess(req.user, leave.employee.schoolId, res)) return

      const updated = await prisma.leaveRequest.update({
        where: { id: leave.id },
        data: {
          status,
          reviewNote: reviewNote || null,
          reviewedById: req.user.userId || req.user.id,
          reviewedAt: new Date(),
        },
      })

      if (enqueueEmail && leave.employee.email) {
        await enqueueEmail({
          to: leave.employee.email,
          template: status === 'approved' ? 'leave_approved' : 'leave_rejected',
          payload: {
            firstName: leave.employee.firstName,
            leaveType: leave.leaveType,
            startDate: new Date(leave.startDate).toLocaleDateString(),
            endDate: new Date(leave.endDate).toLocaleDateString(),
            note: reviewNote,
          },
          schoolId: leave.employee.schoolId,
        })
      }

      if (leave.employee.userId) {
        await dispatchNotification(prisma, {
          userId: leave.employee.userId,
          schoolId: leave.employee.schoolId,
          type: 'leave',
          title: `Leave request ${status}`,
          body: `Your ${leave.leaveType} leave (${new Date(leave.startDate).toLocaleDateString()} – ${new Date(leave.endDate).toLocaleDateString()}) was ${status}.`,
          payload: {
            leaveType: leave.leaveType,
            status,
            startDate: leave.startDate,
            endDate: leave.endDate,
            reviewNote,
          },
          emailPayload: {
            firstName: leave.employee.firstName,
            leaveType: leave.leaveType,
            status,
            startDate: new Date(leave.startDate).toLocaleDateString(),
            endDate: new Date(leave.endDate).toLocaleDateString(),
          },
        })
      }

      if (status === 'approved') {
        await prisma.employee.update({
          where: { id: leave.employeeId },
          data: { status: 'on_leave' },
        })
      }

      res.json(updated)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })
}

module.exports = { registerHrRoutes }
