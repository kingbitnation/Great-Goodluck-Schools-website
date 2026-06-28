const bcrypt = require('bcrypt')
const crypto = require('crypto')

const STATUSES = [
  'submitted',
  'under_review',
  'exam_scheduled',
  'interviewed',
  'accepted',
  'rejected',
  'waitlisted',
  'enrolled',
]

function generateReferenceNo() {
  return `APP-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`
}

function splitName(fullName) {
  const parts = String(fullName || '').trim().split(/\s+/)
  if (parts.length === 0) return { firstName: 'Student', lastName: 'Applicant' }
  if (parts.length === 1) return { firstName: parts[0], lastName: 'Applicant' }
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') }
}

async function logStatusChange(prisma, applicationId, fromStatus, toStatus, { note, changedById } = {}) {
  return prisma.applicationStatusLog.create({
    data: {
      applicationId,
      fromStatus,
      toStatus,
      note: note || null,
      changedById: changedById || null,
    },
  })
}

async function transitionApplication(prisma, application, toStatus, { note, changedById, reviewNote } = {}) {
  if (!STATUSES.includes(toStatus)) {
    throw new Error(`Invalid status: ${toStatus}`)
  }
  const updated = await prisma.admissionApplication.update({
    where: { id: application.id },
    data: {
      status: toStatus,
      reviewNote: reviewNote ?? application.reviewNote,
      reviewedById: changedById || application.reviewedById,
      reviewedAt: new Date(),
    },
  })
  await logStatusChange(prisma, application.id, application.status, toStatus, { note, changedById })
  return updated
}

async function notifyAdmissionEmails(prisma, _enqueueEmail, { application, template, extra = {} }) {
  const school = await prisma.school.findUnique({ where: { id: application.schoolId } })
  const payload = {
    parentName: application.parentName,
    studentName: application.studentName,
    grade: application.gradeApplied,
    referenceNo: application.referenceNo,
    email: application.email,
    phone: application.phone,
    schoolName: school?.name,
    applicantName: application.studentName,
    status: extra.status || application.status,
    message: extra.message,
    template,
    ...extra,
  }

  const { dispatchNotification } = require('./notificationDispatcher')
  await dispatchNotification(prisma, {
    schoolId: application.schoolId,
    type: 'admission',
    title: `Admission update: ${application.referenceNo}`,
    body: payload.message || `Application status: ${application.status}`,
    email: application.email,
    phone: application.phone,
    emailTemplate: template,
    emailPayload: payload,
    smsPayload: payload,
    channels: ['email', 'sms', 'in_app'],
  })
}

async function resolveSchoolForPublicApply(prisma, { schoolId }) {
  if (schoolId) {
    const school = await prisma.school.findUnique({ where: { id: schoolId } })
    if (school && school.status === 'active') return school
  }
  return prisma.school.findFirst({ where: { status: 'active' }, orderBy: { createdAt: 'asc' } })
}

async function getActiveCycle(prisma, schoolId) {
  const now = new Date()
  return prisma.admissionCycle.findFirst({
    where: {
      schoolId,
      isActive: true,
      openDate: { lte: now },
      closeDate: { gte: now },
    },
    orderBy: { openDate: 'desc' },
  })
}

async function enrollApplication(prisma, application, { classId, password, changedById }) {
  if (application.enrolledStudentId) {
    throw new Error('Application already enrolled')
  }
  if (!['accepted', 'interviewed', 'exam_scheduled', 'under_review', 'submitted'].includes(application.status)) {
    throw new Error('Application cannot be enrolled in current status')
  }

  const existingUser = await prisma.user.findUnique({ where: { email: application.email } })
  if (existingUser) {
    throw new Error('A user with parent email already exists — enroll manually or use a different email')
  }

  const studentRole = await prisma.role.findUnique({ where: { name: 'Student' } })
  const parentRole = await prisma.role.findUnique({ where: { name: 'Parent' } })
  if (!studentRole || !parentRole) throw new Error('Roles not configured')

  const { firstName, lastName } = splitName(application.studentName)
  const studentEmail = `student.${application.referenceNo.toLowerCase().replace(/[^a-z0-9]/g, '')}@applicant.local`
  const tempPassword = password || `Welcome${application.referenceNo.slice(-4)}`
  const hashed = await bcrypt.hash(tempPassword, 10)

  let parentProfile = null
  const parentUser = await prisma.user.create({
    data: {
      email: application.email,
      password: hashed,
      firstName: application.parentName.split(' ')[0] || application.parentName,
      lastName: application.parentName.split(' ').slice(1).join(' ') || 'Guardian',
      phone: application.phone,
      roleId: parentRole.id,
      schoolId: application.schoolId,
      isActive: true,
    },
  })
  parentProfile = await prisma.parent.create({
    data: { userId: parentUser.id, schoolId: application.schoolId },
  })

  const studentUser = await prisma.user.create({
    data: {
      email: studentEmail,
      password: hashed,
      firstName,
      lastName,
      roleId: studentRole.id,
      schoolId: application.schoolId,
      isActive: true,
    },
  })

  const student = await prisma.student.create({
    data: {
      userId: studentUser.id,
      schoolId: application.schoolId,
      admissionNo: application.referenceNo.replace('APP-', 'ADM-'),
      classId: classId || null,
      parentId: parentProfile.id,
      dob: application.dob,
      gender: application.gender,
      admissionDate: new Date(),
    },
  })

  await transitionApplication(prisma, application, 'enrolled', {
    note: 'Converted to student record',
    changedById,
  })

  const enrolled = await prisma.admissionApplication.update({
    where: { id: application.id },
    data: { enrolledStudentId: student.id },
  })

  return {
    application: enrolled,
    student,
    parentUser,
    studentUser,
    credentials: {
      parentEmail: application.email,
      studentEmail,
      password: tempPassword,
    },
  }
}

module.exports = {
  STATUSES,
  generateReferenceNo,
  transitionApplication,
  notifyAdmissionEmails,
  resolveSchoolForPublicApply,
  getActiveCycle,
  enrollApplication,
  logStatusChange,
}
