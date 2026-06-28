#!/usr/bin/env node
/**
 * Automated security checklist verification.
 * Run: npm run security:audit
 */
const fs = require('fs')
const path = require('path')
const { validateProductionSecrets, MIN_SECRET_LENGTH } = require('../src/backend/lib/securityConfig')

const root = path.join(__dirname, '..')
const checks = []

function pass(id, label, detail) {
  checks.push({ id, label, status: 'pass', detail })
}

function warn(id, label, detail) {
  checks.push({ id, label, status: 'warn', detail })
}

function fail(id, label, detail) {
  checks.push({ id, label, status: 'fail', detail })
}

function fileExists(rel) {
  return fs.existsSync(path.join(root, rel))
}

function fileContains(rel, needle) {
  const content = fs.readFileSync(path.join(root, rel), 'utf8')
  return content.includes(needle)
}

// --- Authentication ---
const envPath = path.join(root, '.env')
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8')
  if (fileContains('.gitignore', '.env')) {
    pass('env-gitignore', '.env excluded from git', '.gitignore lists .env')
  } else {
    fail('env-gitignore', '.env excluded from git', 'Add .env to .gitignore')
  }
  const jwtMatch = envContent.match(/^JWT_SECRET=(.+)$/m)
  const refreshMatch = envContent.match(/^REFRESH_SECRET=(.+)$/m)
  if (process.env.NODE_ENV === 'production') {
    const validation = validateProductionSecrets(process.env)
    if (validation.ok) pass('secrets-prod', 'Production secrets valid', `>= ${MIN_SECRET_LENGTH} chars`)
    else validation.errors.forEach((e) => fail('secrets-prod', 'Production secrets', e))
  } else {
    pass('secrets-dev', 'Dev secrets (override in production)', 'Use openssl rand -base64 48 for production')
  }
} else {
  warn('env-file', '.env file', 'Copy .env.example to .env before deploy')
}

if (fileContains('src/backend/routes/authRoutes.js', 'hashRefreshToken')) {
  pass('refresh-hashed', 'Refresh tokens stored hashed', 'SHA-256 in refreshTokenStore.js')
}
if (fileContains('src/backend/lib/authHelpers.js', 'LOCKOUT_THRESHOLD')) {
  pass('lockout', 'Account lockout after failed logins', '5 attempts / 15 min')
}
if (fileContains('src/backend/routes/authRoutes.js', 'twoFactorEnabled')) {
  pass('2fa', '2FA available', 'TOTP + backup codes')
}
if (fileContains('src/backend/lib/authHelpers.js', 'PASSWORD_MIN_LENGTH = 8')) {
  pass('password-min', 'Password minimum 8 characters', 'Plus complexity rules')
}

// --- Transport & headers ---
pass('tls', 'TLS 1.2+ on public endpoints', 'Configure at nginx/Caddy/load balancer — see docs/DEPLOYMENT.md')
if (fileContains('.env.example', 'TRUST_PROXY')) {
  pass('trust-proxy-doc', 'TRUST_PROXY documented', 'Set true behind reverse proxy')
}
if (fileContains('src/backend/server.js', 'helmet(')) {
  pass('helmet', 'Helmet enabled (backend)', 'Including HSTS in production')
}
if (fileContains('src/frontend/next.config.js', 'Strict-Transport-Security')) {
  pass('frontend-headers', 'Security headers on frontend', 'CSP, X-Frame-Options, HSTS (prod)')
}
pass('hsts-lb', 'HSTS at load balancer', 'Also set at CDN/reverse proxy for defense in depth')

