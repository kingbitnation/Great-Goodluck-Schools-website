function resolveSchoolId(req) {
  if (req.user?.role === 'SuperAdmin' && (req.query.schoolId || req.body?.schoolId)) {
    return String(req.query.schoolId || req.body.schoolId)
  }
  return req.user?.schoolId || (req.query.schoolId ? String(req.query.schoolId) : null)
}

function monthKey(date) {
  const d = new Date(date)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function monthLabel(key) {
  const [y, m] = key.split('-')
  const d = new Date(Number(y), Number(m) - 1, 1)
  return d.toLocaleString('en', { month: 'short', year: 'numeric' })
}

function groupByMonth(records, dateField, valueField = null) {
  const map = {}
  for (const row of records) {
    const key = monthKey(row[dateField])
    if (!map[key]) map[key] = { total: 0, count: 0 }
    map[key].count += 1
    if (valueField) map[key].total += Number(row[valueField] || 0)
  }
  return Object.entries(map)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, v]) => ({
      month: monthLabel(key),
      monthKey: key,
      count: v.count,
      total: Math.round(v.total * 100) / 100,
    }))
}

function lastNMonths(series, n = 6) {
  return series.slice(-n)
}

function linearForecast(dataPoints, periodsAhead = 3) {
  if (!dataPoints.length) {
    return Array.from({ length: periodsAhead }, (_, i) => ({
      label: `+${i + 1} mo`,
      value: 0,
    }))
  }
  if (dataPoints.length === 1) {
    const v = dataPoints[0].value
    return Array.from({ length: periodsAhead }, (_, i) => ({
      label: `+${i + 1} mo`,
      value: v,
    }))
  }
  const n = dataPoints.length
  let sumX = 0
  let sumY = 0
  let sumXY = 0
  let sumX2 = 0
  for (let i = 0; i < n; i++) {
    sumX += i
    sumY += dataPoints[i].value
    sumXY += i * dataPoints[i].value
    sumX2 += i * i
  }
  const denom = n * sumX2 - sumX * sumX
  const slope = denom ? (n * sumXY - sumX * sumY) / denom : 0
  const intercept = (sumY - slope * sumX) / n
  return Array.from({ length: periodsAhead }, (_, i) => ({
    label: `+${i + 1} mo`,
    value: Math.round(Math.max(0, intercept + slope * (n + i))),
  }))
}


async function proprietorAnalytics(prisma, schoolId) {
  const schoolFilter = schoolId ? { schoolId } : {}

  const [
    students,
    payments,
    payrollRuns,
    marketplaceOrders,
    alumniDonations,
    applications,
    newStudents,
  ] = await Promise.all([
    prisma.student.count({ where: schoolFilter }),
    prisma.payment.findMany({
      where: schoolFilter,
      select: {
        amount: true,
        paidAmount: true,
        status: true,
        verificationStatus: true,
        gateway: true,
        createdAt: true,
        paidAt: true,
      },
    }),
    prisma.payrollRun.findMany({
      where: schoolId ? { schoolId, status: 'completed' } : { status: 'completed' },
      select: { totalNet: true, paidAt: true },
    }),
    prisma.marketplaceOrder.findMany({
      where: schoolId ? { schoolId, status: { in: ['paid', 'processing', 'fulfilled'] } } : { status: { in: ['paid', 'processing', 'fulfilled'] } },
      select: { totalAmount: true, paidAt: true, createdAt: true },
    }),
    prisma.alumniDonation.findMany({
      where: schoolId ? { schoolId, status: 'completed' } : { status: 'completed' },
      select: { amount: true, paidAt: true },
    }),
    prisma.admissionApplication.groupBy({
      by: ['status'],
      where: schoolId ? { schoolId } : {},
      _count: true,
    }),
    prisma.student.findMany({
      where: schoolFilter,
      select: { createdAt: true },
      orderBy: { createdAt: 'asc' },
    }),
  ])

  const completedPayments = payments.filter(
    (p) =>
      ['completed', 'partial'].includes(p.status) &&
      (p.verificationStatus === 'approved' || (p.verificationStatus === 'none' && p.gateway !== 'manual'))
  )
  const totalRevenue = completedPayments.reduce((s, p) => s + (p.paidAmount || p.amount || 0), 0)
  const pendingCollection = payments
    .filter((p) => p.status === 'pending' || p.verificationStatus === 'pending_verification')
    .reduce((s, p) => s + (p.amount - (p.paidAmount || 0)), 0)
  const payrollSpend = payrollRuns.reduce((s, r) => s + (r.totalNet || 0), 0)
  const shopRevenue = marketplaceOrders.reduce((s, o) => s + o.totalAmount, 0)
  const donationTotal = alumniDonations.reduce((s, d) => s + d.amount, 0)

  const revenueByMonth = lastNMonths(
    groupByMonth(
      completedPayments.map((p) => ({
        createdAt: p.paidAt || p.createdAt,
        paidAmount: p.paidAmount || p.amount || 0,
      })),
      'createdAt',
      'paidAmount'
    ).map((m) => ({ month: m.month, value: m.total })),
    6
  )

  const enrollmentByMonth = lastNMonths(
    groupByMonth(newStudents, 'createdAt').map((m) => ({ month: m.month, value: m.count })),
    6
  )

  const admissionPipeline = applications.reduce((acc, row) => {
    acc[row.status] = row._count
    return acc
  }, {})

  const revenueForecast = linearForecast(revenueByMonth.map((m) => ({ value: m.value })))
  const enrollmentForecast = linearForecast(enrollmentByMonth.map((m) => ({ value: m.value })))

  return {
    kpis: {
      totalStudents: students,
      totalRevenue: Math.round(totalRevenue),
      pendingCollection: Math.round(pendingCollection),
      payrollSpend: Math.round(payrollSpend),
      shopRevenue: Math.round(shopRevenue),
      donationTotal: Math.round(donationTotal),
      netEstimate: Math.round(totalRevenue + shopRevenue + donationTotal - payrollSpend),
    },
    revenueByMonth,
    enrollmentByMonth,
    admissionPipeline,
    forecasts: {
      revenue: revenueForecast,
      enrollment: enrollmentForecast,
    },
  }
}

