#!/usr/bin/env node
/**
 * Generate production secrets and optionally write .env.production from template.
 * Usage:
 *   node scripts/generate-production-secrets.js
 *   node scripts/generate-production-secrets.js --write
 */
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { generateSecret } = require('../src/backend/lib/securityConfig')

const root = path.join(__dirname, '..')
const templatePath = path.join(root, '.env.production.example')
const outPath = path.join(root, '.env.production')

function secret(bytes = 48) {
  return generateSecret(bytes)
}

const secrets = {
  JWT_SECRET: secret(),
  REFRESH_SECRET: secret(),
  POSTGRES_PASSWORD: secret(24),
  DB_APP_PASSWORD: secret(24),
}

console.log('\nSchoolPilot — Production Secrets\n' + '='.repeat(44))
console.log('Copy these into .env.production (never commit that file):\n')
console.log(`JWT_SECRET=${secrets.JWT_SECRET}`)
console.log(`REFRESH_SECRET=${secrets.REFRESH_SECRET}`)
console.log(`POSTGRES_PASSWORD=${secrets.POSTGRES_PASSWORD}`)
console.log(`# DATABASE_URL=postgresql://schoolpilot_app:${secrets.DB_APP_PASSWORD}@db:5432/schooldb`)
console.log('\nGenerate more: openssl rand -base64 48\n')

if (process.argv.includes('--write')) {
  if (!fs.existsSync(templatePath)) {
    console.error('Missing .env.production.example')
    process.exit(1)
  }
  if (fs.existsSync(outPath)) {
    console.error('.env.production already exists. Delete it first or merge secrets manually.')
    process.exit(1)
  }
  let content = fs.readFileSync(templatePath, 'utf8')
  content = content
    .replace('CHANGE_ME_JWT_SECRET', secrets.JWT_SECRET)
    .replace('CHANGE_ME_REFRESH_SECRET', secrets.REFRESH_SECRET)
    .replace(/CHANGE_ME_DB_PASSWORD/g, secrets.DB_APP_PASSWORD)
  fs.writeFileSync(outPath, content, { mode: 0o600 })
  console.log(`Wrote ${outPath} with generated secrets.`)
  console.log('Edit APP_URL, Paystack keys, SMTP, and other service credentials before deploy.\n')
}
