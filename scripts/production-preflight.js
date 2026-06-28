#!/usr/bin/env node
/**
 * Pre-deploy checklist — validates production configuration.
 * Usage: npm run deploy:preflight
 */
const fs = require('fs')
const path = require('path')
const { validateProductionSecrets } = require('../src/backend/lib/securityConfig')

const root = path.join(__dirname, '..')
const envFile = process.env.ENV_FILE || path.join(root, '.env.production')
const errors = []
const warnings = []
const ok = []

function check(label, pass, detail) {
  if (pass) ok.push({ label, detail })
  else errors.push({ label, detail })
}

function warn(label, detail) {
  warnings.push({ label, detail })
}

if (!fs.existsSync(envFile)) {
  console.error(`Missing ${envFile}`)
  console.error('Run: cp .env.production.example .env.production && npm run secrets:generate -- --write')
  process.exit(1)
}

const content = fs.readFileSync(envFile, 'utf8')
const env = { NODE_ENV: 'production' }
for (const line of content.split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

const secretCheck = validateProductionSecrets(env)
secretCheck.errors.forEach((e) => errors.push({ label: 'Secrets', detail: e }))
secretCheck.warnings.forEach((w) => warnings.push({ label: 'Secrets', detail: w }))
if (secretCheck.ok) ok.push({ label: 'JWT/REFRESH secrets', detail: 'Strong and distinct' })

const localDeploy = process.env.LOCAL_DEPLOY === 'true' || process.env.LOCAL_DEPLOY === '1' || env.LOCAL_DEPLOY === 'true'

check('TRUST_PROXY', env.TRUST_PROXY === 'true', 'Must be true behind nginx/Caddy')
if (localDeploy) {
  ok.push({ label: 'LOCAL_DEPLOY', detail: 'Skipping HTTPS URL checks for local Docker validation' })
} else {
  check('APP_URL https', env.APP_URL?.startsWith('https://'), env.APP_URL || 'Set APP_URL')
  check('API URL https', env.NEXT_PUBLIC_API_BASE_URL?.startsWith('https://'), env.NEXT_PUBLIC_API_BASE_URL || 'Set NEXT_PUBLIC_API_BASE_URL')
}
check('DATABASE_URL', !!env.DATABASE_URL && !env.DATABASE_URL.includes('postgres:postgres@'), 'Use dedicated DB user, not default postgres/postgres')

if (env.PLATFORM_BANK_ACCOUNT_NUMBER) {
  ok.push({ label: 'Manual payments', detail: 'Platform bank account configured for SaaS billing' })
} else {
  warn('Manual payments', 'Set PLATFORM_BANK_* for subscription bank transfer details')
}

if (env.SMTP_HOST && env.SMTP_PASS) ok.push({ label: 'SMTP', detail: env.SMTP_HOST })
else warn('SMTP', 'Email notifications will not send without SMTP_*')

if (env.TERMII_API_KEY && env.TERMII_SENDER_ID) {
  ok.push({ label: 'Termii SMS', detail: env.TERMII_SENDER_ID })
} else {
  warn('Termii SMS', 'Set TERMII_API_KEY and TERMII_SENDER_ID for SMS')
}

if (env.OPENAI_API_KEY) ok.push({ label: 'OpenAI', detail: env.AI_MODEL || 'gpt-4o-mini' })
else warn('OpenAI', 'AI runs in demo mode without OPENAI_API_KEY')

const optional = [
  ['REDIS_URL', 'Redis rate limits'],
  ['CLOUDINARY_CLOUD_NAME', 'Cloudinary uploads'],
  ['OPENAI_API_KEY', 'Live AI'],
  ['TERMII_API_KEY', 'SMS via Termii'],
  ['VAPID_PUBLIC_KEY', 'Web push'],
]
for (const [key, label] of optional) {
  if (env[key]) ok.push({ label, detail: 'Configured' })
  else warnings.push({ label, detail: 'Not set (optional)' })
}

console.log('\nSchoolPilot Production Preflight\n' + '='.repeat(40))
for (const { label, detail } of ok) console.log(`✓ ${label}: ${detail}`)
for (const { label, detail } of warnings) console.log(`! ${label}: ${detail}`)
for (const { label, detail } of errors) console.log(`✗ ${label}: ${detail}`)
console.log('\n' + '='.repeat(40))
console.log(`OK: ${ok.length}  Warnings: ${warnings.length}  Errors: ${errors.length}`)

if (errors.length) {
  console.error('\nFix errors before deploying to production.')
  process.exit(1)
}
console.log('\nPreflight passed. Deploy with: npm run deploy:prod\n')
