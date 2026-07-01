const { assertVerifiedSession } = require('../lib/otpService')
const { schoolRegistrationReceived, schoolApproved } = require('../lib/schoolEmailTemplates')

/**
 * Wraps school registration POST to validate OTP sessions and send SchoolPilot-branded emails.
 * Mounted before legacy saas register handler in server.js.
 */
function registerSaasRegistrationHooks(app, { prisma, enqueueEmail }) {
  app.use('/api/public/schools/register', async (req, res, next) => {
    if (req.method !== 'POST' || !req.body) return next()

    const { adminPhone, phoneVerificationToken, adminEmail, adminFirstName, schoolName, paymentReference, proposedPlanSlug } = req.body
    if (!phoneVerificationToken || !adminPhone) return next()

    const digits = String(adminPhone).replace(/\D/g, '')
    let phone = null
    if (digits.startsWith('234')) phone = `+${digits}`
    else if (digits.startsWith('0') && digits.length === 11) phone = `+234${digits.slice(1)}`
    else if (digits.length === 10) phone = `+234${digits}`

    if (!phone) return res.status(400).json({ error: 'Valid admin phone number is required' })

    try {
      await assertVerifiedSession(prisma, phoneVerificationToken, 'phone_verification', phone)
    } catch (err) {
      return res.status(400).json({ error: err.message || 'Phone verification expired — verify again' })
    }

    const originalJson = res.json.bind(res)
    res.json = async (body) => {
      if (res.statusCode >= 200 && res.statusCode < 300 && enqueueEmail && adminEmail) {
        const mail = schoolRegistrationReceived({
          firstName: adminFirstName,
          schoolName,
          planName: proposedPlanSlug || 'standard',
          reference: paymentReference,
        })
        await enqueueEmail({
          to: adminEmail,
          subject: mail.subject,
          body: mail.text,
          template: 'school_registration_received',
          payload: { firstName: adminFirstName, schoolName, planName: proposedPlanSlug, reference: paymentReference, htmlBody: mail.html },
        }).catch((e) => console.error('Registration email:', e.message))
      }
      return originalJson(body)
    }

    next()
  })

  app.use('/api/schools/:id/approve', async (req, res, next) => {
    if (req.method !== 'POST') return next()
    const originalJson = res.json.bind(res)
    res.json = async (body) => {
      if (res.statusCode >= 200 && res.statusCode < 300 && enqueueEmail) {
        try {
          const school = await prisma.school.findUnique({ where: { id: req.params.id } })
          const registration = await prisma.schoolRegistration.findFirst({ where: { schoolId: req.params.id } })
          if (registration?.adminEmail) {
            const mail = schoolApproved({
              firstName: registration.adminFirstName,
              schoolName: school?.name || registration.schoolName,
              loginEmail: registration.adminEmail,
            })
            await enqueueEmail({
              to: registration.adminEmail,
              subject: mail.subject,
              body: mail.text,
              template: 'school_approved',
              payload: {
                firstName: registration.adminFirstName,
                schoolName: school?.name,
                loginEmail: registration.adminEmail,
                htmlBody: mail.html,
              },
            })
          }
        } catch (e) {
          console.error('Approval email:', e.message)
        }
      }
      return originalJson(body)
    }
    next()
  })
}

module.exports = { registerSaasRegistrationHooks }
