#!/usr/bin/env node
/**
 * Sync backend env vars from .env to Railway (requires: railway login + railway link)
 * Usage: npm run railway:sync-env
 */
const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const SKIP = new Set([
  'NEXT_PUBLIC_API_BASE_URL',
  'NEXT_PUBLIC_PLATFORM_BANK_NAME',
  'NEXT_PUBLIC_PLATFORM_BANK_ACCOUNT_NUMBER',
  'NEXT_PUBLIC_PLATFORM_BANK_ACCOUNT_NAME',
  'API_INTERNAL_URL',
])

const FORCE = {
  NODE_ENV: 'production',
  TRUST_PROXY: 'true',
  SKIP_DB_PUSH: 'true',
  RUN_SEED: 'false',
}

const envPath = path.join(__dirname, '..', '.env')
if (!fs.existsSync(envPath)) {
  console.error('Missing .env file')
  process.exit(1)
}

const vars = { ...FORCE }
for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (!m) continue
  const key = m[1]
  if (SKIP.has(key)) continue
  let val = m[2].replace(/^["']|["']$/g, '')
  vars[key] = val
}

try {
  execSync('railway --version', { stdio: 'pipe' })
} catch {
  console.error('Install Railway CLI: npm install -g @railway/cli')
  console.error('Then: railway login && railway link')
  process.exit(1)
}

console.log(`Setting ${Object.keys(vars).length} variables on Railway...\n`)
for (const [key, value] of Object.entries(vars)) {
  if (!value && !FORCE[key]) {
    console.log(`  skip ${key} (empty)`)
    continue
  }
  try {
    execSync(`railway variables set "${key}=${value.replace(/"/g, '\\"')}"`, {
      stdio: 'pipe',
      shell: true,
    })
    console.log(`  ✓ ${key}`)
  } catch (err) {
    console.error(`  ✗ ${key}: ${err.message}`)
  }
}

console.log('\nDone. Redeploy in Railway dashboard or: railway up')
console.log('Then set API_PUBLIC_URL to your Railway domain after first deploy.')
