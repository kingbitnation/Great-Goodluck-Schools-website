const bcrypt = require('bcrypt')
const crypto = require('crypto')
const { assertSameSchool } = require('../middleware/tenantGuard')
const { platformBankDetails } = require('../lib/manualPaymentHelpers')
const { priceForInterval, resolvePlanSlug } = require('../lib/planLimits')
const { uploadFile } = require('../lib/uploadHelpers')
const {
  findReferralCode,
  recordReferralConversion,
  processReferralReward,
  applyCoupon,
  billingPeriodEnd,
  activateSubscription,
} = require('../lib/referralHelpers')
const { approveManualSubscriptionPayment } = require('../lib/subscriptionHelpers')
const { streamSubscriptionInvoicePdf } = require('../lib/subscriptionInvoicePdf')
const {
  startDomainVerification,
  confirmDomainVerification,
} = require('../lib/domainHelpers')

const APP_URL = process.env.APP_URL || 'http://localhost:3000'

const phoneVerifications = new Map()

function normalizeNgPhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '')
  if (!digits) return null
  if (digits.startsWith('234') && digits.length >= 12) return `+${digits}`
  if (digits.startsWith('0') && digits.length === 11) return `+234${digits.slice(1)}`
  if (digits.length === 10) return `+234${digits}`
  return null
}

function validateRegistrationPassword(password) {
  if (!password || password.length < 8) return 'Password must be at least 8 characters'
  if (!/[a-z]/.test(password)) return 'Password must include a lowercase letter'
  if (!/[A-Z]/.test(password)) return 'Password must include an uppercase letter'
  if (!/\d/.test(password)) return 'Password must include a number'
  if (!/[^A-Za-z0-9]/.test(password)) return 'Password must include a special character'
  return null
}

