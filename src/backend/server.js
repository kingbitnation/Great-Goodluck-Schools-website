const path = require('path')
const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const jwt = require('jsonwebtoken')
require('dotenv').config()

const { installProductionSafeConsole } = require('./lib/safeLogger')
installProductionSafeConsole()

const { assertProductionSecrets } = require('./lib/securityConfig')
if (process.env.NODE_ENV === 'production') {
  assertProductionSecrets()
}

const prisma = require('./prismaClient')
const { registerAuthRoutes } = require('./routes/authRoutes')
const { registerResourceRoutes } = require('./routes/resourceRoutes')
const { registerCompatRoutes } = require('./routes/compatRoutes')
const { registerCbtRoutes } = require('./routes/cbtRoutes')
const { registerAnalyticsRoutes } = require('./routes/analyticsRoutes')
const { registerFinanceRoutes } = require('./routes/financeRoutes')
const { registerEmailRoutes } = require('./routes/emailRoutes')
const { enqueueEmail, queueFeeReminders } = require('./lib/emailQueue')
const { startQueueWorker } = require('./lib/queueWorker')
const { dispatchNotification } = require('./lib/notificationDispatcher')
const { buildHealthReport } = require('./lib/monitoring')
const { createRateLimiter, authRateLimiter, auditLogger } = require('./middleware/security')
const { createTenantGuard } = require('./middleware/tenantGuard')
const { registerSchoolSuspendRoutes } = require('./routes/schoolSuspendRoutes')
const { registerSaasRoutes } = require('./routes/saasRoutes')
const { registerLmsRoutes } = require('./routes/lmsRoutes')
const { registerLiveClassRoutes } = require('./routes/liveClassRoutes')
const { registerResultsRoutes } = require('./routes/resultsRoutes')
const { registerAiRoutes } = require('./routes/aiRoutes')
const { registerAdmissionRoutes } = require('./routes/admissionRoutes')
const { registerHrRoutes } = require('./routes/hrRoutes')
const { registerPayrollRoutes } = require('./routes/payrollRoutes')
const { registerLibraryRoutes } = require('./routes/libraryRoutes')
const { registerHostelRoutes } = require('./routes/hostelRoutes')
const { registerTransportRoutes } = require('./routes/transportRoutes')
const { registerBiometricRoutes } = require('./routes/biometricRoutes')
const { registerCertificateRoutes } = require('./routes/certificateRoutes')
const { registerIdCardRoutes } = require('./routes/idCardRoutes')
const { registerAlumniRoutes } = require('./routes/alumniRoutes')
const { registerMarketplaceRoutes } = require('./routes/marketplaceRoutes')
const { registerPublicRoutes } = require('./routes/publicRoutes')
const { registerPublicAdminRoutes } = require('./routes/publicAdminRoutes')
const { registerNotificationRoutes } = require('./routes/notificationRoutes')
const { registerSystemRoutes } = require('./routes/systemRoutes')
const { registerPlatformRoutes } = require('./routes/platformRoutes')
const { registerBillingRoutes } = require('./routes/billingRoutes')
const { registerDeveloperRoutes } = require('./routes/developerRoutes')
const { registerCalendarRoutes } = require('./routes/calendarRoutes')
const { registerDocumentRoutes } = require('./routes/documentRoutes')
const { registerOAuthRoutes, registerPaymentGatewayRoutes } = require('./routes/oauthRoutes')
const { registerImportRoutes } = require('./routes/importRoutes')
const { registerOtpRoutes } = require('./routes/otpRoutes')
const { registerSaasRegistrationHooks } = require('./lib/saasRegistrationHooks')
const { registerSaasPhoneOtpRoutes } = require('./routes/saasPhoneOtpRoutes')
const { registerEnterpriseRoutes } = require('./routes/enterpriseRoutes')
const { createModuleFeatureGuard } = require('./middleware/moduleFeatureGuard')
const { csrfProtection, registerCsrfRoute } = require('./middleware/csrf')
const { recordUsage } = require('./lib/platformHelpers')
const app = express()
if (process.env.TRUST_PROXY === 'true' || process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1)
}
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  hsts: process.env.NODE_ENV === 'production'
    ? { maxAge: 31536000, includeSubDomains: true, preload: true }
    : false,
}))
app.use(cors({ origin: true, credentials: true }))
app.use(express.json({
  limit: process.env.JSON_BODY_LIMIT || '15mb',
  verify: (req, _res, buf) => {
    const webhookPaths = ['/api/webhooks/paystack', '/api/webhooks/flutterwave', '/api/webhooks/stripe']
    if (webhookPaths.includes(req.originalUrl)) req.rawBody = buf
  },
}))
app.use('/uploads', express.static(path.join(__dirname, '../uploads')))
app.use(createRateLimiter())

