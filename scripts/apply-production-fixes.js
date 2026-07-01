#!/usr/bin/env node
/** Apply locked-file patches. Run: node scripts/apply-production-fixes.js */
const fs = require('fs')
const path = require('path')

const root = path.join(__dirname, '..')

function patch(file, replacements) {
  const fp = path.join(root, file)
  if (!fs.existsSync(fp)) return
  let src = fs.readFileSync(fp, 'utf8')
  let changed = false
  for (const [from, to] of replacements) {
    if (src.includes(from) && !src.includes(to.slice(0, Math.min(60, to.length)))) {
      src = src.replace(from, to)
      changed = true
    }
  }
  if (changed) {
    fs.writeFileSync(fp, src)
    console.log('Patched', file)
  }
}

patch('src/backend/server.js', [
  [
    "const { registerImportRoutes } = require('./routes/importRoutes')\nconst { registerEnterpriseRoutes }",
    "const { registerImportRoutes } = require('./routes/importRoutes')\nconst { registerOtpRoutes } = require('./routes/otpRoutes')\nconst { registerEnterpriseRoutes }",
  ],
  [
    "'/api/public/', '/api/webhooks/'",
    "'/api/public/', '/api/otp/', '/api/webhooks/'",
  ],
])

const phoneSendOld = `  app.post('/api/public/schools/register/phone/send', async (req, res) => {`
if (fs.existsSync(path.join(root, 'src/backend/routes/saasRoutes.js'))) {
  let saas = fs.readFileSync(path.join(root, 'src/backend/routes/saasRoutes.js'), 'utf8')
  if (saas.includes('Math.floor(100000 + Math.random() * 900000)')) {
    const { authRateLimiter } = require('../src/backend/middleware/security')
    // inject authRateLimiter at top of register function - use inline require in route instead
    const phoneBlock = `  const { authRateLimiter } = require('../middleware/security')

  app.post('/api/public/schools/register/phone/send', authRateLimiter, async (req, res) => {
    try {
      const phone = normalizeNgPhone(req.body.phone)
      if (!phone) return res.status(400).json({ error: 'Enter a valid Nigerian phone number' })
      const { resolveSmsConfig } = require('../lib/smsQueue')
      const { sendSms } = require('../lib/smsProviders')
      const result = await sendOtp(prisma, {
        destination: phone,
        channel: 'sms',
        purpose: 'phone_verification',
        ipAddress: req.ip,
        sendSms: async ({ to, message }) => {
          const smsConfig = await resolveSmsConfig(null)
          if (!smsConfig.smsEnabled) throw Object.assign(new Error('SMS is not configured'), { code: 'SMS_NOT_CONFIGURED' })
          await sendSms({ provider: smsConfig.smsProvider, config: smsConfig, to, message })
        },
      })
      res.json({
        message: 'Verification code sent to your phone',
        sessionToken: result.sessionToken,
        phoneVerificationToken: result.sessionToken,
        expiresInMinutes: result.expiresInMinutes,
      })
    } catch (err) {
      const status = err.code === 'RATE_LIMITED' ? 429 : err.code === 'SMS_NOT_CONFIGURED' ? 503 : 500
      console.error(err)
      res.status(status).json({ error: err.message || 'Could not send verification code', code: err.code })
    }
  })

  app.post('/api/public/schools/register/phone/verify', authRateLimiter, async (req, res) => {
    try {
      const phone = normalizeNgPhone(req.body.phone)
      const { code, sessionToken } = req.body
      const token = sessionToken || req.body.phoneVerificationToken
      if (!phone || !code) return res.status(400).json({ error: 'Phone and code required' })
      if (token) {
        const verified = await verifyOtp(prisma, { sessionToken: token, code, ipAddress: req.ip })
        if (verified.destination !== phone) return res.status(400).json({ error: 'Phone does not match verification session' })
        return res.json({ verified: true, phoneVerificationToken: token, sessionToken: token })
      }
      const entry = phoneVerifications.get(phone)
      if (!entry || entry.expiresAt < Date.now()) return res.status(400).json({ error: 'Code expired — request a new one' })
      if (String(code).trim() !== entry.code) return res.status(400).json({ error: 'Incorrect verification code' })
      res.json({ verified: true, phoneVerificationToken: entry.verificationToken, sessionToken: entry.verificationToken })
    } catch (err) {
      console.error(err)
      res.status(400).json({ error: err.message || 'Verification failed', code: err.code })
    }
  })`

    const start = saas.indexOf('  app.post(\'/api/public/schools/register/phone/send\'')
    const end = saas.indexOf('  app.post(\'/api/public/schools/register/upload\'')
    if (start >= 0 && end > start) {
      saas = saas.slice(0, start) + phoneBlock + '\n\n' + saas.slice(end)
      fs.writeFileSync(path.join(root, 'src/backend/routes/saasRoutes.js'), saas)
      console.log('Patched saasRoutes phone OTP')
    }
  }

  // Registration verify + applicant email
  patch('src/backend/routes/saasRoutes.js', [
    [
      `    const phoneEntry = phoneVerifications.get(phone)
    if (!phoneEntry || phoneEntry.verificationToken !== phoneVerificationToken || phoneEntry.expiresAt < Date.now()) {
      return res.status(400).json({ error: 'Phone verification expired — verify again' })
    }`,
      `    try {
      await assertVerifiedSession(prisma, phoneVerificationToken, 'phone_verification', phone)
    } catch (verifyErr) {
      const phoneEntry = phoneVerifications.get(phone)
      if (!phoneEntry || phoneEntry.verificationToken !== phoneVerificationToken || phoneEntry.expiresAt < Date.now()) {
        return res.status(400).json({ error: verifyErr.message || 'Phone verification expired — verify again' })
      }
    }`,
    ],
    [
      `      res.status(201).json({
        message: 'School registered. Complete setup while we verify your payment and documents.',
        registrationId: registration.id,
        schoolId: school.id,
        loginEmail: adminEmail,
      })`,
      `      if (enqueueEmail) {
        await enqueueEmail({
          to: adminEmail,
          template: 'school_registration_received',
          payload: {
            firstName: adminFirstName,
            schoolName,
            planName: plan.name,
            reference: paymentReference,
          },
        }).catch((e) => console.error('Registration email error:', e.message))
      }

      res.status(201).json({
        message: 'School registered. Complete setup while we verify your payment and documents.',
        registrationId: registration.id,
        schoolId: school.id,
        loginEmail: adminEmail,
      })`,
    ],
    [
      `          await enqueueEmail({
            to: registration.adminEmail,
            template: 'admission_confirmation',
            payload: {
              parentName: registration.adminFirstName,
              studentName: school.name,
              grade: 'School Admin',
            },
            schoolId: school.id,
          })`,
      `          await enqueueEmail({
            to: registration.adminEmail,
            template: 'school_approved',
            payload: {
              firstName: registration.adminFirstName,
              schoolName: school.name,
              loginEmail: registration.adminEmail,
            },
          })`,
    ],
  ])
}

patch('docs/env.example', [
  ['SMTP_FROM=SchoolPilot <noreply@yourdomain.com>', 'SMTP_FROM_NAME=SchoolPilot\nSMTP_FROM=SchoolPilot <noreply@yourdomain.com>'],
])

console.log('Done.')
