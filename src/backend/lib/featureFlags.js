const { mergeLimits } = require('./planLimits')

let flagCache = { at: 0, items: [] }
const CACHE_MS = 60_000

async function loadFlags(prisma) {
  const now = Date.now()
  if (now - flagCache.at < CACHE_MS && flagCache.items.length) {
    return flagCache.items
  }
  const items = await prisma.featureFlag.findMany({ orderBy: { key: 'asc' } })
  flagCache = { at: now, items }
  return items
}

function clearFlagCache() {
  flagCache = { at: 0, items: [] }
}

function isFlagEnabledForPlan(flag, planSlug) {
  if (!flag?.enabled) return false
  if (!flag.planSlugs?.length) return true
  return flag.planSlugs.includes(planSlug)
}

async function isFeatureEnabled(prisma, key, { planSlug } = {}) {
  const flags = await loadFlags(prisma)
  const flag = flags.find((f) => f.key === key)
  if (!flag) return true
  return isFlagEnabledForPlan(flag, planSlug || '')
}

async function assertModuleAccess(prisma, subscription, moduleKey) {
  const limits = mergeLimits(subscription?.plan)
  const slug = subscription?.plan?.slug || ''
  const moduleEnabled = limits[moduleKey]
  if (!moduleEnabled) {
    const { minimumPlanForFeature } = require('./planLimits')
    const required = minimumPlanForFeature(moduleKey)
    return {
      allowed: false,
      reason: `${moduleKey} not included in your plan`,
      code: 'FEATURE_NOT_AVAILABLE',
      requiredPlan: required,
      upgradeMessage: `Upgrade to ${required.charAt(0).toUpperCase() + required.slice(1)} to unlock this feature`,
    }
  }
  const flagOk = await isFeatureEnabled(prisma, moduleKey, { planSlug: slug })
  if (!flagOk) {
    return { allowed: false, reason: `${moduleKey} is disabled platform-wide`, code: 'FEATURE_DISABLED' }
  }
  return { allowed: true }
}

function createFeatureGuard(prisma, moduleKey) {
  return async (req, res, next) => {
    if (req.user?.role === 'SuperAdmin') return next()
    try {
      const sub = req.subscription || (req.user?.schoolId
        ? await prisma.schoolSubscription.findUnique({
            where: { schoolId: req.user.schoolId },
            include: { plan: true },
          })
        : null)
      const check = await assertModuleAccess(prisma, sub, moduleKey)
      if (!check.allowed) {
        return res.status(403).json({
          error: check.reason,
          code: check.code || 'FEATURE_NOT_AVAILABLE',
          requiredPlan: check.requiredPlan,
          upgradeMessage: check.upgradeMessage,
        })
      }
      next()
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  }
}

module.exports = {
  loadFlags,
  clearFlagCache,
  isFeatureEnabled,
  isFlagEnabledForPlan,
  assertModuleAccess,
  createFeatureGuard,
}