function parseCookies(req) {
  const header = req.headers.cookie
  if (!header) return {}
  return header.split(';').map(c => c.trim()).reduce((acc, pair) => {
    const [k, v] = pair.split('=')
    acc[k] = decodeURIComponent(v)
    return acc
  }, {})
}

app.get('/api/health/live', (req, res) => {
  res.json({ status: 'ok', backend: 'running' })
})

app.get('/api/health/ready', async (req, res) => {
  try {
    const report = await buildHealthReport(prisma)
    if (!report.db) return res.status(503).json({ ...report, status: 'not_ready' })
    res.json({ ...report, status: 'ready' })
  } catch {
    res.status(503).json({ status: 'not_ready', backend: 'running', db: false })
  }
})

app.get('/api/health', async (req, res) => {
  try {
    const detailed = req.query.detailed === 'true'
    const report = await buildHealthReport(prisma, { detailed })
    if (!report.db) return res.status(503).json(report)
    res.json(report)
  } catch {
    res.status(503).json({ status: 'degraded', backend: 'running', db: false })
  }
})

app.get('/api/docs/openapi.yaml', (_req, res) => {
  res.type('text/yaml').sendFile(path.join(__dirname, '../../docs/openapi.yaml'))
})

const { requireRole, requirePermission } = registerAuthRoutes(app, {
  prisma,
  authRateLimiter,
  enqueueEmail,
  parseCookies,
})

registerCsrfRoute(app)

const moduleFeatureGuard = createModuleFeatureGuard(prisma)

const { requireActiveSchool, enforceStudentLimit } = createTenantGuard(prisma)

function attachUserIfPresent(req, res, next) {
  const auth = req.headers.authorization
  if (auth) {
    const parts = auth.split(' ')
    if (parts.length === 2) {
      try {
        req.user = jwt.verify(parts[1], JWT_SECRET)
      } catch {
        // ignore invalid token for optional attach
      }
    }
  }
  next()
}

app.use(attachUserIfPresent)
app.use(csrfProtection)
app.use(auditLogger(prisma))

app.use((req, res, next) => {
  if (req.user?.schoolId && req.path.startsWith('/api/')) {
    recordUsage(prisma, req.user.schoolId, { apiRequests: 1 }).catch(() => {})
  }
  next()
})

app.use(moduleFeatureGuard)

app.use((req, res, next) => {
  const openPaths = ['/api/health', '/api/auth/', '/api/public/', '/api/otp/', '/api/webhooks/', '/api/oauth/', '/api/docs/']
  if (!req.path.startsWith('/api/')) return next()
  if (openPaths.some((p) => req.path.startsWith(p))) return next()
  if (!req.user || req.user.role === 'SuperAdmin') return next()
  return requireActiveSchool(req, res, next)
})

