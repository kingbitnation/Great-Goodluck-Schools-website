#!/usr/bin/env node
/**
 * Run full Playwright E2E suite against staging or local stack.
 */
const { spawnSync } = require('child_process')
const path = require('path')

const apiUrl = process.env.STAGING_API_URL || process.env.API_URL || 'http://localhost:4000'
const baseUrl = process.env.STAGING_BASE_URL || process.env.E2E_BASE_URL || 'http://localhost:3000'

async function main() {
  console.log(`\nE2E staging run`)
  console.log(`  API:  ${apiUrl}`)
  console.log(`  UI:   ${baseUrl}\n`)

  try {
    const res = await fetch(`${apiUrl}/api/health/ready`, { signal: AbortSignal.timeout(10000) })
    const body = await res.json().catch(() => ({}))
    if (!res.ok || body.status !== 'ready') {
      console.error('Staging backend not ready. Start stack first:')
      console.error('  docker compose up -d db && npm run db:setup && npm run dev:backend')
      process.exit(1)
    }
    console.log('Backend health: ready\n')
  } catch (err) {
    console.error(`Cannot reach ${apiUrl}/api/health/ready — ${err.message}`)
    process.exit(1)
  }

  const result = spawnSync(
    'npx',
    ['playwright', 'test'],
    {
      stdio: 'inherit',
      shell: true,
      cwd: path.join(__dirname, '..'),
      env: { ...process.env, API_URL: apiUrl, E2E_BASE_URL: baseUrl },
    }
  )

  process.exit(result.status ?? 1)
}

main()
