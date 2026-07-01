const crypto = require('crypto')
const { checkTenantAccess } = require('./tenantHelpers')
const { PLATFORM_PREFIX } = require('./platformBrand')

const CERTIFICATE_TYPES = {
  graduation: 'Certificate of Graduation',
  attendance: 'Certificate of Attendance',
  excellence: 'Certificate of Excellence',
}

function resolveSchoolId(req) {
  if (req.user?.role === 'SuperAdmin' && req.query.schoolId) return String(req.query.schoolId)
  return req.user?.schoolId
}

function generateVerifyCode() {
  return crypto.randomBytes(12).toString('hex')
}

function generateCertificateNumber(type) {
  const prefix = String(type).slice(0, 3).toUpperCase()
  const year = new Date().getFullYear()
  const suffix = crypto.randomBytes(3).toString('hex').toUpperCase()
  return `${PLATFORM_PREFIX}-${prefix}-${year}-${suffix}`
}

function defaultTitle(type) {
  return CERTIFICATE_TYPES[type] || 'School Certificate'
}

function formatCertificate(cert) {
  return {
    id: cert.id,
    certificateType: cert.certificateType,
    type: cert.certificateType,
    title: cert.title,
    recipientName: cert.recipientName,
    studentId: cert.studentId,
    employeeId: cert.employeeId,
    student: cert.student
      ? {
          id: cert.student.id,
          admissionNo: cert.student.admissionNo,
          firstName: cert.student.user?.firstName,
          lastName: cert.student.user?.lastName,
        }
      : null,
    description: cert.description,
    sessionLabel: cert.sessionLabel,
    className: cert.className,
    metadata: cert.metadata,
    certificateNumber: cert.certificateNumber,
    verifyCode: cert.verifyCode,
    issuedAt: cert.issuedAt,
    revokedAt: cert.revokedAt,
    status: cert.status,
    source: 'school',
  }
}

function formatVerifyPayload(certificate, school) {
  return {
    valid: certificate.status === 'active',
    source: 'school',
    certificateType: certificate.certificateType,
    title: certificate.title,
    certificateNumber: certificate.certificateNumber,
    recipientName: certificate.recipientName,
    studentName: certificate.recipientName,
    schoolName: school?.name,
    description: certificate.description,
    sessionLabel: certificate.sessionLabel,
    className: certificate.className,
    metadata: certificate.metadata,
    issuedAt: certificate.issuedAt,
    revoked: certificate.status === 'revoked',
  }
}

async function certificateStatsForSchool(prisma, schoolId) {
  const [total, graduation, attendance, excellence, revoked] = await Promise.all([
    prisma.schoolCertificate.count({ where: { schoolId, status: 'active' } }),
    prisma.schoolCertificate.count({ where: { schoolId, status: 'active', certificateType: 'graduation' } }),
    prisma.schoolCertificate.count({ where: { schoolId, status: 'active', certificateType: 'attendance' } }),
    prisma.schoolCertificate.count({ where: { schoolId, status: 'active', certificateType: 'excellence' } }),
    prisma.schoolCertificate.count({ where: { schoolId, status: 'revoked' } }),
  ])
  return { total, graduation, attendance, excellence, revoked }
}

module.exports = {
  CERTIFICATE_TYPES,
  resolveSchoolId,
  generateVerifyCode,
  generateCertificateNumber,
  defaultTitle,
  formatCertificate,
  formatVerifyPayload,
  certificateStatsForSchool,
  checkTenantAccess,
}
