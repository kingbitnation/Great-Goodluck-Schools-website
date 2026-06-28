const crypto = require('crypto')
const { checkTenantAccess } = require('./tenantHelpers')

function resolveSchoolId(req) {
  if (req.user?.role === 'SuperAdmin' && (req.query.schoolId || req.body?.schoolId)) {
    return String(req.query.schoolId || req.body.schoolId)
  }
  return req.user?.schoolId || req.query.schoolId || null
}

function generateDonationReference(schoolId) {
  const suffix = crypto.randomBytes(4).toString('hex').toUpperCase()
  return `ALM-${String(schoolId).slice(0, 6)}-${suffix}`
}

function formatAlumni(profile) {
  return {
    id: profile.id,
    firstName: profile.firstName,
    lastName: profile.lastName,
    fullName: `${profile.firstName} ${profile.lastName}`,
    email: profile.email,
    phone: profile.phone,
    graduationYear: profile.graduationYear,
    className: profile.className,
    degree: profile.degree,
    currentRole: profile.currentRole,
    company: profile.company,
    city: profile.city,
    country: profile.country,
    bio: profile.bio,
    linkedinUrl: profile.linkedinUrl,
    photoUrl: profile.photoUrl,
    isPublic: profile.isPublic,
    openToMentor: profile.openToMentor,
    status: profile.status,
    createdAt: profile.createdAt,
  }
}

function formatEvent(event, rsvpCount = 0) {
  return {
    id: event.id,
    title: event.title,
    description: event.description,
    venue: event.venue,
    eventDate: event.eventDate,
    endDate: event.endDate,
    capacity: event.capacity,
    isPublic: event.isPublic,
    status: event.status,
    rsvpCount,
    createdAt: event.createdAt,
  }
}

function formatDonation(donation) {
  return {
    id: donation.id,
    donorName: donation.donorName,
    donorEmail: donation.donorEmail,
    amount: donation.amount,
    currency: donation.currency,
    gateway: donation.gateway,
    reference: donation.reference,
    status: donation.status,
    receiptUrl: donation.receiptUrl,
    message: donation.message,
    paidAt: donation.paidAt,
    createdAt: donation.createdAt,
    alumni: donation.alumni ? { id: donation.alumni.id, fullName: `${donation.alumni.firstName} ${donation.alumni.lastName}` } : null,
  }
}

function formatMentorship(m) {
  return {
    id: m.id,
    mentor: m.mentor ? formatAlumni(m.mentor) : null,
    menteeAlumni: m.menteeAlumni ? formatAlumni(m.menteeAlumni) : null,
    menteeStudentId: m.menteeStudentId,
    menteeName: m.menteeName,
    menteeEmail: m.menteeEmail,
    focusArea: m.focusArea,
    status: m.status,
    notes: m.notes,
    matchedAt: m.matchedAt,
    createdAt: m.createdAt,
  }
}

async function alumniStatsForSchool(prisma, schoolId) {
  const [members, mentors, events, donationsTotal, activeMentorships] = await Promise.all([
    prisma.alumniProfile.count({ where: { schoolId, status: 'active' } }),
    prisma.alumniProfile.count({ where: { schoolId, status: 'active', openToMentor: true } }),
    prisma.alumniEvent.count({ where: { schoolId, status: 'published' } }),
    prisma.alumniDonation.aggregate({
      where: { schoolId, status: 'completed' },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.alumniMentorship.count({ where: { schoolId, status: 'active' } }),
  ])
  return {
    members,
    mentors,
    events,
    donationsTotal: donationsTotal._sum.amount || 0,
    donationCount: donationsTotal._count,
    activeMentorships,
  }
}

async function resolveAlumniForUser(prisma, userId) {
  return prisma.alumniProfile.findUnique({ where: { userId } })
}

module.exports = {
  resolveSchoolId,
  generateDonationReference,
  formatAlumni,
  formatEvent,
  formatDonation,
  formatMentorship,
  alumniStatsForSchool,
  resolveAlumniForUser,
  checkTenantAccess,
}
