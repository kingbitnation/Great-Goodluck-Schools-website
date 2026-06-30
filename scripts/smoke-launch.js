#!/usr/bin/env node
/**
 * Phase A launch smoke tests — run against deployed API or local backend.
 * Usage: API_URL=https://your-api.up.railway.app node scripts/smoke-launch.js
 */
const base = (process.env.API_URL || process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000').replace(/\/$/, '')

const checks = []

async function get(path) {
  const res = await fetch(`${base}${path}`)
  const text = await res.text()
  let body = {}
  try {
    body = JSON.parse(text)
  } catch {
    body = { raw: text.slice(0, 200) }
  }
  return { ok: res.ok, status: res.status, body }
}

async function run() {
  console.log(`\nSchoolPilot launch smoke — ${base}\n${'='.repeat(50)}`)

  const live = await get('/api/health/live')
  checks.push({
    name: 'Health live',
    pass: live.ok && live.body.status === 'ok',
    detail: live.body.status || live.status,
  })

  const ready = await get('/api/health/ready')
  checks.push({
    name: 'Health ready (DB)',
    pass: ready.ok && ready.body.db === true,
    detail: ready.body.status || ready.status,
  })

  const plans = await get('/api/public/plans')
  checks.push({
    name: 'Public subscription plans',
    pass: plans.ok && Array.isArray(plans.body) && plans.body.length >= 5,
    detail: Array.isArray(plans.body) ? `${plans.body.length} plans` : plans.status,
  })

  const quote = await get('/api/public/schools/register/quote?planSlug=standard&interval=monthly')
  checks.push({
    name: 'Registration quote',
    pass: quote.ok && quote.body.amount != null,
    detail: quote.ok ? `₦${quote.body.amount}` : quote.body.error || quote.status,
  })

  let passed = 0
  for (const c of checks) {
    const icon = c.pass ? '✓' : '✗'
    console.log(`${icon} ${c.name}: ${c.detail}`)
    if (c.pass) passed += 1
  }

  console.log(`\n${passed}/${checks.length} passed\n`)
  if (passed < checks.length) process.exit(1)
}

run().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
