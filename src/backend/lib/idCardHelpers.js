const crypto = require('crypto')
const { checkTenantAccess } = require('./tenantHelpers')

function resolveSchoolId(req) {
  if (req.user?.role === 'SuperAdmin' && req.query.schoolId) return String(req.query.schoolId)
  return req.user?.schoolId
}

function generateVerifyCode() {
  return crypto.randomBytes(10).toString('hex')
}

function generateCardNumber(cardType) {
  const prefix = cardType === 'staff' ? 'STF' : 'STU'
  const year = new Date().getFullYear()
  const suffix = crypto.randomBytes(3).toString('hex').toUpperCase()
  return `GGS-ID-${prefix}-${year}-${suffix}`
}

function defaultExpiry(years = 1) {
  const d = new Date()
  d.setFullYear(d.getFullYear() + years)
  return d
}

function isExpired(card) {
  return new Date(card.expiresAt) < new Date()
}

function effectiveStatus(card) {
  if (card.status === 'revoked') return 'revoked'
  if (isExpired(card)) return 'expired'
  return card.status
}

function formatIdCard(card) {
  const status = effectiveStatus(card)
  return {
    id: card.id,
    cardType: card.cardType,
    cardNumber: card.cardNumber,
    verifyCode: card.verifyCode,
    holderName: card.holderName,
    photoUrl: card.photoUrl,
    roleLabel: card.roleLabel,
    departmentOrClass: card.departmentOrClass,
    idNumber: card.idNumber,
    bloodType: card.bloodType,
    issuedAt: card.issuedAt,
    expiresAt: card.expiresAt,
    status,
    studentId: card.studentId,
    employeeId: card.employeeId,
    schoolName: card.school?.name,
  }
}

function formatVerifyPayload(card, school) {
  const status = effectiveStatus(card)
  return {
    valid: status === 'active',
    status,
    cardType: card.cardType,
    cardNumber: card.cardNumber,
    holderName: card.holderName,
    roleLabel: card.roleLabel,
    departmentOrClass: card.departmentOrClass,
    idNumber: card.idNumber,
    schoolName: school?.name,
    issuedAt: card.issuedAt,
    expiresAt: card.expiresAt,
    expired: status === 'expired',
    revoked: status === 'revoked',
  }
}

async function idCardStatsForSchool(prisma, schoolId) {
  const now = new Date()
  const [total, students, staff, expiringSoon, revoked] = await Promise.all([
    prisma.digitalIdCard.count({ where: { schoolId, status: 'active', expiresAt: { gte: now } } }),
    prisma.digitalIdCard.count({ where: { schoolId, cardType: 'student', status: 'active', expiresAt: { gte: now } } }),
    prisma.digitalIdCard.count({ where: { schoolId, cardType: 'staff', status: 'active', expiresAt: { gte: now } } }),
    prisma.digitalIdCard.count({
      where: {
        schoolId,
        status: 'active',
        expiresAt: { gte: now, lte: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) },
      },
    }),
    prisma.digitalIdCard.count({ where: { schoolId, status: 'revoked' } }),
  ])
  return { total, students, staff, expiringSoon, revoked }
}

module.exports = {
  resolveSchoolId,
  generateVerifyCode,
  generateCardNumber,
  defaultExpiry,
  effectiveStatus,
  formatIdCard,
  formatVerifyPayload,
  idCardStatsForSchool,
  checkTenantAccess,
}
