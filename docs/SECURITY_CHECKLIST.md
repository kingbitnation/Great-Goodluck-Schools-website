# Security Checklist

Use before production launch and quarterly thereafter.  
**Last verified:** June 2026 — run `npm run security:audit` to re-validate.

## Authentication & sessions

- [x] `JWT_SECRET` and `REFRESH_SECRET` are unique, 32+ random characters — enforced at startup via `securityConfig.js` in production; generate with `openssl rand -base64 48`
- [x] No default secrets in production `.env` — server refuses weak/dev defaults when `NODE_ENV=production`
- [x] Refresh tokens stored hashed, revocable per device — SHA-256 hash in DB; per-device sessions revocable at `/api/auth/sessions/:id`
- [x] Account lockout after failed logins — 5 attempts → 15 min lock (`authHelpers.js`)
- [x] 2FA available for admin accounts — TOTP + backup codes at `/settings/security`
- [x] Password minimum 8 characters enforced — plus uppercase, lowercase, number (`validatePassword`)

## Transport & headers

- [x] TLS 1.2+ on all public endpoints — configure at nginx/Caddy/load balancer ([DEPLOYMENT.md](./DEPLOYMENT.md))
- [x] `TRUST_PROXY=true` when behind reverse proxy — documented in `.env.example`; auto-enabled in production
- [x] Helmet enabled (backend) — HSTS in production (`server.js`)
- [x] Security headers on frontend — CSP, X-Frame-Options, Referrer-Policy, HSTS (`next.config.js`)
- [x] HSTS configured at load balancer — also set in Helmet + Next.js; duplicate at CDN/LB recommended

## API security

- [x] Rate limiting active — 300 req/15min global, 30 auth/15min (`security.js`)
- [x] Optional Redis rate limits for multi-instance — `REDIS_URL` + `redisRateLimitStore`
- [x] CSRF protection for cookie-only requests — `middleware/csrf.js`
- [x] JWT required for protected routes — `requireRole` + `requireActiveSchool`
- [x] Tenant isolation (`tenantGuard`) — no cross-school access
- [x] Feature flags + plan limits enforced per module — `moduleFeatureGuard.js`
- [x] Manual payments only — bank transfer + proof upload / admin verification (`manualPaymentHelpers.js`)

## Data protection

- [x] Audit logs redact passwords and secrets — `auditSanitize.js`
- [x] `.env` not committed to git — listed in `.gitignore`
- [x] Database credentials least-privilege — use dedicated DB user in production (see DEPLOYMENT.md)
- [x] File uploads validated (type/size) via `uploadHelpers` — MIME whitelist, size cap, path traversal guard
- [x] PII not logged to console in production — `safeLogger.js` redacts sensitive fields

## SaaS platform

- [x] Super Admin routes restricted to `SuperAdmin` role — `requireRole('SuperAdmin')`
- [x] Subscription grace period enforced — `tenantGuard.js`
- [x] Manual override logged with `overrideNote` — required + `subscriptionTransactionLog`
- [x] Support ticket internal notes hidden from schools — `stripInternalTicketFields`

## Operational

- [x] Daily database backups automated — `npm run backup:schedule` (cron/Task Scheduler)
- [x] Restore tested monthly — `npm run restore:db`; test on staging quarterly
- [x] `/api/health/ready` monitored — Docker healthcheck + uptime monitor in production
- [x] Dependency updates (`npm audit`) reviewed monthly — included in `npm run security:audit`
- [x] Incident response plan documented — [DISASTER_RECOVERY.md](./DISASTER_RECOVERY.md)

## Penetration test focus areas

| Area | Mitigation |
|------|------------|
| Cross-tenant IDOR on `/api/schools/:id/*` | `assertSameSchool` + `tenantGuard` — see `tests/unit/penetrationFocus.test.js` |
| Role escalation (Student → Admin) | JWT role in token; `requireRole` on all admin routes — `tests/integration/penetration.test.js` |
| Removed payment webhooks (replay) | Flutterwave/Paystack webhooks removed; manual payments only |
| File upload path traversal | Sanitized folder names + resolved path check — `penetrationFocus.test.js` |
| SQL injection via Prisma raw queries | Parameterized `$queryRaw` only in health check |
| XSS on CMS content fields | `htmlSanitize.js` on website CMS writes |
| Brute force login | Auth rate limiter + account lockout after 5 failures |

## Automated checks

```bash
npm run security:audit   # Checklist + npm audit (high+)
npm run test:unit        # Includes securityChecklist.test.js + penetrationFocus.test.js
npm run test:integration # Includes penetration.test.js (requires backend)
npm run test:penetration # Unit + live API penetration focus tests
```

API documentation: `GET /api/docs/openapi.yaml`
