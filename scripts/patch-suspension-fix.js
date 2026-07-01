const fs = require('fs')
const path = require('path')
const root = path.join(__dirname, '..')

const authPath = path.join(root, 'src/backend/routes/authRoutes.js')
let auth = fs.readFileSync(authPath, 'utf8')
auth = auth.replace(
  "const access = await require('../lib/subscriptionHelpers').evaluateSchoolAccess(prisma, user.schoolId, { persist: true })",
  'const access = await evaluateSchoolAccess(prisma, user.schoolId, { persist: true })'
)
const loginBlock = `      if (user.schoolId && user.role?.name !== 'SuperAdmin') {
        const access = await evaluateSchoolAccess(prisma, user.schoolId, { persist: true })
        if (!access.allowed) {
          return res.status(403).json({ error: access.error, code: access.code })
        }
      }

`
if (!auth.includes("Invalid authentication code' })\n\n      if (user.schoolId")) {
  auth = auth.replace(
    "      if (!valid) return res.status(401).json({ error: 'Invalid authentication code' })\n\n      await clearFailedLogins(prisma, user.id)",
    `      if (!valid) return res.status(401).json({ error: 'Invalid authentication code' })\n\n${loginBlock}      await clearFailedLogins(prisma, user.id)`
  )
}
fs.writeFileSync(authPath, auth)

const serverPath = path.join(root, 'src/backend/server.js')
let server = fs.readFileSync(serverPath, 'utf8')
if (!server.includes('registerSchoolSuspendRoutes')) {
  server = server.replace(
    "const { registerSaasRoutes } = require('./routes/saasRoutes')",
    "const { registerSchoolSuspendRoutes } = require('./routes/schoolSuspendRoutes')\nconst { registerSaasRoutes } = require('./routes/saasRoutes')"
  )
  server = server.replace(
    'registerSaasPhoneOtpRoutes(app, { prisma })\nregisterSaasRoutes(app, { prisma, requireRole, enqueueEmail })',
    'registerSaasPhoneOtpRoutes(app, { prisma })\nregisterSchoolSuspendRoutes(app, { prisma, requireRole })\nregisterSaasRoutes(app, { prisma, requireRole, enqueueEmail })'
  )
}
fs.writeFileSync(serverPath, server)

console.log('Auth 2FA + school suspend route wired.')