async function principalAnalytics(prisma, schoolId) {
  const schoolFilter = schoolId ? { schoolId } : {}

  const [totalStudents, totalTeachers, totalClasses, attendance, results, classes, examAttempts, libraryLoans] =
    await Promise.all([
      prisma.student.count({ where: schoolFilter }),
      prisma.teacher.count({ where: schoolFilter }),
      prisma.class.count({ where: schoolFilter }),
      prisma.attendance.findMany({
        where: schoolId ? { class: { schoolId } } : {},
        select: { status: true, date: true, classId: true },
      }),
      prisma.result.findMany({
        where: schoolId ? { student: { schoolId } } : {},
        include: { subject: { select: { name: true, classId: true } }, student: { select: { classId: true } } },
      }),
      prisma.class.findMany({
        where: schoolFilter,
        include: { _count: { select: { students: true } } },
      }),
      prisma.examAttempt.count({
        where: schoolId
          ? { exam: { OR: [{ schoolId }, { class: { schoolId } }] } }
          : {},
      }),
      prisma.libraryTransaction.count({
        where: schoolId ? { schoolId, returned: false } : { returned: false },
      }),
    ])

  const presentCount = attendance.filter((a) => a.status === 'Present').length
  const averageAttendance = attendance.length > 0 ? Math.round((presentCount / attendance.length) * 100) : 0

  const averageScore =
    results.length > 0 ? Math.round((results.reduce((s, r) => s + r.totalScore, 0) / results.length) * 10) / 10 : 0

  const resultsByGrade = results.reduce((acc, r) => {
    const grade = r.grade || 'Ungraded'
    acc[grade] = (acc[grade] || 0) + 1
    return acc
  }, {})

  const subjectMap = {}
  for (const r of results) {
    const name = r.subject?.name || 'Unknown'
    if (!subjectMap[name]) subjectMap[name] = { total: 0, count: 0 }
    subjectMap[name].total += r.totalScore
    subjectMap[name].count += 1
  }
  const subjectPerformance = Object.entries(subjectMap)
    .map(([subjectName, v]) => ({
      subjectName,
      averageScore: Math.round((v.total / v.count) * 10) / 10,
    }))
    .sort((a, b) => b.averageScore - a.averageScore)

  const classAttendance = {}
  for (const a of attendance) {
    if (!a.classId) continue
    if (!classAttendance[a.classId]) classAttendance[a.classId] = { present: 0, total: 0 }
    classAttendance[a.classId].total += 1
    if (a.status === 'Present') classAttendance[a.classId].present += 1
  }
  const classMap = Object.fromEntries(classes.map((c) => [c.id, c.name]))
  const attendanceByClass = Object.entries(classAttendance)
    .map(([classId, v]) => ({
      className: classMap[classId] || 'Unknown',
      percentage: v.total > 0 ? Math.round((v.present / v.total) * 100) : 0,
    }))
    .sort((a, b) => b.percentage - a.percentage)

  const monthAtt = {}
  for (const a of attendance) {
    const key = monthKey(a.date)
    if (!monthAtt[key]) monthAtt[key] = { present: 0, total: 0, label: monthLabel(key) }
    monthAtt[key].total += 1
    if (a.status === 'Present') monthAtt[key].present += 1
  }
  const attendanceTrend = lastNMonths(
    Object.entries(monthAtt)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, v]) => ({
        month: v.label,
        value: v.total > 0 ? Math.round((v.present / v.total) * 100) : 0,
      })),
    6
  )

  const attendanceForecast = linearForecast(attendanceTrend.map((m) => ({ value: m.value })))
  const performanceForecast = linearForecast(
    subjectPerformance.slice(0, 6).map((s, i) => ({ value: s.averageScore }))
  )

  return {
    kpis: {
      totalStudents,
      totalTeachers,
      totalClasses,
      averageAttendance,
      averageScore,
      cbtAttempts: examAttempts,
      activeLibraryLoans: libraryLoans,
    },
    studentsByClass: classes.map((c) => ({ className: c.name, count: c._count.students })),
    resultsByGrade,
    subjectPerformance,
    attendanceByClass,
    attendanceTrend,
    forecasts: {
      attendance: attendanceForecast,
      performance: performanceForecast,
    },
  }
}

