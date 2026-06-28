const crypto = require('crypto')

const JOB_STATUSES = ['submitted', 'screening', 'interview', 'offered', 'hired', 'rejected']
const LEAVE_STATUSES = ['pending', 'approved', 'rejected']

function generateJobReference() {
  return `JOB-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`
}

function generateEmployeeNo(schoolId) {
  return `EMP-${String(schoolId).slice(0, 4).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`
}

async function resolveSchoolForPublic(prisma, schoolId) {
  if (schoolId) {
    const school = await prisma.school.findUnique({ where: { id: schoolId } })
    if (school?.status === 'active') return school
  }
  return prisma.school.findFirst({ where: { status: 'active' }, orderBy: { createdAt: 'asc' } })
}

async function syncTeachersToEmployees(prisma, schoolId) {
  const teachers = await prisma.teacher.findMany({
    where: { schoolId },
    include: { user: true, employee: true },
  })
  let created = 0
  for (const t of teachers) {
    if (t.employee) continue
    await prisma.employee.create({
      data: {
        schoolId,
        userId: t.userId,
        teacherId: t.id,
        employeeNo: t.staffNo || generateEmployeeNo(schoolId),
        firstName: t.user.firstName,
        lastName: t.user.lastName,
        email: t.user.email,
        phone: t.user.phone,
        department: t.department,
        jobTitle: 'Teacher',
        employeeType: 'teacher',
        hireDate: t.hireDate,
        status: 'active',
      },
    })
    created++
  }
  return created
}

async function resolveEmployeeForUser(prisma, user) {
  const userId = user.userId || user.id
  let employee = await prisma.employee.findUnique({ where: { userId } })
  if (employee) return employee
  if (user.role === 'Teacher') {
    const teacher = await prisma.teacher.findUnique({ where: { userId }, include: { employee: true } })
    return teacher?.employee || null
  }
  return null
}

module.exports = {
  JOB_STATUSES,
  LEAVE_STATUSES,
  generateJobReference,
  generateEmployeeNo,
  resolveSchoolForPublic,
  syncTeachersToEmployees,
  resolveEmployeeForUser,
}
