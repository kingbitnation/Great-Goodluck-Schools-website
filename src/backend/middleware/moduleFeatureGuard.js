const { createFeatureGuard, assertModuleAccess } = require('../lib/featureFlags')

const MODULE_ROUTES = [
  { prefix: '/api/marketplace', key: 'marketplace' },
  { prefix: '/api/payroll', key: 'payroll' },
  { prefix: '/api/hostel', key: 'hostel' },
  { prefix: '/api/transport', key: 'transport' },
  { prefix: '/api/alumni', key: 'alumni' },
  { prefix: '/api/biometric', key: 'biometric' },
  { prefix: '/api/live-class', key: 'liveClasses' },
  { prefix: '/api/lms/', key: 'lms' },
  { prefix: '/api/admission', key: 'admission' },
  { prefix: '/api/hr/', key: 'hr' },
  { prefix: '/api/ai/', key: 'ai' },
  { prefix: '/api/cbt/', key: 'cbt' },
  { prefix: '/api/library', key: 'library' },
]

function createModuleFeatureGuard(prisma) {
  const guards = Object.fromEntries(
    MODULE_ROUTES.map(({ key }) => [key, createFeatureGuard(prisma, key)])
  )

  return async function moduleFeatureGuard(req, res, next) {
    if (req.user?.role === 'SuperAdmin') return next()
    const match = MODULE_ROUTES.find(({ prefix }) => req.path.startsWith(prefix))
    if (!match) return next()
    return guards[match.key](req, res, next)
  }
}

module.exports = { createModuleFeatureGuard, MODULE_ROUTES }