registerBillingRoutes(app, { prisma, requireRole, enqueueEmail, dispatchNotification })
registerSaasRegistrationHooks(app, { prisma, enqueueEmail })
registerSaasPhoneOtpRoutes(app, { prisma })
registerSchoolSuspendRoutes(app, { prisma, requireRole })
registerSaasRoutes(app, { prisma, requireRole, enqueueEmail })
registerOtpRoutes(app, { prisma, authRateLimiter, enqueueEmail })
registerCertificateRoutes(app, { prisma, requireRole })
registerIdCardRoutes(app, { prisma, requireRole })
registerLmsRoutes(app, { prisma, requireRole })
registerLiveClassRoutes(app, { prisma, requireRole })
registerResultsRoutes(app, { prisma, requireRole })
registerAiRoutes(app, { prisma, requireRole })
registerAdmissionRoutes(app, { prisma, requireRole, enqueueEmail })
registerHrRoutes(app, { prisma, requireRole, enqueueEmail })
registerPayrollRoutes(app, { prisma, requireRole, enqueueEmail })
registerLibraryRoutes(app, { prisma, requireRole, enqueueEmail })
registerHostelRoutes(app, { prisma, requireRole })
registerTransportRoutes(app, { prisma, requireRole })
registerBiometricRoutes(app, { prisma, requireRole })
registerAlumniRoutes(app, { prisma, requireRole })
registerMarketplaceRoutes(app, { prisma, requireRole })
registerPublicRoutes(app, { prisma })
registerPublicAdminRoutes(app, { prisma, requireRole })
registerNotificationRoutes(app, { prisma, requireRole, requirePermission })
registerSystemRoutes(app, { prisma, requireRole })
registerPlatformRoutes(app, { prisma, requireRole })
registerDeveloperRoutes(app, { prisma, requireRole })
registerCalendarRoutes(app, { prisma, requireRole })
registerDocumentRoutes(app, { prisma, requireRole })
registerOAuthRoutes(app, { prisma, requireRole })
registerPaymentGatewayRoutes(app, { prisma, requireRole, dispatchNotification })
registerImportRoutes(app, { prisma, requireRole, enforceStudentLimit })
registerEnterpriseRoutes(app, { prisma, requireRole, dispatchNotification })
registerCompatRoutes(app, { prisma, requireRole })
registerResourceRoutes(app, { prisma, requireRole, requirePermission, enqueueEmail, enforceStudentLimit })
registerFinanceRoutes(app, { prisma, requireRole, requirePermission, enqueueEmail })
registerCbtRoutes(app, { prisma, requireRole })
registerAnalyticsRoutes(app, { prisma, requireRole })
registerEmailRoutes(app, { prisma, requireRole, requirePermission })

startQueueWorker(30000)

// Daily fee reminder sweep at server start + every 24h
async function runFeeReminderSweep() {
  try {
    const schools = await prisma.school.findMany({ where: { status: 'active' }, select: { id: true } })
    for (const school of schools) {
      await queueFeeReminders(prisma, school.id)
    }
  } catch (err) {
    console.error('Fee reminder sweep error:', err)
  }
}
runFeeReminderSweep()
setInterval(runFeeReminderSweep, 24 * 60 * 60 * 1000)

const { startSubscriptionJobs } = require('./lib/subscriptionJobs')
const { startGoogleCalendarSyncJob } = require('./lib/googleCalendarSync')
startSubscriptionJobs(prisma, { dispatchNotification })
startGoogleCalendarSyncJob(prisma)

app.post('/api/public/contact', async (req, res) => {
  const { name, email, message } = req.body
  if (!name || !email || !message) return res.status(400).json({ error: 'All fields required' })
  try {
    const admin = await prisma.user.findFirst({ where: { role: { name: 'SuperAdmin' } } })
    if (admin) {
      await dispatchNotification(prisma, {
        userId: admin.id,
        type: 'contact',
        title: `Contact from ${name}`,
        body: `${email}: ${message}`,
        payload: { name, email, message },
        email: admin.email,
        emailTemplate: 'contact_form',
        emailPayload: { name, email, message },
        channels: ['in_app', 'email'],
      })
    }
    res.json({ message: 'Message received' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

const port = process.env.PORT || 4000
app.listen(port, () => {
  console.log(`Backend server running on http://localhost:${port}`)
  console.log(`Health check: http://localhost:${port}/api/health`)
})


