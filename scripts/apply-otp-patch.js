#!/usr/bin/env node
/** Apply OTP route registration to server.js if missing */
const fs = require('fs')
const path = require('path')

const file = path.join(__dirname, '../src/backend/server.js')
let src = fs.readFileSync(file, 'utf8')
let changed = false

if (!src.includes("registerOtpRoutes")) {
  src = src.replace(
    "const { registerImportRoutes } = require('./routes/importRoutes')",
    "const { registerImportRoutes } = require('./routes/importRoutes')\nconst { registerOtpRoutes } = require('./routes/otpRoutes')",
  )
  src = src.replace(
    'registerSaasRoutes(app, { prisma, requireRole, enqueueEmail })',
    'registerSaasRoutes(app, { prisma, requireRole, enqueueEmail })\nregisterOtpRoutes(app, { prisma, authRateLimiter, enqueueEmail })',
  )
  changed = true
}

if (!src.includes("'/api/otp/'")) {
  src = src.replace(
    "'/api/public/', '/api/webhooks/'",
    "'/api/public/', '/api/otp/', '/api/webhooks/'",
  )
  changed = true
}

if (src.includes("limit: '2mb'")) {
  src = src.replace("limit: '2mb'", "limit: process.env.JSON_BODY_LIMIT || '15mb'")
  changed = true
}

if (changed) {
  fs.writeFileSync(file, src)
  console.log('Applied OTP patches to server.js')
} else {
  console.log('server.js already patched')
}
