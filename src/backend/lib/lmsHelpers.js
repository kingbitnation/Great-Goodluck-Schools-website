const crypto = require('crypto')
const { tenantWhere } = require('../middleware/tenantGuard')
const { PLATFORM_PREFIX } = require('./platformBrand')

function schoolScope(user) {
  return tenantWhere(user)
}

async function getStudentRecord(prisma, user) {
  if (!user || user.role !== 'Student') return null
  const userId = user.userId || user.id
  if (!userId) return null
  return prisma.student.findUnique({ where: { userId } })
}

async function getTeacherRecord(prisma, user) {
  if (!user || user.role !== 'Teacher') return null
  const userId = user.userId || user.id
  if (!userId) return null
  return prisma.teacher.findUnique({ where: { userId } })
}

function assertCourseTenant(user, course) {
  if (user.role === 'SuperAdmin') return true
  return course.schoolId === user.schoolId
}

async function countCourseLessons(prisma, courseId) {
  return prisma.lmsLesson.count({
    where: { module: { courseId } },
  })
}

async function recalcEnrollmentProgress(prisma, enrollmentId) {
  const enrollment = await prisma.lmsEnrollment.findUnique({
    where: { id: enrollmentId },
    include: { course: { include: { modules: { include: { lessons: true } } } } },
  })
  if (!enrollment) return null

  const lessonIds = enrollment.course.modules.flatMap((m) => m.lessons.map((l) => l.id))
  const total = lessonIds.length
  if (total === 0) {
    return prisma.lmsEnrollment.update({
      where: { id: enrollmentId },
      data: { progressPercent: 0, completedAt: null },
    })
  }

  const completed = await prisma.lmsLessonProgress.count({
    where: { enrollmentId, lessonId: { in: lessonIds }, completed: true },
  })
  const progressPercent = Math.round((completed / total) * 100)
  const completedAt = progressPercent >= 100 ? new Date() : null

  return prisma.lmsEnrollment.update({
    where: { id: enrollmentId },
    data: { progressPercent, completedAt },
  })
}

async function ensureEnrollment(prisma, courseId, studentId) {
  return prisma.lmsEnrollment.upsert({
    where: { courseId_studentId: { courseId, studentId } },
    update: {},
    create: { courseId, studentId },
  })
}

async function issueCertificateIfComplete(prisma, courseId, studentId) {
  const enrollment = await prisma.lmsEnrollment.findUnique({
    where: { courseId_studentId: { courseId, studentId } },
  })
  if (!enrollment || enrollment.progressPercent < 100) return null

  const existing = await prisma.lmsCertificate.findUnique({
    where: { courseId_studentId: { courseId, studentId } },
  })
  if (existing) return existing

  const year = new Date().getFullYear()
  const suffix = crypto.randomBytes(3).toString('hex').toUpperCase()
  return prisma.lmsCertificate.create({
    data: {
      courseId,
      studentId,
      certificateNumber: `${PLATFORM_PREFIX}-CERT-${year}-${suffix}`,
      verifyCode: crypto.randomBytes(8).toString('hex'),
    },
  })
}

function formatCourseSummary(course, enrollment, lessonCount) {
  const firstVideo = course.modules
    ?.flatMap((m) => m.lessons || [])
    .find((l) => l.type === 'video' && l.resourceUrl)

  return {
    id: course.id,
    title: course.title,
    description: course.description,
    thumbnail: course.thumbnail,
    videoUrl: firstVideo?.resourceUrl || null,
    published: course.published,
    moduleCount: course.modules?.length || course._count?.modules || 0,
    lessonCount: lessonCount ?? 0,
    progressPercent: enrollment?.progressPercent ?? null,
    completedAt: enrollment?.completedAt ?? null,
  }
}

module.exports = {
  schoolScope,
  getStudentRecord,
  getTeacherRecord,
  assertCourseTenant,
  countCourseLessons,
  recalcEnrollmentProgress,
  ensureEnrollment,
  issueCertificateIfComplete,
  formatCourseSummary,
}