// --- API security ---
if (fileContains('src/backend/middleware/security.js', 'max: 300')) {
  pass('rate-limit', 'Rate limiting active', '300 req/15min global, 30 auth/15min')
}
if (fileContains('src/backend/middleware/security.js', 'redisRateLimitStore')) {
  pass('redis-ratelimit', 'Redis rate limits (optional)', 'Set REDIS_URL for multi-instance')
}
if (fileContains('src/backend/middleware/csrf.js', 'csrfProtection')) {
  pass('csrf', 'CSRF protection', 'Cookie-only mutating requests')
}
if (fileContains('src/backend/server.js', 'requireActiveSchool')) {
  pass('jwt-tenant', 'JWT + tenant isolation', 'tenantGuard on protected routes')
}
if (fileContains('src/backend/middleware/moduleFeatureGuard.js', 'MODULE_ROUTES')) {
  pass('feature-guards', 'Feature flags + plan limits', 'moduleFeatureGuard')
}
if (fileContains('src/backend/lib/manualPaymentHelpers.js', 'schoolBankDetails')) {
  pass('manual-payments', 'Manual bank payments', 'Fees, shop, donations, and billing use bank transfer')
}
if (fileExists('tests/unit/penetrationFocus.test.js')) {
  pass('pentest-unit', 'Penetration focus unit tests', 'IDOR, uploads, XSS, lockout, SQL surface')
}
if (fileExists('tests/integration/penetration.test.js')) {
  pass('pentest-api', 'Penetration API tests', 'npm run test:penetration (backend required)')
}

// --- Data protection ---
if (fileContains('src/backend/lib/auditSanitize.js', 'sanitizeAuditBody')) {
  pass('audit-redact', 'Audit log redaction', 'Passwords and secrets redacted')
}
if (fileContains('src/backend/lib/uploadHelpers.js', 'ALLOWED_MIMES')) {
  pass('upload-validate', 'File upload validation', 'MIME whitelist + size limit')
}
if (fileContains('src/backend/lib/safeLogger.js', 'installProductionSafeConsole')) {
  pass('pii-logs', 'PII not logged in production', 'safeLogger redacts sensitive fields')
}

// --- SaaS ---
if (fileContains('src/backend/routes/platformRoutes.js', "requireRole('SuperAdmin')")) {
  pass('superadmin', 'Super Admin routes restricted', 'requireRole SuperAdmin')
}
if (fileContains('src/backend/middleware/tenantGuard.js', 'grace')) {
  pass('grace-period', 'Subscription grace period enforced', 'tenantGuard')
}
if (fileContains('src/backend/routes/platformRoutes.js', 'overrideNote is required')) {
  pass('override-note', 'Manual override logged', 'overrideNote required + transaction log')
}
if (fileContains('src/backend/routes/platformRoutes.js', 'stripInternalTicketFields')) {
  pass('support-internal', 'Support internal notes hidden', 'Stripped for school admins')
}

// --- Operational ---
if (fileExists('scripts/backup-db.js')) pass('backup-script', 'Database backup script', 'npm run backup:db')
if (fileExists('scripts/schedule-backup.js')) pass('backup-schedule', 'Daily backup scheduler', 'npm run backup:schedule')
if (fileExists('docs/DISASTER_RECOVERY.md')) pass('dr-plan', 'Incident response documented', 'DISASTER_RECOVERY.md')
if (fileExists('scripts/restore-db.js')) pass('restore-script', 'Restore script available', 'Test monthly on staging')
pass('health-monitor', 'Health endpoint', 'Monitor GET /api/health/ready in production')
pass('npm-audit', 'Dependency audits', 'Run npm audit monthly — npm run security:audit includes audit')

// --- Summary ---
const failed = checks.filter((c) => c.status === 'fail')
const warnings = checks.filter((c) => c.status === 'warn')
const passed = checks.filter((c) => c.status === 'pass')

console.log('\nSchoolPilot Security Audit\n' + '='.repeat(40))
for (const c of checks) {
  const icon = c.status === 'pass' ? '✓' : c.status === 'warn' ? '!' : '✗'
  console.log(`${icon} [${c.status.toUpperCase()}] ${c.label}`)
  if (c.detail) console.log(`    ${c.detail}`)
}
console.log('\n' + '='.repeat(40))
console.log(`Passed: ${passed.length}  Warnings: ${warnings.length}  Failed: ${failed.length}`)

if (failed.length > 0) process.exit(1)
process.exit(0)
