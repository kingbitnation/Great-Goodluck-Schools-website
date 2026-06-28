const { tenantWhere } = require('../middleware/tenantGuard')
const { checkTenantAccess } = require('../lib/tenantHelpers')
const { resolveEmployeeForUser } = require('../lib/hrHelpers')
const {
  periodLabel,
  getOrCreatePayrollSettings,
  computePayslip,
  roundMoney,
} = require('../lib/payrollHelpers')
const { streamPayslipPdf } = require('../lib/payslipPdf')
const { dispatchNotification } = require('../lib/notificationDispatcher')

function registerPayrollRoutes(app, { prisma, requireRole, enqueueEmail }) {
  const payrollRoles = ['SuperAdmin', 'SchoolAdmin', 'HRManager', 'Accountant']

  async function schoolIdFor(req) {
    if (req.user.role === 'SuperAdmin' && req.query.schoolId) return String(req.query.schoolId)
    return req.user.schoolId
  }

  // ===== SETTINGS =====
  app.get('/api/payroll/settings', requireRole(...payrollRoles), async (req, res) => {
    try {
      const schoolId = await schoolIdFor(req)
      if (!schoolId) return res.status(400).json({ error: 'School required' })
      const settings = await getOrCreatePayrollSettings(prisma, schoolId)
      res.json(settings)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.put('/api/payroll/settings', requireRole(...payrollRoles), async (req, res) => {
    try {
      const schoolId = await schoolIdFor(req)
      if (!schoolId) return res.status(400).json({ error: 'School required' })
      const {
        currency, payeTaxRate, pensionEmployeeRate, pensionEmployerRate, nhfRate, taxFreeAllowance,
      } = req.body
      await getOrCreatePayrollSettings(prisma, schoolId)
      const settings = await prisma.payrollSetting.update({
        where: { schoolId },
        data: {
          currency: currency || undefined,
          payeTaxRate: payeTaxRate != null ? Number(payeTaxRate) : undefined,
          pensionEmployeeRate: pensionEmployeeRate != null ? Number(pensionEmployeeRate) : undefined,
          pensionEmployerRate: pensionEmployerRate != null ? Number(pensionEmployerRate) : undefined,
          nhfRate: nhfRate != null ? Number(nhfRate) : undefined,
          taxFreeAllowance: taxFreeAllowance != null ? Number(taxFreeAllowance) : undefined,
        },
      })
      res.json(settings)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  // ===== SALARY GRADES =====
  app.get('/api/payroll/grades', requireRole(...payrollRoles), async (req, res) => {
    try {
      const schoolId = await schoolIdFor(req)
      const grades = await prisma.salaryGrade.findMany({
        where: { schoolId, ...tenantWhere(req) },
        orderBy: { name: 'asc' },
      })
      res.json(grades)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.post('/api/payroll/grades', requireRole(...payrollRoles), async (req, res) => {
    try {
      const schoolId = await schoolIdFor(req)
      const { name, baseSalary, allowances, isActive } = req.body
      if (!name || baseSalary == null) return res.status(400).json({ error: 'Name and base salary required' })
      const grade = await prisma.salaryGrade.create({
        data: {
          schoolId,
          name,
          baseSalary: Number(baseSalary),
          allowances: allowances || [],
          isActive: isActive !== false,
        },
      })
      res.status(201).json(grade)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.put('/api/payroll/grades/:id', requireRole(...payrollRoles), async (req, res) => {
    try {
      const grade = await prisma.salaryGrade.findUnique({ where: { id: req.params.id } })
      if (!grade || !checkTenantAccess(req, grade.schoolId)) return res.status(404).json({ error: 'Not found' })
      const { name, baseSalary, allowances, isActive } = req.body
      const updated = await prisma.salaryGrade.update({
        where: { id: grade.id },
        data: {
          name: name || undefined,
          baseSalary: baseSalary != null ? Number(baseSalary) : undefined,
          allowances: allowances !== undefined ? allowances : undefined,
          isActive: isActive !== undefined ? Boolean(isActive) : undefined,
        },
      })
      res.json(updated)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  // ===== EMPLOYEE PAYROLL PROFILES =====
  app.get('/api/payroll/profiles', requireRole(...payrollRoles), async (req, res) => {
    try {
      const schoolId = await schoolIdFor(req)
      const employees = await prisma.employee.findMany({
        where: { schoolId, status: 'active', ...tenantWhere(req) },
        include: { payrollProfile: { include: { grade: true } } },
        orderBy: { lastName: 'asc' },
      })
      res.json(employees.map((e) => ({
        id: e.id,
        employeeNo: e.employeeNo,
        name: `${e.firstName} ${e.lastName}`,
        department: e.department,
        jobTitle: e.jobTitle,
        profile: e.payrollProfile,
      })))
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.put('/api/payroll/profiles/:employeeId', requireRole(...payrollRoles), async (req, res) => {
    try {
      const employee = await prisma.employee.findUnique({
        where: { id: req.params.employeeId },
        include: { payrollProfile: true },
      })
      if (!employee || !checkTenantAccess(req, employee.schoolId)) return res.status(404).json({ error: 'Not found' })

      const { gradeId, baseSalary, allowances, bankName, bankAccount, customDeductions } = req.body
      let resolvedBase = baseSalary != null ? Number(baseSalary) : undefined
      let resolvedAllowances = allowances

      if (gradeId) {
        const grade = await prisma.salaryGrade.findUnique({ where: { id: gradeId } })
        if (!grade || grade.schoolId !== employee.schoolId) return res.status(400).json({ error: 'Invalid grade' })
        resolvedBase = grade.baseSalary
        resolvedAllowances = grade.allowances
      }

      const data = {
        gradeId: gradeId || null,
        baseSalary: resolvedBase ?? employee.payrollProfile?.baseSalary ?? 0,
        allowances: resolvedAllowances ?? employee.payrollProfile?.allowances ?? [],
        bankName: bankName !== undefined ? bankName : undefined,
        bankAccount: bankAccount !== undefined ? bankAccount : undefined,
        customDeductions: customDeductions !== undefined ? customDeductions : undefined,
      }

      const profile = employee.payrollProfile
        ? await prisma.employeePayrollProfile.update({ where: { employeeId: employee.id }, data })
        : await prisma.employeePayrollProfile.create({ data: { employeeId: employee.id, ...data } })

      res.json(profile)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  // ===== STATS =====
  app.get('/api/payroll/stats', requireRole(...payrollRoles), async (req, res) => {
    try {
      const schoolId = await schoolIdFor(req)
      const [profiles, grades, runs, lastRun] = await Promise.all([
        prisma.employeePayrollProfile.count({ where: { employee: { schoolId, status: 'active' } } }),
        prisma.salaryGrade.count({ where: { schoolId, isActive: true } }),
        prisma.payrollRun.count({ where: { schoolId } }),
        prisma.payrollRun.findFirst({ where: { schoolId }, orderBy: [{ year: 'desc' }, { month: 'desc' }] }),
      ])
      res.json({
        configuredEmployees: profiles,
        salaryGrades: grades,
        payrollRuns: runs,
        lastRun: lastRun ? { id: lastRun.id, periodLabel: lastRun.periodLabel, status: lastRun.status, totalNet: lastRun.totalNet } : null,
      })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  // ===== PAYROLL RUNS =====
  app.get('/api/payroll/runs', requireRole(...payrollRoles), async (req, res) => {
    try {
      const schoolId = await schoolIdFor(req)
      const runs = await prisma.payrollRun.findMany({
        where: { schoolId, ...tenantWhere(req) },
        include: { _count: { select: { payslips: true } } },
        orderBy: [{ year: 'desc' }, { month: 'desc' }],
      })
      res.json(runs.map((r) => ({
        id: r.id,
        periodLabel: r.periodLabel,
        month: r.month,
        year: r.year,
        status: r.status,
        totalGross: r.totalGross,
        totalNet: r.totalNet,
        totalDeductions: r.totalDeductions,
        payslipCount: r._count.payslips,
        createdAt: r.createdAt,
        approvedAt: r.approvedAt,
        paidAt: r.paidAt,
      })))
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.get('/api/payroll/runs/:id', requireRole(...payrollRoles), async (req, res) => {
    try {
      const run = await prisma.payrollRun.findUnique({
        where: { id: req.params.id },
        include: {
          payslips: { orderBy: { employeeName: 'asc' } },
        },
      })
      if (!run || !checkTenantAccess(req, run.schoolId)) return res.status(404).json({ error: 'Not found' })
      res.json(run)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.post('/api/payroll/runs', requireRole(...payrollRoles), async (req, res) => {
    try {
      const schoolId = await schoolIdFor(req)
      const month = Number(req.body.month) || new Date().getMonth() + 1
      const year = Number(req.body.year) || new Date().getFullYear()

      const existing = await prisma.payrollRun.findUnique({
        where: { schoolId_month_year: { schoolId, month, year } },
      })
      if (existing) return res.status(409).json({ error: 'Payroll run already exists for this period', runId: existing.id })

      const settings = await getOrCreatePayrollSettings(prisma, schoolId)
      const employees = await prisma.employee.findMany({
        where: { schoolId, status: 'active' },
        include: { payrollProfile: true },
      })

      const eligible = employees.filter((e) => e.payrollProfile)
      if (!eligible.length) return res.status(400).json({ error: 'No employees with payroll profiles configured' })

      const run = await prisma.payrollRun.create({
        data: {
          schoolId,
          month,
          year,
          periodLabel: periodLabel(month, year),
          status: 'draft',
          processedById: req.user.userId || req.user.id,
        },
      })

      let totalGross = 0
      let totalNet = 0
      let totalDeductions = 0
      const payslipRows = []

      for (const emp of eligible) {
        const slip = computePayslip(emp.payrollProfile, emp, settings)
        totalGross += slip.grossPay
        totalNet += slip.netPay
        totalDeductions += slip.totalDeductions
        payslipRows.push({
          payrollRunId: run.id,
          ...slip,
          earnings: slip.earnings,
          deductions: slip.deductions,
          employerContributions: slip.employerContributions,
        })
      }

      await prisma.payslip.createMany({ data: payslipRows })
      const updated = await prisma.payrollRun.update({
        where: { id: run.id },
        data: {
          totalGross: roundMoney(totalGross),
          totalNet: roundMoney(totalNet),
          totalDeductions: roundMoney(totalDeductions),
        },
        include: { _count: { select: { payslips: true } } },
      })

      res.status(201).json(updated)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.post('/api/payroll/runs/:id/approve', requireRole(...payrollRoles), async (req, res) => {
    try {
      const run = await prisma.payrollRun.findUnique({ where: { id: req.params.id } })
      if (!run || !checkTenantAccess(req, run.schoolId)) return res.status(404).json({ error: 'Not found' })
      if (run.status === 'paid') return res.status(400).json({ error: 'Already paid' })

      await prisma.$transaction([
        prisma.payrollRun.update({
          where: { id: run.id },
          data: { status: 'approved', approvedAt: new Date() },
        }),
        prisma.payslip.updateMany({
          where: { payrollRunId: run.id },
          data: { status: 'approved' },
        }),
      ])

      const updated = await prisma.payrollRun.findUnique({
        where: { id: run.id },
        include: { payslips: true },
      })
      res.json(updated)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.post('/api/payroll/runs/:id/pay', requireRole(...payrollRoles), async (req, res) => {
    try {
      const run = await prisma.payrollRun.findUnique({
        where: { id: req.params.id },
        include: { payslips: { include: { employee: { include: { user: true } } } } },
      })
      if (!run || !checkTenantAccess(req, run.schoolId)) return res.status(404).json({ error: 'Not found' })
      if (run.status !== 'approved') return res.status(400).json({ error: 'Approve payroll before marking paid' })

      const now = new Date()
      await prisma.$transaction([
        prisma.payrollRun.update({
          where: { id: run.id },
          data: { status: 'paid', paidAt: now },
        }),
        prisma.payslip.updateMany({
          where: { payrollRunId: run.id },
          data: { status: 'paid', paidAt: now },
        }),
      ])

      if (enqueueEmail) {
        for (const slip of run.payslips) {
          const email = slip.employee?.user?.email || slip.employee?.email
          if (!email) continue
          await enqueueEmail({
            to: email,
            template: 'payslip_ready',
            payload: {
              firstName: slip.employee?.firstName || slip.employeeName.split(' ')[0],
              periodLabel: run.periodLabel,
              netPay: slip.netPay,
              currency: 'NGN',
            },
            schoolId: run.schoolId,
          })
        }
      }

      for (const slip of run.payslips) {
        const userId = slip.employee?.userId
        if (!userId) continue
        await dispatchNotification(prisma, {
          userId,
          schoolId: run.schoolId,
          type: 'payroll',
          title: 'Payslip available',
          body: `Your ${run.periodLabel} payslip (net ₦${slip.netPay.toLocaleString()}) is ready.`,
          payload: { payslipId: slip.id, payrollRunId: run.id, netPay: slip.netPay },
          channels: ['in_app', 'email'],
        })
      }

      const updated = await prisma.payrollRun.findUnique({ where: { id: run.id }, include: { payslips: true } })
      res.json(updated)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.get('/api/payroll/runs/:runId/payslips/:id/pdf', requireRole(...payrollRoles), async (req, res) => {
    try {
      const payslip = await prisma.payslip.findUnique({
        where: { id: req.params.id },
        include: { payrollRun: { include: { school: true } } },
      })
      if (!payslip || payslip.payrollRunId !== req.params.runId) return res.status(404).json({ error: 'Not found' })
      if (!checkTenantAccess(req, payslip.payrollRun.schoolId)) return res.status(403).json({ error: 'Forbidden' })

      const settings = await getOrCreatePayrollSettings(prisma, payslip.payrollRun.schoolId)
      streamPayslipPdf(res, {
        school: payslip.payrollRun.school,
        payslip,
        periodLabel: payslip.payrollRun.periodLabel,
        currency: settings.currency,
      })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  // ===== REPORT =====
  app.get('/api/payroll/report', requireRole(...payrollRoles), async (req, res) => {
    try {
      const schoolId = await schoolIdFor(req)
      const year = Number(req.query.year) || new Date().getFullYear()
      const runs = await prisma.payrollRun.findMany({
        where: { schoolId, year, status: { in: ['approved', 'paid'] } },
        orderBy: { month: 'asc' },
      })
      const totals = runs.reduce(
        (acc, r) => {
          acc.gross += r.totalGross
          acc.net += r.totalNet
          acc.deductions += r.totalDeductions
          return acc
        },
        { gross: 0, net: 0, deductions: 0 }
      )
      res.json({
        year,
        months: runs.map((r) => ({
          month: r.month,
          periodLabel: r.periodLabel,
          totalGross: r.totalGross,
          totalNet: r.totalNet,
          totalDeductions: r.totalDeductions,
          status: r.status,
        })),
        totals: {
          gross: roundMoney(totals.gross),
          net: roundMoney(totals.net),
          deductions: roundMoney(totals.deductions),
        },
      })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  // ===== STAFF SELF-SERVICE =====
  app.get('/api/payroll/my-payslips', requireRole('Teacher', 'HRManager', 'SchoolAdmin', 'Accountant', 'Librarian', 'HostelManager', 'TransportManager'), async (req, res) => {
    try {
      const employee = await resolveEmployeeForUser(prisma, req.user)
      if (!employee) return res.json([])

      const payslips = await prisma.payslip.findMany({
        where: { employeeId: employee.id, status: { in: ['approved', 'paid'] } },
        include: { payrollRun: { select: { periodLabel: true, month: true, year: true, status: true } } },
        orderBy: { createdAt: 'desc' },
        take: 24,
      })
      res.json(payslips.map((p) => ({
        id: p.id,
        payrollRunId: p.payrollRunId,
        periodLabel: p.payrollRun.periodLabel,
        grossPay: p.grossPay,
        netPay: p.netPay,
        totalDeductions: p.totalDeductions,
        status: p.status,
        paidAt: p.paidAt,
      })))
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.get('/api/payroll/my-payslips/:id/pdf', requireRole('Teacher', 'HRManager', 'SchoolAdmin', 'Accountant', 'Librarian', 'HostelManager', 'TransportManager'), async (req, res) => {
    try {
      const employee = await resolveEmployeeForUser(prisma, req.user)
      if (!employee) return res.status(404).json({ error: 'Not found' })

      const payslip = await prisma.payslip.findFirst({
        where: { id: req.params.id, employeeId: employee.id, status: { in: ['approved', 'paid'] } },
        include: { payrollRun: { include: { school: true } } },
      })
      if (!payslip) return res.status(404).json({ error: 'Not found' })

      const settings = await getOrCreatePayrollSettings(prisma, payslip.payrollRun.schoolId)
      streamPayslipPdf(res, {
        school: payslip.payrollRun.school,
        payslip,
        periodLabel: payslip.payrollRun.periodLabel,
        currency: settings.currency,
      })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })
}

module.exports = { registerPayrollRoutes }
