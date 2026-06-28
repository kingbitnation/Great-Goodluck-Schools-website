const crypto = require('crypto')
const { checkTenantAccess } = require('./tenantHelpers')

function resolveSchoolId(req) {
  if (req.user?.role === 'SuperAdmin' && req.query.schoolId) return String(req.query.schoolId)
  return req.user?.schoolId
}

function hashTemplate(seed) {
  return crypto.createHash('sha256').update(String(seed)).digest('hex')
}

function formatDevice(device) {
  return {
    id: device.id,
    name: device.name,
    location: device.location,
    deviceType: device.deviceType,
    methods: device.methods.split(',').filter(Boolean),
    direction: device.direction,
    apiKey: device.apiKey,
    isActive: device.isActive,
    createdAt: device.createdAt,
  }
}

function formatEnrollment(enrollment) {
  const student = enrollment.student
  const employee = enrollment.employee
  return {
    id: enrollment.id,
    personType: enrollment.personType,
    studentId: enrollment.studentId,
    employeeId: enrollment.employeeId,
    method: enrollment.method,
    label: enrollment.label,
    status: enrollment.status,
    enrolledAt: enrollment.enrolledAt,
    personName: student
      ? `${student.user?.firstName || ''} ${student.user?.lastName || ''}`.trim()
      : employee
        ? `${employee.firstName} ${employee.lastName}`.trim()
        : enrollment.label || 'Unknown',
    admissionNo: student?.admissionNo || null,
    employeeNo: employee?.employeeNo || null,
  }
}

function formatEvent(event) {
  const student = event.student
  const employee = event.employee
  return {
    id: event.id,
    eventType: event.eventType,
    method: event.method,
    personType: event.personType,
    direction: event.direction,
    matchScore: event.matchScore,
    status: event.status,
    notes: event.notes,
    createdAt: event.createdAt,
    device: event.device ? { id: event.device.id, name: event.device.name, location: event.device.location } : null,
    personName: student
      ? `${student.user?.firstName || ''} ${student.user?.lastName || ''}`.trim()
      : employee
        ? `${employee.firstName} ${employee.lastName}`.trim()
        : 'Unknown',
    admissionNo: student?.admissionNo || null,
    employeeNo: employee?.employeeNo || null,
    attendanceId: event.attendanceId,
  }
}

async function getOrCreateSettings(prisma, schoolId) {
  return prisma.biometricSetting.upsert({
    where: { schoolId },
    update: {},
    create: { schoolId },
  })
}

async function resolveMarkedById(prisma, schoolId) {
  const biometricMgr = await prisma.user.findFirst({
    where: { schoolId, role: { name: 'BiometricManager' }, isActive: true },
  })
  if (biometricMgr) return biometricMgr.id
  const schoolAdmin = await prisma.user.findFirst({
    where: { schoolId, role: { name: 'SchoolAdmin' }, isActive: true },
  })
  return schoolAdmin?.id || null
}

async function processBiometricScan(prisma, { device, enrollment, method, matchScore, direction, markedById }) {
  const settings = await getOrCreateSettings(prisma, device.schoolId)
  const score = matchScore != null ? Number(matchScore) : 0.97
  const minScore = settings.minMatchScore || 0.85

  if (!enrollment || enrollment.status !== 'active') {
    const event = await prisma.biometricEvent.create({
      data: {
        schoolId: device.schoolId,
        deviceId: device.id,
        eventType: device.deviceType === 'classroom' ? 'attendance' : 'access',
        method,
        personType: 'unknown',
        direction: direction || device.direction || null,
        matchScore: score,
        status: 'failed',
        notes: 'No matching enrollment',
      },
      include: { device: true },
    })
    return { event: formatEvent(event), attendance: null, granted: false }
  }

  if (score < minScore) {
    const event = await prisma.biometricEvent.create({
      data: {
        schoolId: device.schoolId,
        deviceId: device.id,
        eventType: device.deviceType === 'classroom' ? 'attendance' : 'access',
        method,
        personType: enrollment.personType,
        studentId: enrollment.studentId,
        employeeId: enrollment.employeeId,
        direction: direction || device.direction || null,
        matchScore: score,
        status: 'denied',
        notes: 'Match score below threshold',
      },
      include: { device: true, student: { include: { user: true } }, employee: true },
    })
    return { event: formatEvent(event), attendance: null, granted: false }
  }

  let attendanceRecord = null
  const eventType = device.deviceType === 'classroom' ? 'attendance' : 'access'

  if (
    enrollment.personType === 'student' &&
    device.deviceType === 'classroom' &&
    settings.autoMarkAttendance &&
    enrollment.studentId
  ) {
    const student = await prisma.student.findUnique({ where: { id: enrollment.studentId } })
    if (student?.classId) {
      const markedBy = markedById || (await resolveMarkedById(prisma, device.schoolId))
      if (markedBy) {
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        attendanceRecord = await prisma.attendance.upsert({
          where: {
            studentId_classId_date: {
              studentId: student.id,
              classId: student.classId,
              date: today,
            },
          },
          update: { status: 'Present', source: 'biometric', remark: `Biometric ${method}` },
          create: {
            studentId: student.id,
            classId: student.classId,
            date: today,
            status: 'Present',
            markedById: markedBy,
            source: 'biometric',
            remark: `Biometric ${method}`,
          },
        })
      }
    }
  }

  const granted = settings.accessControlEnabled || eventType === 'attendance'
  const event = await prisma.biometricEvent.create({
    data: {
      schoolId: device.schoolId,
      deviceId: device.id,
      eventType,
      method,
      personType: enrollment.personType,
      studentId: enrollment.studentId,
      employeeId: enrollment.employeeId,
      direction: direction || device.direction || (device.deviceType === 'gate' ? 'in' : null),
      matchScore: score,
      status: granted ? 'granted' : 'denied',
      attendanceId: attendanceRecord?.id || null,
      notes: attendanceRecord ? 'Attendance marked' : null,
    },
    include: {
      device: true,
      student: { include: { user: true } },
      employee: true,
    },
  })

  return { event: formatEvent(event), attendance: attendanceRecord, granted }
}

async function biometricStatsForSchool(prisma, schoolId) {
  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)

  const [devices, enrollments, scansToday, accessToday, attendanceToday] = await Promise.all([
    prisma.biometricDevice.count({ where: { schoolId, isActive: true } }),
    prisma.biometricEnrollment.count({ where: { schoolId, status: 'active' } }),
    prisma.biometricEvent.count({ where: { schoolId, createdAt: { gte: startOfDay } } }),
    prisma.biometricEvent.count({ where: { schoolId, eventType: 'access', createdAt: { gte: startOfDay } } }),
    prisma.biometricEvent.count({
      where: { schoolId, eventType: 'attendance', status: 'granted', createdAt: { gte: startOfDay } },
    }),
  ])

  const studentEnrollments = await prisma.biometricEnrollment.count({
    where: { schoolId, status: 'active', personType: 'student' },
  })
  const staffEnrollments = await prisma.biometricEnrollment.count({
    where: { schoolId, status: 'active', personType: 'employee' },
  })

  return {
    devices,
    enrollments,
    studentEnrollments,
    staffEnrollments,
    scansToday,
    accessLogsToday: accessToday,
    biometricAttendanceToday: attendanceToday,
  }
}

module.exports = {
  resolveSchoolId,
  hashTemplate,
  formatDevice,
  formatEnrollment,
  formatEvent,
  getOrCreateSettings,
  processBiometricScan,
  biometricStatsForSchool,
  checkTenantAccess,
}
