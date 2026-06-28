const {
  resolveSchoolId,
  generateDonationReference,
  formatAlumni,
  formatEvent,
  formatDonation,
  formatMentorship,
  alumniStatsForSchool,
  resolveAlumniForUser,
  checkTenantAccess,
} = require('../lib/alumniHelpers')
const { dispatchToUsers } = require('../lib/notificationDispatcher')
const { schoolBankDetails } = require('../lib/manualPaymentHelpers')

function registerAlumniRoutes(app, { prisma, requireRole }) {
  const adminRoles = ['SuperAdmin', 'SchoolAdmin']
  const alumniRoles = ['Alumni', ...adminRoles]

  async function eventRsvpCount(eventId) {
    return prisma.alumniEventRsvp.count({ where: { eventId, status: 'going' } })
  }

  // ===== PUBLIC =====
  app.get('/api/public/alumni/school', async (req, res) => {
    try {
      let school = null
      if (req.query.schoolId) {
        school = await prisma.school.findFirst({
          where: { id: String(req.query.schoolId), status: 'active' },
          select: { id: true, name: true },
        })
      }
      if (!school) {
        school = await prisma.school.findFirst({
          where: { status: 'active' },
          orderBy: { createdAt: 'asc' },
          select: { id: true, name: true },
        })
      }
      if (!school) return res.status(404).json({ error: 'School not found' })
      res.json(school)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.get('/api/public/alumni/directory', async (req, res) => {
    try {
      const schoolId = req.query.schoolId
      if (!schoolId) return res.json([])
      const q = req.query.q ? String(req.query.q) : ''
      const profiles = await prisma.alumniProfile.findMany({
        where: {
          schoolId: String(schoolId),
          status: 'active',
          isPublic: true,
          ...(q
            ? {
                OR: [
                  { firstName: { contains: q, mode: 'insensitive' } },
                  { lastName: { contains: q, mode: 'insensitive' } },
                  { company: { contains: q, mode: 'insensitive' } },
                  { currentRole: { contains: q, mode: 'insensitive' } },
                ],
              }
            : {}),
        },
        orderBy: [{ graduationYear: 'desc' }, { lastName: 'asc' }],
        take: Math.min(Number(req.query.limit) || 100, 200),
      })
      res.json(profiles.map(formatAlumni))
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.get('/api/public/alumni/events', async (req, res) => {
    try {
      const schoolId = req.query.schoolId
      if (!schoolId) return res.json([])
      const events = await prisma.alumniEvent.findMany({
        where: { schoolId: String(schoolId), isPublic: true, status: 'published', eventDate: { gte: new Date() } },
        orderBy: { eventDate: 'asc' },
        take: 20,
      })
      const withCounts = await Promise.all(
        events.map(async (e) => formatEvent(e, await eventRsvpCount(e.id)))
      )
      res.json(withCounts)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  // ===== STATS =====
  app.get('/api/alumni/stats', requireRole(...adminRoles), async (req, res) => {
    try {
      const schoolId = resolveSchoolId(req)
      if (!schoolId) return res.status(400).json({ error: 'School required' })
      res.json(await alumniStatsForSchool(prisma, schoolId))
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  // ===== PROFILES =====
  app.get('/api/alumni/profiles', requireRole(...adminRoles, 'Alumni'), async (req, res) => {
    try {
      const schoolId = resolveSchoolId(req)
      const where = schoolId ? { schoolId } : {}
      if (req.query.q) {
        const q = String(req.query.q)
        where.OR = [
          { firstName: { contains: q, mode: 'insensitive' } },
          { lastName: { contains: q, mode: 'insensitive' } },
          { email: { contains: q, mode: 'insensitive' } },
        ]
      }
      const profiles = await prisma.alumniProfile.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 200,
      })
      res.json(profiles.map(formatAlumni))
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.get('/api/alumni/me', requireRole('Alumni'), async (req, res) => {
    try {
      const profile = await resolveAlumniForUser(prisma, req.user.userId || req.user.id)
      res.json(profile ? formatAlumni(profile) : null)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.post('/api/alumni/join', async (req, res) => {
    try {
      const { schoolId, firstName, lastName, email, phone, graduationYear, className, company, currentRole, bio, openToMentor } = req.body
      if (!schoolId || !firstName || !lastName || !email) {
        return res.status(400).json({ error: 'School, name, and email required' })
      }
      const profile = await prisma.alumniProfile.upsert({
        where: { schoolId_email: { schoolId, email: email.toLowerCase() } },
        update: {
          firstName,
          lastName,
          phone: phone || null,
          graduationYear: graduationYear != null ? Number(graduationYear) : undefined,
          className: className || undefined,
          company: company || undefined,
          currentRole: currentRole || undefined,
          bio: bio || undefined,
          openToMentor: openToMentor === true,
        },
        create: {
          schoolId,
          firstName,
          lastName,
          email: email.toLowerCase(),
          phone: phone || null,
          graduationYear: graduationYear != null ? Number(graduationYear) : null,
          className: className || null,
          company: company || null,
          currentRole: currentRole || null,
          bio: bio || null,
          openToMentor: openToMentor === true,
        },
      })
      res.status(201).json(formatAlumni(profile))
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.post('/api/alumni/profiles', requireRole(...adminRoles), async (req, res) => {
    try {
      const schoolId = resolveSchoolId(req)
      if (!schoolId) return res.status(400).json({ error: 'School required' })
      const profile = await prisma.alumniProfile.create({
        data: {
          schoolId,
          firstName: req.body.firstName,
          lastName: req.body.lastName,
          email: req.body.email.toLowerCase(),
          phone: req.body.phone || null,
          graduationYear: req.body.graduationYear != null ? Number(req.body.graduationYear) : null,
          className: req.body.className || null,
          degree: req.body.degree || null,
          currentRole: req.body.currentRole || null,
          company: req.body.company || null,
          city: req.body.city || null,
          country: req.body.country || null,
          bio: req.body.bio || null,
          linkedinUrl: req.body.linkedinUrl || null,
          openToMentor: req.body.openToMentor === true,
          isPublic: req.body.isPublic !== false,
        },
      })
      res.status(201).json(formatAlumni(profile))
    } catch (err) {
      if (err.code === 'P2002') return res.status(400).json({ error: 'Email already registered' })
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.put('/api/alumni/profiles/:id', requireRole(...adminRoles, 'Alumni'), async (req, res) => {
    try {
      const existing = await prisma.alumniProfile.findUnique({ where: { id: req.params.id } })
      if (!existing) return res.status(404).json({ error: 'Not found' })
      if (req.user.role === 'Alumni') {
        const mine = await resolveAlumniForUser(prisma, req.user.userId || req.user.id)
        if (!mine || mine.id !== existing.id) return res.status(403).json({ error: 'Forbidden' })
      } else if (!checkTenantAccess(req, existing.schoolId)) {
        return res.status(403).json({ error: 'Forbidden' })
      }
      const profile = await prisma.alumniProfile.update({
        where: { id: existing.id },
        data: {
          phone: req.body.phone,
          currentRole: req.body.currentRole,
          company: req.body.company,
          city: req.body.city,
          country: req.body.country,
          bio: req.body.bio,
          linkedinUrl: req.body.linkedinUrl,
          openToMentor: req.body.openToMentor,
          isPublic: req.body.isPublic,
        },
      })
      res.json(formatAlumni(profile))
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  // ===== EVENTS =====
  app.get('/api/alumni/events', requireRole(...alumniRoles, 'Student', 'Parent'), async (req, res) => {
    try {
      const schoolId = resolveSchoolId(req)
      if (!schoolId) return res.json([])
      const events = await prisma.alumniEvent.findMany({
        where: { schoolId },
        orderBy: { eventDate: 'asc' },
      })
      const result = await Promise.all(events.map(async (e) => formatEvent(e, await eventRsvpCount(e.id))))
      res.json(result)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.post('/api/alumni/events', requireRole(...adminRoles), async (req, res) => {
    try {
      const schoolId = resolveSchoolId(req)
      if (!schoolId) return res.status(400).json({ error: 'School required' })
      const event = await prisma.alumniEvent.create({
        data: {
          schoolId,
          title: req.body.title,
          description: req.body.description || null,
          venue: req.body.venue || null,
          eventDate: new Date(req.body.eventDate),
          endDate: req.body.endDate ? new Date(req.body.endDate) : null,
          capacity: req.body.capacity != null ? Number(req.body.capacity) : null,
          isPublic: req.body.isPublic !== false,
          status: req.body.status || 'published',
        },
      })
      res.status(201).json(formatEvent(event, 0))
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.post('/api/alumni/events/:id/rsvp', requireRole('Alumni'), async (req, res) => {
    try {
      const alumni = await resolveAlumniForUser(prisma, req.user.userId || req.user.id)
      if (!alumni) return res.status(400).json({ error: 'Alumni profile required' })
      const event = await prisma.alumniEvent.findUnique({ where: { id: req.params.id } })
      if (!event || event.schoolId !== alumni.schoolId) return res.status(404).json({ error: 'Event not found' })
      if (event.capacity) {
        const count = await eventRsvpCount(event.id)
        if (count >= event.capacity) return res.status(400).json({ error: 'Event is full' })
      }
      const rsvp = await prisma.alumniEventRsvp.upsert({
        where: { eventId_alumniId: { eventId: event.id, alumniId: alumni.id } },
        update: { status: 'going', guests: Number(req.body.guests) || 1 },
        create: { eventId: event.id, alumniId: alumni.id, guests: Number(req.body.guests) || 1 },
      })
      res.json(rsvp)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.delete('/api/alumni/events/:id/rsvp', requireRole('Alumni'), async (req, res) => {
    try {
      const alumni = await resolveAlumniForUser(prisma, req.user.userId || req.user.id)
      if (!alumni) return res.status(400).json({ error: 'Alumni profile required' })
      await prisma.alumniEventRsvp.deleteMany({ where: { eventId: req.params.id, alumniId: alumni.id } })
      res.json({ message: 'RSVP cancelled' })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  // ===== DONATIONS =====
  app.get('/api/alumni/donations', requireRole(...adminRoles), async (req, res) => {
    try {
      const schoolId = resolveSchoolId(req)
      const donations = await prisma.alumniDonation.findMany({
        where: schoolId ? { schoolId } : {},
        include: { alumni: true },
        orderBy: { createdAt: 'desc' },
        take: 200,
      })
      res.json(donations.map(formatDonation))
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.post('/api/alumni/donations/checkout', async (req, res) => {
    try {
      const { schoolId, donorName, donorEmail, amount, message, alumniId } = req.body
      if (!schoolId || !donorName || !donorEmail || !amount) {
        return res.status(400).json({ error: 'Missing donation fields' })
      }
      const payAmount = Number(amount)
      if (payAmount < 100) return res.status(400).json({ error: 'Minimum donation is 100' })

      const school = await prisma.school.findUnique({
        where: { id: schoolId },
        select: { name: true, bankName: true, bankAccountName: true, bankAccountNumber: true },
      })
      if (!school) return res.status(404).json({ error: 'School not found' })
      if (!school.bankAccountNumber?.trim()) {
        return res.status(400).json({
          error: 'School bank account is not configured. Add bank details in Admin → School branding.',
        })
      }

      const reference = generateDonationReference(schoolId)

      const donation = await prisma.alumniDonation.create({
        data: {
          schoolId,
          alumniId: alumniId || null,
          donorName,
          donorEmail,
          amount: payAmount,
          gateway: 'manual',
          reference,
          message: message || null,
          status: 'pending',
        },
      })

      res.json({
        donationId: donation.id,
        reference,
        manual: true,
        bankDetails: schoolBankDetails(school, { amount: payAmount, reference }),
        message: 'Transfer the donation using the reference below. The school will confirm receipt.',
      })
    } catch (err) {
      console.error(err)
      res.status(400).json({ error: err.message || 'Checkout failed' })
    }
  })

  app.post('/api/alumni/donations/:id/upload-receipt', async (req, res) => {
    try {
      const { fileBase64, mimeType, donorEmail } = req.body
      if (!fileBase64) return res.status(400).json({ error: 'fileBase64 required' })
      if (!donorEmail) return res.status(400).json({ error: 'donorEmail required' })

      const donation = await prisma.alumniDonation.findUnique({ where: { id: req.params.id } })
      if (!donation) return res.status(404).json({ error: 'Donation not found' })
      if (donation.donorEmail.toLowerCase() !== String(donorEmail).toLowerCase()) {
        return res.status(403).json({ error: 'Email does not match donation' })
      }
      if (donation.gateway !== 'manual') {
        return res.status(400).json({ error: 'Receipt upload only for manual donations' })
      }

      const { storeReceiptUpload } = require('../lib/receiptUploadHelpers')
      const receiptUrl = await storeReceiptUpload({ fileBase64, mimeType, folder: 'alumni-donations' })

      const updated = await prisma.alumniDonation.update({
        where: { id: donation.id },
        data: { receiptUrl, status: donation.status === 'pending' ? 'pending' : donation.status },
      })

      res.json({
        ...formatDonation(updated),
        message: 'Receipt uploaded. The school will confirm your donation after review.',
      })
    } catch (err) {
      console.error(err)
      res.status(400).json({ error: err.message || 'Upload failed' })
    }
  })

  app.post('/api/alumni/donations/verify', async (req, res) => {
    try {
      const { reference } = req.body
      if (!reference) return res.status(400).json({ error: 'Reference required' })

      const donation = await prisma.alumniDonation.findUnique({ where: { reference } })
      if (!donation) return res.status(404).json({ error: 'Donation not found' })

      res.json({
        ...formatDonation(donation),
        message: donation.status === 'pending'
          ? 'Donation pending confirmation after bank transfer.'
          : 'Donation recorded.',
      })
    } catch (err) {
      console.error(err)
      res.status(400).json({ error: err.message || 'Verification failed' })
    }
  })

  app.post('/api/alumni/donations/:id/confirm', requireRole(...adminRoles), async (req, res) => {
    try {
      const donation = await prisma.alumniDonation.findUnique({ where: { id: req.params.id } })
      if (!donation) return res.status(404).json({ error: 'Donation not found' })
      if (!checkTenantAccess(req, donation.schoolId)) return res.status(403).json({ error: 'Forbidden' })
      if (donation.status === 'completed') return res.json(formatDonation(donation))

      const updated = await prisma.alumniDonation.update({
        where: { id: donation.id },
        data: { status: 'completed', paidAt: new Date() },
        include: { alumni: true },
      })

      const admins = await prisma.user.findMany({
        where: { schoolId: donation.schoolId, role: { name: 'SchoolAdmin' }, isActive: true },
        select: { id: true },
      })
      if (admins.length) {
        await dispatchToUsers(
          prisma,
          admins.map((a) => a.id),
          {
            schoolId: donation.schoolId,
            type: 'payment',
            title: 'Alumni donation confirmed',
            body: `₦${updated.amount.toLocaleString()} from ${updated.donorName} marked as received.`,
            payload: { donationId: updated.id, reference: updated.reference },
            channels: ['in_app'],
          }
        )
      }

      res.json(formatDonation(updated))
    } catch (err) {
      console.error(err)
      res.status(400).json({ error: err.message || 'Confirm failed' })
    }
  })

  app.post('/api/alumni/donations/:id/reject', requireRole(...adminRoles), async (req, res) => {
    try {
      const { note } = req.body
      const donation = await prisma.alumniDonation.findUnique({ where: { id: req.params.id } })
      if (!donation) return res.status(404).json({ error: 'Donation not found' })
      if (!checkTenantAccess(req, donation.schoolId)) return res.status(403).json({ error: 'Forbidden' })

      const updated = await prisma.alumniDonation.update({
        where: { id: donation.id },
        data: { status: 'rejected', message: note ? `${donation.message || ''}\n[Rejected: ${note}]`.trim() : donation.message },
        include: { alumni: true },
      })
      res.json(formatDonation(updated))
    } catch (err) {
      console.error(err)
      res.status(400).json({ error: err.message || 'Reject failed' })
    }
  })

  // ===== MENTORSHIP =====
  app.get('/api/alumni/mentors', requireRole(...alumniRoles, 'Student'), async (req, res) => {
    try {
      const schoolId = resolveSchoolId(req)
      if (!schoolId) return res.json([])
      const mentors = await prisma.alumniProfile.findMany({
        where: { schoolId, status: 'active', openToMentor: true, isPublic: true },
        orderBy: { lastName: 'asc' },
      })
      res.json(mentors.map(formatAlumni))
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.get('/api/alumni/mentorships', requireRole(...adminRoles, 'Alumni', 'Student'), async (req, res) => {
    try {
      const schoolId = resolveSchoolId(req)
      const where = schoolId ? { schoolId } : {}
      if (req.user.role === 'Alumni') {
        const alumni = await resolveAlumniForUser(prisma, req.user.userId || req.user.id)
        if (alumni) where.OR = [{ mentorId: alumni.id }, { menteeAlumniId: alumni.id }]
      }
      if (req.user.role === 'Student') {
        const student = await prisma.student.findUnique({ where: { userId: req.user.userId || req.user.id } })
        if (student) where.menteeStudentId = student.id
      }
      const items = await prisma.alumniMentorship.findMany({
        where,
        include: { mentor: true, menteeAlumni: true },
        orderBy: { createdAt: 'desc' },
      })
      res.json(items.map(formatMentorship))
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.post('/api/alumni/mentorships', requireRole('Alumni', 'Student', ...adminRoles), async (req, res) => {
    try {
      const { mentorId, menteeName, menteeEmail, focusArea, notes } = req.body
      if (!mentorId || !menteeName || !menteeEmail) {
        return res.status(400).json({ error: 'Mentor and mentee details required' })
      }
      const mentor = await prisma.alumniProfile.findUnique({ where: { id: mentorId } })
      if (!mentor || !mentor.openToMentor) return res.status(404).json({ error: 'Mentor not available' })

      let menteeAlumniId = null
      let menteeStudentId = null
      if (req.user.role === 'Alumni') {
        const alumni = await resolveAlumniForUser(prisma, req.user.userId || req.user.id)
        menteeAlumniId = alumni?.id || null
      } else if (req.user.role === 'Student') {
        const student = await prisma.student.findUnique({ where: { userId: req.user.userId || req.user.id } })
        menteeStudentId = student?.id || null
      }

      const mentorship = await prisma.alumniMentorship.create({
        data: {
          schoolId: mentor.schoolId,
          mentorId,
          menteeAlumniId,
          menteeStudentId,
          menteeName,
          menteeEmail,
          focusArea: focusArea || null,
          notes: notes || null,
          status: 'pending',
        },
        include: { mentor: true, menteeAlumni: true },
      })
      res.status(201).json(formatMentorship(mentorship))
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.post('/api/alumni/mentorships/:id/status', requireRole(...adminRoles, 'Alumni'), async (req, res) => {
    try {
      const { status } = req.body
      if (!['pending', 'active', 'completed', 'declined'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status' })
      }
      const existing = await prisma.alumniMentorship.findUnique({
        where: { id: req.params.id },
        include: { mentor: true, menteeAlumni: true },
      })
      if (!existing) return res.status(404).json({ error: 'Not found' })

      if (req.user.role === 'Alumni') {
        const alumni = await resolveAlumniForUser(prisma, req.user.userId || req.user.id)
        if (!alumni || alumni.id !== existing.mentorId) return res.status(403).json({ error: 'Forbidden' })
      } else if (!checkTenantAccess(req, existing.schoolId)) {
        return res.status(403).json({ error: 'Forbidden' })
      }

      const updated = await prisma.alumniMentorship.update({
        where: { id: existing.id },
        data: {
          status,
          matchedAt: status === 'active' && !existing.matchedAt ? new Date() : undefined,
        },
        include: { mentor: true, menteeAlumni: true },
      })
      res.json(formatMentorship(updated))
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })
}

module.exports = { registerAlumniRoutes }
