/**
 * Patches to apply when server.js is not locked:
 *
 * 1. Add: const { registerOtpRoutes } = require('./routes/otpRoutes')
 * 2. After registerSaasRoutes: registerOtpRoutes(app, { prisma, authRateLimiter, enqueueEmail })
 * 3. openPaths add '/api/otp/'
 * 4. JSON limit: process.env.JSON_BODY_LIMIT || '15mb'
 */
