const crypto = require('crypto')
const { tenantWhere } = require('../middleware/tenantGuard')

function schoolScope(user) {
  return tenantWhere(user)
}

function assertLiveClassTenant(user, liveClass) {
  if (user.role === 'SuperAdmin') return true
  return liveClass.schoolId === user.schoolId
}

function generateRoomCode() {
  return crypto.randomBytes(4).toString('hex')
}

function buildJitsiUrl(roomCode, displayName) {
  const domain = process.env.JITSI_DOMAIN || 'meet.jit.si'
  const room = `GGS-${roomCode}`
  const hash = [
    'config.startWithAudioMuted=true',
    'config.prejoinPageEnabled=false',
    `userInfo.displayName="${encodeURIComponent(displayName || 'Participant')}"`,
  ].join('&')
  return `https://${domain}/${room}#${hash}`
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

function formatLiveClassSummary(liveClass, attendanceCount = 0) {
  return {
    id: liveClass.id,
    title: liveClass.title,
    description: liveClass.description,
    roomCode: liveClass.roomCode,
    status: liveClass.status,
    scheduledAt: liveClass.scheduledAt,
    startedAt: liveClass.startedAt,
    endedAt: liveClass.endedAt,
    recordingUrl: liveClass.recordingUrl,
    className: liveClass.class?.name || null,
    subjectName: liveClass.subject?.name || null,
    teacherName: liveClass.teacher
      ? `${liveClass.teacher.user.firstName} ${liveClass.teacher.user.lastName}`
      : null,
    attendanceCount,
  }
}

module.exports = {
  schoolScope,
  assertLiveClassTenant,
  generateRoomCode,
  buildJitsiUrl,
  getStudentRecord,
  getTeacherRecord,
  formatLiveClassSummary,
}
