/**
 * One-shot beta smoke — single login per role to avoid rate limits.
 */
const { request, login } = require('../tests/helpers/http')

const issues = []

function fail(area, detail) {
  issues.push({ severity: 'fail', area, detail })
  console.log(`FAIL [${area}] ${detail}`)
}

function warn(area, detail) {
  issues.push({ severity: 'warn', area, detail })
  console.log(`WARN [${area}] ${detail}`)
}

function ok(msg) {
  console.log(`OK   ${msg}`)
}

async function main() {
  const health = await request('GET', '/api/health/ready')
  if (health.status !== 200) fail('health', `ready=${health.status}`)
  else ok('/api/health/ready')

  let admin
  try {
    admin = await login('admin@example.com', 'admin123')
  } catch (e) {
    fail('auth', `admin login: ${e.message}`)
    printSummary()
    process.exit(1)
  }
  ok('admin login')

  const adminAuth = { Authorization: `Bearer ${admin.accessToken}` }

  const platformRoutes = [
    ['GET', '/api/platform/billing/dashboard'],
    ['GET', '/api/platform/coupons'],
    ['GET', '/api/platform/referrals'],
  ]
  for (const [method, path] of platformRoutes) {
    const res = await request(method, path, null, adminAuth)
    if (res.status >= 400) fail('platform', `${path} → ${res.status} ${JSON.stringify(res.body?.error || res.body)}`)
    else ok(`${path}`)
  }

  const schoolRoutes = [
    ['GET', '/api/marketplace/orders'],
    ['GET', '/api/alumni/donations'],
    ['GET', '/api/transport/stats'],
    ['GET', '/api/biometrics/devices'],
  ]
  for (const [method, path] of schoolRoutes) {
    const res = await request(method, path, null, adminAuth)
    if (res.status >= 400) fail('school-admin', `${path} → ${res.status} ${JSON.stringify(res.body?.error || res.body)}`)
    else ok(`${path}`)
  }

  const publicRes = await request('GET', '/api/public/site')
  if (publicRes.status >= 400) fail('public', `/api/public/site → ${publicRes.status}`)
  else ok('/api/public/site')

  const manualCheckout = await request('GET', '/api/marketplace/cart', null, adminAuth)
  if (manualCheckout.status >= 400 && manualCheckout.status !== 404) {
    warn('marketplace', `cart endpoint ${manualCheckout.status}`)
  }

  printSummary()
  process.exit(issues.filter((i) => i.severity === 'fail').length ? 1 : 0)
}

function printSummary() {
  console.log('\n--- Beta API summary ---')
  const fails = issues.filter((i) => i.severity === 'fail')
  const warns = issues.filter((i) => i.severity === 'warn')
  console.log(`Failures: ${fails.length}  Warnings: ${warns.length}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