function generateRef(prefix) {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`
}

function registerSaasRoutes(app, { prisma, requireRole, enqueueEmail }) {
  // ===== PUBLIC SCHOOL REGISTRATION =====
  app.get('/api/public/schools/register/quote', async (req, res) => {
    try {
      const planSlug = resolvePlanSlug(String(req.query.planSlug || req.query.plan || 'standard'))
      const billingInterval = ['monthly', 'quarterly', 'yearly'].includes(req.query.interval)
        ? req.query.interval
        : 'monthly'
      const plan = await prisma.subscriptionPlan.findFirst({
        where: { slug: planSlug, isActive: true, isArchived: false },
        include: { planFeatures: { orderBy: { sortOrder: 'asc' } } },
      })
      if (!plan) return res.status(404).json({ error: 'Plan not found' })
      if (plan.contactSales) {
        return res.json({
          plan: { name: plan.name, slug: plan.slug, contactSales: true },
          contactSales: true,
        })
      }
      const amount = priceForInterval(plan, billingInterval)
      const reference = generateRef('REG')
      res.json({
        plan: {
          id: plan.id,
          name: plan.name,
          slug: plan.slug,
          maxStudents: plan.maxStudents,
          trialDays: plan.trialDays || 14,
          planFeatures: plan.planFeatures,
        },
        billingInterval,
        amount,
        currency: plan.currency || 'NGN',
        reference,
        bankDetails: platformBankDetails({ amount, reference }),
      })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.post('/api/public/schools/register/phone/send', async (req, res) => {
    try {
      const phone = normalizeNgPhone(req.body.phone)
      if (!phone) return res.status(400).json({ error: 'Enter a valid Nigerian phone number' })

      const code = String(Math.floor(100000 + Math.random() * 900000))
      const verificationToken = crypto.randomBytes(24).toString('hex')
      phoneVerifications.set(phone, {
        code,
        verificationToken,
        expiresAt: Date.now() + 10 * 60 * 1000,
      })

      let smsSent = false
      try {
        const { enqueueSms } = require('../lib/smsQueue')
        await enqueueSms({
          to: phone,
          body: `Your SchoolPilot verification code is ${code}. Valid for 10 minutes.`,
          template: 'general',
          payload: { message: `Your SchoolPilot verification code is ${code}` },
        })
        smsSent = true
      } catch (smsErr) {
        console.warn('SMS send failed:', smsErr.message)
      }

      const payload = { message: smsSent ? 'Verification code sent' : 'SMS not configured — use the code shown below (dev only)' }
      if (!smsSent || process.env.NODE_ENV !== 'production') {
        payload.devCode = code
      }
      res.json(payload)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Could not send verification code' })
    }
  })

  app.post('/api/public/schools/register/phone/verify', async (req, res) => {
    try {
      const phone = normalizeNgPhone(req.body.phone)
      const { code } = req.body
      if (!phone || !code) return res.status(400).json({ error: 'Phone and code required' })

      const entry = phoneVerifications.get(phone)
      if (!entry || entry.expiresAt < Date.now()) {
        return res.status(400).json({ error: 'Code expired — request a new one' })
      }
      if (String(code).trim() !== entry.code) {
        return res.status(400).json({ error: 'Incorrect verification code' })
      }

      res.json({ verified: true, phoneVerificationToken: entry.verificationToken })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Verification failed' })
    }
  })

  app.post('/api/public/schools/register/upload', async (req, res) => {
    const { fileBase64, documentType, originalName } = req.body
    if (!fileBase64) return res.status(400).json({ error: 'fileBase64 required' })
    try {
      const result = await uploadFile({
        fileBase64,
        folder: 'school-registration',
        originalName,
      })
      res.json({
        url: result.url,
        documentType: documentType || 'other',
        fileName: originalName || null,
      })
    } catch (err) {
      res.status(400).json({ error: err.message || 'Upload failed' })
    }
  })

  app.post('/api/public/schools/register', async (req, res) => {
    const {
      schoolName, adminFirstName, adminLastName, adminEmail, adminPhone,
      address, city, country, proposedPlanSlug, billingInterval = 'monthly',
      password, referralCode, paymentReference, paymentAmount, paymentReceiptUrl,
      verificationDocuments, registrationNumber, phoneVerificationToken,
    } = req.body

    if (!schoolName || !adminFirstName || !adminLastName || !adminEmail || !password) {
      return res.status(400).json({ error: 'Required fields missing' })
    }
    if (!address?.trim()) {
      return res.status(400).json({ error: 'School address is required' })
    }
    const phone = normalizeNgPhone(adminPhone)
    if (!phone) return res.status(400).json({ error: 'Valid admin phone number is required' })
    if (!phoneVerificationToken) {
      return res.status(400).json({ error: 'Verify your phone number before registering' })
    }
    const phoneEntry = phoneVerifications.get(phone)
    if (!phoneEntry || phoneEntry.verificationToken !== phoneVerificationToken || phoneEntry.expiresAt < Date.now()) {
      return res.status(400).json({ error: 'Phone verification expired — verify again' })
    }
    const passwordError = validateRegistrationPassword(password)
    if (passwordError) return res.status(400).json({ error: passwordError })
    if (!paymentReference?.trim()) {
      return res.status(400).json({ error: 'Bank transfer payment reference is required' })
    }
    if (!paymentReceiptUrl?.trim()) {
      return res.status(400).json({ error: 'Upload your bank transfer receipt or screenshot' })
    }
    const docs = Array.isArray(verificationDocuments) ? verificationDocuments : []
    if (docs.length < 1) {
      return res.status(400).json({ error: 'Upload at least one document proving your school exists (e.g. CAC certificate, government approval)' })
    }
    if (!docs.every((d) => d?.url)) {
      return res.status(400).json({ error: 'Each verification document must include a URL' })
    }

    const planSlug = resolvePlanSlug(proposedPlanSlug || 'standard')
    const interval = ['monthly', 'quarterly', 'yearly'].includes(billingInterval) ? billingInterval : 'monthly'

    try {
      const existingUser = await prisma.user.findUnique({ where: { email: adminEmail } })
      if (existingUser) return res.status(400).json({ error: 'Email already registered' })

      const pending = await prisma.schoolRegistration.findFirst({
        where: { adminEmail, status: 'pending' },
      })
      if (pending) return res.status(400).json({ error: 'Application already pending review' })

      const plan = await prisma.subscriptionPlan.findFirst({
        where: { slug: planSlug, isActive: true, isArchived: false },
      })
      if (!plan) return res.status(400).json({ error: 'Selected plan is not available' })
      if (plan.contactSales) {
        return res.status(400).json({ error: 'Contact sales for Ultimate plan — use the contact page' })
      }

      const expectedAmount = priceForInterval(plan, interval)
      const paidAmount = Number(paymentAmount) || expectedAmount

      const registration = await prisma.schoolRegistration.create({
        data: {
          schoolName,
          adminFirstName,
          adminLastName,
          adminEmail,
          adminPhone: phone,
          city: city || null,
          country: country || 'Nigeria',
          proposedPlanSlug: planSlug,
          billingInterval: interval,
          paymentReference: String(paymentReference).trim(),
          paymentAmount: paidAmount,
          paymentStatus: 'submitted',
          paymentReceiptUrl: String(paymentReceiptUrl).trim(),
          verificationDocuments: docs,
          registrationNumber: registrationNumber?.trim() || null,
          referralCode: referralCode ? String(referralCode).toUpperCase() : null,
          status: 'pending',
        },
      })

      const schoolAdminRole = await prisma.role.findUnique({ where: { name: 'SchoolAdmin' } })

      const school = await prisma.school.create({
        data: {
          name: schoolName,
          address: String(address).trim(),
          city: city || null,
          country: country || 'Nigeria',
          contactEmail: adminEmail,
          contactPhone: phone,
          status: 'trial',
          primaryColor: '#2563eb',
          secondaryColor: '#0f172a',
        },
      })

      await prisma.schoolRegistration.update({
        where: { id: registration.id },
        data: { schoolId: school.id },
      })

      await prisma.schoolOnboarding.create({ data: { schoolId: school.id } })

      const invoiceRef = generateRef('SUB')
      const invoice = await prisma.subscriptionInvoice.create({
        data: {
          schoolId: school.id,
          planId: plan.id,
          amount: paidAmount,
          currency: plan.currency || 'NGN',
          reference: invoiceRef,
          gateway: 'manual',
          billingInterval: interval,
          dueAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          metadata: { source: 'registration', registrationId: registration.id },
        },
      })

      const paymentRef = generateRef('MAN')
      await prisma.subscriptionPayment.create({
        data: {
          schoolId: school.id,
          invoiceId: invoice.id,
          amount: paidAmount,
          gateway: 'manual',
          reference: paymentRef,
          status: 'under_review',
          proofUrl: String(paymentReceiptUrl).trim(),
          metadata: {
            registrationId: registration.id,
            payerReference: String(paymentReference).trim(),
            verificationDocuments: docs,
          },
        },
      })

      await prisma.schoolSubscription.create({
        data: {
          schoolId: school.id,
          planId: plan.id,
          status: 'trial',
          billingInterval: interval,
          trialEndsAt: new Date(Date.now() + (plan.trialDays || 14) * 24 * 60 * 60 * 1000),
        },
      })

      if (referralCode) {
        const ref = await findReferralCode(prisma, referralCode)
        if (ref) await recordReferralConversion(prisma, ref, school.id)
      }

      if (schoolAdminRole) {
        await prisma.user.create({
          data: {
            email: adminEmail,
            password: await bcrypt.hash(password, 10),
            firstName: adminFirstName,
            lastName: adminLastName,
            roleId: schoolAdminRole.id,
            schoolId: school.id,
            isActive: true,
            emailVerified: false,
          },
        })
      }

      phoneVerifications.delete(phone)

      const superAdmins = await prisma.user.findMany({
        where: { role: { name: 'SuperAdmin' } },
        select: { email: true },
      })
      for (const admin of superAdmins) {
        if (enqueueEmail) {
          await enqueueEmail({
            to: admin.email,
            subject: `New school registration: ${schoolName}`,
            body: `${adminFirstName} ${adminLastName} (${adminEmail}) registered ${schoolName} on ${plan.name} (${interval}). Payment ref: ${paymentReference}. Review documents in Super Admin → Schools.`,
            template: 'admission_application',
            payload: {
              studentName: schoolName,
              parentName: `${adminFirstName} ${adminLastName}`,
              email: adminEmail,
              phone: adminPhone,
              grade: planSlug,
              message: `Payment ref: ${paymentReference}`,
            },
          })
        }
      }

      res.status(201).json({
        message: 'School registered. Complete setup while we verify your payment and documents.',
        registrationId: registration.id,
        schoolId: school.id,
        loginEmail: adminEmail,
      })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  // ===== SUPER ADMIN: REGISTRATIONS =====
  app.get('/api/school-registrations', requireRole('SuperAdmin'), async (req, res) => {
    try {
      const { status } = req.query
      const where = status ? { status: String(status) } : {}
      const items = await prisma.schoolRegistration.findMany({
        where,
        include: { school: { include: { subscription: { include: { plan: true } } } } },
        orderBy: { createdAt: 'desc' },
      })

      const enriched = await Promise.all(items.map(async (reg) => {
        let subscriptionPayment = null
        if (reg.schoolId) {
          subscriptionPayment = await prisma.subscriptionPayment.findFirst({
            where: {
              schoolId: reg.schoolId,
              status: { in: ['pending', 'under_review', 'approved', 'rejected'] },
            },
            orderBy: { createdAt: 'desc' },
          })
        }
        return {
          ...reg,
          subscriptionPaymentId: subscriptionPayment?.id || null,
          paymentReviewStatus: subscriptionPayment?.status || null,
          proofUrl: subscriptionPayment?.proofUrl || reg.paymentReceiptUrl || null,
        }
      }))

      res.json(enriched)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.post('/api/schools/:id/approve', requireRole('SuperAdmin'), async (req, res) => {
    try {
      const school = await prisma.school.findUnique({ where: { id: req.params.id } })
      if (!school) return res.status(404).json({ error: 'School not found' })

      const registration = await prisma.schoolRegistration.findFirst({
        where: { schoolId: school.id },
      })

      const pendingPayment = await prisma.subscriptionPayment.findFirst({
        where: {
          schoolId: school.id,
          status: { in: ['pending', 'under_review'] },
        },
        orderBy: { createdAt: 'desc' },
      })
      if (pendingPayment) {
        await approveManualSubscriptionPayment(prisma, pendingPayment.id, req.user.userId)
      }

      await prisma.school.update({
        where: { id: school.id },
        data: { status: 'active', approvedAt: new Date(), approvedById: req.user.userId },
      })

      if (registration) {
        await prisma.schoolRegistration.update({
          where: { id: registration.id },
          data: {
            status: 'approved',
            paymentStatus: 'verified',
            reviewedById: req.user.userId,
            reviewedAt: new Date(),
          },
        })
        await prisma.user.updateMany({
          where: { email: registration.adminEmail, schoolId: school.id },
          data: { isActive: true },
        })
        if (enqueueEmail) {
          await enqueueEmail({
            to: registration.adminEmail,
            template: 'admission_confirmation',
            payload: {
              parentName: registration.adminFirstName,
              studentName: school.name,
              grade: 'School Admin',
            },
            schoolId: school.id,
          })
        }
      }

      await processReferralReward(prisma, school.id).catch((err) => {
        console.error('Referral reward error:', err.message)
      })

      res.json({ message: 'School approved', schoolId: school.id })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.post('/api/schools/:id/reject', requireRole('SuperAdmin'), async (req, res) => {
    try {
      const { note } = req.body
      const school = await prisma.school.findUnique({ where: { id: req.params.id } })
      if (!school) return res.status(404).json({ error: 'School not found' })

      await prisma.school.update({
        where: { id: school.id },
        data: { status: 'suspended' },
      })

      const registration = await prisma.schoolRegistration.findFirst({ where: { schoolId: school.id } })
      if (registration) {
        await prisma.schoolRegistration.update({
          where: { id: registration.id },
          data: { status: 'rejected', reviewNote: note || null, reviewedById: req.user.userId, reviewedAt: new Date() },
        })
      }

      res.json({ message: 'School registration rejected' })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.post('/api/schools/:id/suspend', requireRole('SuperAdmin'), async (req, res) => {
    try {
      await prisma.school.update({ where: { id: req.params.id }, data: { status: 'suspended' } })
      res.json({ message: 'School suspended' })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.post('/api/schools/:id/reactivate', requireRole('SuperAdmin'), async (req, res) => {
    try {
      const { reactivateSchool } = require('../lib/subscriptionHelpers')
      await reactivateSchool(prisma, req.params.id, { extendDays: 14, performedById: req.user.userId })
      await prisma.school.update({
        where: { id: req.params.id },
        data: { status: 'active' },
      })
      res.json({ message: 'School unsuspended' })
    } catch (err) {
      console.error(err)
      res.status(400).json({ error: err.message || 'Could not reactivate school' })
    }
  })

  // ===== ONBOARDING WIZARD =====
  app.get('/api/schools/:id/onboarding', requireRole('SuperAdmin', 'SchoolAdmin'), async (req, res) => {
    try {
      if (!assertSameSchool(req.user, req.params.id)) {
        return res.status(403).json({ error: 'Forbidden' })
      }
      let onboarding = await prisma.schoolOnboarding.findUnique({ where: { schoolId: req.params.id } })
      if (!onboarding) {
        onboarding = await prisma.schoolOnboarding.create({ data: { schoolId: req.params.id } })
      }
      const school = await prisma.school.findUnique({
        where: { id: req.params.id },
        include: { subscription: { include: { plan: true } } },
      })
      res.json({ onboarding, school })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.put('/api/schools/:id/onboarding', requireRole('SuperAdmin', 'SchoolAdmin'), async (req, res) => {
    try {
      if (!assertSameSchool(req.user, req.params.id)) {
        return res.status(403).json({ error: 'Forbidden' })
      }
      const { profileDone, brandingDone, subscriptionDone, usersDone } = req.body
      const data = {}
      if (profileDone != null) data.profileDone = Boolean(profileDone)
      if (brandingDone != null) data.brandingDone = Boolean(brandingDone)
      if (subscriptionDone != null) data.subscriptionDone = Boolean(subscriptionDone)
      if (usersDone != null) data.usersDone = Boolean(usersDone)

      const allDone = (profileDone ?? true) && (brandingDone ?? true) && (subscriptionDone ?? true) && (usersDone ?? true)
      if (allDone) data.completedAt = new Date()

      const onboarding = await prisma.schoolOnboarding.upsert({
        where: { schoolId: req.params.id },
        update: data,
        create: { schoolId: req.params.id, ...data },
      })

      if (onboarding.completedAt) {
        await prisma.school.update({
          where: { id: req.params.id },
          data: { setupCompleted: true },
        })
      }

      res.json(onboarding)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  // ===== BRANDING =====
  app.get('/api/schools/:id/branding', requireRole('SuperAdmin', 'SchoolAdmin'), async (req, res) => {
    try {
      if (!assertSameSchool(req.user, req.params.id)) {
        return res.status(403).json({ error: 'Forbidden' })
      }
      const school = await prisma.school.findUnique({ where: { id: req.params.id } })
      if (!school) return res.status(404).json({ error: 'School not found' })
      res.json({
        schoolId: school.id,
        name: school.name,
        logo: school.logo,
        primaryColor: school.primaryColor,
        secondaryColor: school.secondaryColor,
        customDomain: school.customDomain,
        bankName: school.bankName,
        bankAccountName: school.bankAccountName,
        bankAccountNumber: school.bankAccountNumber,
      })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.put('/api/schools/:id/branding', requireRole('SuperAdmin', 'SchoolAdmin'), async (req, res) => {
    try {
      if (!assertSameSchool(req.user, req.params.id)) {
        return res.status(403).json({ error: 'Forbidden' })
      }
      const { logo, primaryColor, secondaryColor, customDomain, bankName, bankAccountName, bankAccountNumber, name } = req.body

      if (customDomain) {
        const clash = await prisma.school.findFirst({
          where: { customDomain, NOT: { id: req.params.id } },
        })
        if (clash) return res.status(400).json({ error: 'Domain already in use' })
      }

      const school = await prisma.school.update({
        where: { id: req.params.id },
        data: {
          logo: logo ?? undefined,
          primaryColor: primaryColor ?? undefined,
          secondaryColor: secondaryColor ?? undefined,
          customDomain: customDomain ?? undefined,
          bankName: bankName ?? undefined,
          bankAccountName: bankAccountName ?? undefined,
          bankAccountNumber: bankAccountNumber ?? undefined,
          name: name ?? undefined,
        },
      })

      await prisma.schoolOnboarding.updateMany({
        where: { schoolId: school.id },
        data: { brandingDone: true, profileDone: true },
      })

      res.json(school)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  // ===== CUSTOM DOMAIN VERIFICATION =====
  app.get('/api/schools/:id/domains', requireRole('SuperAdmin', 'SchoolAdmin'), async (req, res) => {
    try {
      if (!assertSameSchool(req.user, req.params.id)) return res.status(403).json({ error: 'Forbidden' })
      const records = await prisma.customDomainRecord.findMany({
        where: { schoolId: req.params.id },
        orderBy: { createdAt: 'desc' },
      })
      res.json(records)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.post('/api/schools/:id/domains', requireRole('SuperAdmin', 'SchoolAdmin'), async (req, res) => {
    try {
      if (!assertSameSchool(req.user, req.params.id)) return res.status(403).json({ error: 'Forbidden' })
      const { domain } = req.body
      const result = await startDomainVerification(prisma, req.params.id, domain)
      res.status(201).json(result)
    } catch (err) {
      console.error(err)
      res.status(400).json({ error: err.message || 'Domain setup failed' })
    }
  })

  app.post('/api/schools/:id/domains/:recordId/verify', requireRole('SuperAdmin', 'SchoolAdmin'), async (req, res) => {
    try {
      if (!assertSameSchool(req.user, req.params.id)) return res.status(403).json({ error: 'Forbidden' })
      const record = await confirmDomainVerification(prisma, req.params.id, req.params.recordId)
      res.json(record)
    } catch (err) {
      console.error(err)
      res.status(400).json({ error: err.message || 'Verification failed' })
    }
  })

  // Public resolve by custom domain
  app.get('/api/public/school-by-domain', async (req, res) => {
    try {
      const { domain } = req.query
      if (!domain) return res.status(400).json({ error: 'domain required' })
      const school = await prisma.school.findFirst({
        where: { customDomain: String(domain), status: 'active' },
        select: { id: true, name: true, logo: true, primaryColor: true, secondaryColor: true },
      })
      if (!school) return res.status(404).json({ error: 'School not found' })
      res.json(school)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  // ===== SUBSCRIPTION BILLING =====
  app.post('/api/schools/:id/subscription/checkout', requireRole('SuperAdmin', 'SchoolAdmin'), async (req, res) => {
    try {
      if (!assertSameSchool(req.user, req.params.id)) {
        return res.status(403).json({ error: 'Forbidden' })
      }
      const { planSlug, billingInterval = 'monthly', couponCode } = req.body
      const gateway = 'manual'
      const plan = await prisma.subscriptionPlan.findUnique({ where: { slug: planSlug } })
      if (!plan) return res.status(404).json({ error: 'Plan not found' })

      const school = await prisma.school.findUnique({ where: { id: req.params.id } })
      const reference = generateRef('SUB')

      let amount = priceForInterval(plan, billingInterval)
      const couponResult = await applyCoupon(prisma, couponCode, plan.slug, amount)
      amount = couponResult.amount

      const invoice = await prisma.subscriptionInvoice.create({
        data: {
          schoolId: school.id,
          planId: plan.id,
          amount,
          currency: plan.currency,
          reference,
          gateway,
          billingInterval,
        },
      })

      if (couponResult.coupon) {
        await prisma.billingCoupon.update({
          where: { id: couponResult.coupon.id },
          data: { usedCount: { increment: 1 } },
        })
        await prisma.schoolSubscription.updateMany({
          where: { schoolId: school.id },
          data: { couponCode: couponResult.coupon.code },
        })
      }

      const payment = await prisma.subscriptionPayment.create({
        data: {
          schoolId: school.id,
          invoiceId: invoice.id,
          amount,
          gateway: 'manual',
          reference: generateRef('MAN'),
          status: 'pending',
        },
      })

      res.json({
        invoiceId: invoice.id,
        paymentId: payment.id,
        reference: payment.reference,
        plan,
        billingInterval,
        amount,
        discount: couponResult.discount,
        bankDetails: platformBankDetails({ amount, reference: payment.reference }),
        manual: true,
      })
    } catch (err) {
      console.error(err)
      res.status(400).json({ error: err.message || 'Checkout failed' })
    }
  })

  app.post('/api/subscription/verify', requireRole('SuperAdmin', 'SchoolAdmin'), async (_req, res) => {
    res.status(400).json({
      error: 'Online payment verification is disabled. Use bank transfer and submit proof for review.',
    })
  })

  app.get('/api/schools/:id/subscription', requireRole('SuperAdmin', 'SchoolAdmin'), async (req, res) => {
    try {
      if (!assertSameSchool(req.user, req.params.id)) {
        return res.status(403).json({ error: 'Forbidden' })
      }
      const sub = await prisma.schoolSubscription.findUnique({
        where: { schoolId: req.params.id },
        include: { plan: true },
      })
      const invoices = await prisma.subscriptionInvoice.findMany({
        where: { schoolId: req.params.id },
        orderBy: { createdAt: 'desc' },
        take: 10,
      })
      const studentCount = await prisma.student.count({ where: { schoolId: req.params.id } })
      res.json({ subscription: sub, invoices, studentCount })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.post('/api/schools/:id/subscription/cancel', requireRole('SuperAdmin', 'SchoolAdmin'), async (req, res) => {
    try {
      if (!assertSameSchool(req.user, req.params.id)) return res.status(403).json({ error: 'Forbidden' })
      const sub = await prisma.schoolSubscription.update({
        where: { schoolId: req.params.id },
        data: { status: 'cancelled', cancelledAt: new Date() },
      })
      res.json(sub)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.get('/api/subscription/invoices/:id/pdf', requireRole('SuperAdmin', 'SchoolAdmin'), async (req, res) => {
    try {
      const invoice = await prisma.subscriptionInvoice.findUnique({
        where: { id: req.params.id },
        include: { plan: true, school: true },
      })
      if (!invoice) return res.status(404).json({ error: 'Invoice not found' })
      if (!assertSameSchool(req.user, invoice.schoolId)) return res.status(403).json({ error: 'Forbidden' })
      streamSubscriptionInvoicePdf(res, { school: invoice.school, invoice, plan: invoice.plan })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

}

module.exports = { registerSaasRoutes }