async function teacherAnalytics(prisma, userId) {
  const teacher = await prisma.teacher.findUnique({
    where: { userId },
    include: {
      subjects: { include: { class: { select: { id: true, name: true } } } },
      liveClasses: {
        where: { status: { in: ['scheduled', 'live'] } },
        orderBy: { scheduledAt: 'asc' },
        take: 5,
      },
      assignments: {
        include: { _count: { select: { submissions: true } } },
      },
    },
  })
  if (!teacher) {
    return {
      kpis: { subjects: 0, classes: 0, pendingSubmissions: 0, averageScore: 0, attendanceRate: 0 },
      subjects: [],
      classPerformance: [],
      upcomingClasses: [],
      pendingGrading: [],
    }
  }

  const subjectIds = teacher.subjects.map((s) => s.id)
  const classIds = [...new Set(teacher.subjects.map((s) => s.classId).filter(Boolean))]

  const [results, attendance, pendingSubmissions] = await Promise.all([
    prisma.result.findMany({
      where: { subjectId: { in: subjectIds } },
      include: { subject: { select: { name: true } } },
    }),
    prisma.attendance.findMany({
      where: classIds.length ? { classId: { in: classIds } } : { id: '__none__' },
      select: { status: true, classId: true },
    }),
    prisma.submission.findMany({
      where: {
        assignment: { teacherId: teacher.id },
        grade: null,
      },
      include: {
        assignment: { select: { title: true } },
        student: { include: { user: { select: { firstName: true, lastName: true } } } },
      },
      take: 10,
      orderBy: { submittedAt: 'desc' },
    }),
  ])

  const present = attendance.filter((a) => a.status === 'Present').length
  const attendanceRate = attendance.length > 0 ? Math.round((present / attendance.length) * 100) : 0
  const averageScore =
    results.length > 0 ? Math.round((results.reduce((s, r) => s + r.totalScore, 0) / results.length) * 10) / 10 : 0

  const classPerfMap = {}
  for (const r of results) {
    const name = r.subject?.name || 'Subject'
    if (!classPerfMap[name]) classPerfMap[name] = { total: 0, count: 0 }
    classPerfMap[name].total += r.totalScore
    classPerfMap[name].count += 1
  }

  return {
    kpis: {
      subjects: teacher.subjects.length,
      classes: classIds.length,
      pendingSubmissions: pendingSubmissions.length,
      averageScore,
      attendanceRate,
      upcomingLiveClasses: teacher.liveClasses.length,
    },
    subjects: teacher.subjects.map((s) => ({
      name: s.name,
      className: s.class?.name || '—',
      code: s.code,
    })),
    classPerformance: Object.entries(classPerfMap).map(([subjectName, v]) => ({
      subjectName,
      averageScore: Math.round((v.total / v.count) * 10) / 10,
    })),
    upcomingClasses: teacher.liveClasses.map((lc) => ({
      id: lc.id,
      title: lc.title,
      scheduledAt: lc.scheduledAt,
      status: lc.status,
    })),
    pendingGrading: pendingSubmissions.map((s) => ({
      id: s.id,
      assignmentTitle: s.assignment?.title,
      studentName: s.student ? `${s.student.user.firstName} ${s.student.user.lastName}` : 'Student',
      submittedAt: s.submittedAt,
    })),
    forecasts: {
      classAverage: linearForecast(
        Object.values(classPerfMap).map((v) => ({ value: Math.round((v.total / v.count) * 10) / 10 })).slice(0, 4)
      ),
    },
  }
}

module.exports = {
  resolveSchoolId,
  proprietorAnalytics,
  principalAnalytics,
  teacherAnalytics,
  linearForecast,
  groupByMonth,
}
