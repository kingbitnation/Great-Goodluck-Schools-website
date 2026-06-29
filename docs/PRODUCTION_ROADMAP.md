# SchoolPilot Production Readiness Roadmap

This document tracks production-hardening work against the master platform requirements.  
**Principle:** extend existing modules — no duplicate pages or breaking rewrites.

## Phase 1 — Platform operator foundation (implemented)

| Area | Status | Location |
|------|--------|----------|
| Platform business dashboard (KPIs) | Done | `/super-admin`, `GET /api/platform/metrics` |
| Five subscription plans + limits | Done | Seed + `planLimits.js`, `/super-admin/plans` |
| Plan CRUD (Super Admin) | Done | `PUT /api/platform/plans/:id` |
| Feature flags | Done | `FeatureFlag` model, `/super-admin/feature-flags` |
| Billing overview | Done | `/super-admin/billing`, `GET /api/platform/billing` |
| Support desk | Done | `/super-admin/support`, `/admin/support` |
| System health (platform) | Done | `/super-admin/system-health` |
| School usage analytics | Done | `/admin/usage` |
| AI credit schema + helpers | Done | `AiCreditBalance`, `platformHelpers.consumeAiCredit` |
| Referral schema + API | Done | `/super-admin/referrals`, `GET /api/platform/referrals` |
| Subscription grace period | Done | `tenantGuard.js` |
| Coupons schema | Done | `BillingCoupon` model |
| Custom domain verification schema | Done | `CustomDomainRecord` model |

### Subscription plans (production)

| Plan | Slug | Monthly (NGN) |
|------|------|---------------|
| Starter | `starter` | 50,000 |
| Standard | `standard` | 120,000 |
| Professional | `professional` | 250,000 |
| Enterprise | `enterprise` | 500,000 |
| Ultimate | `ultimate` | 900,000 |

Legacy slugs `basic` and `premium` remain in DB (inactive) for backward compatibility.

## Phase 2 — Billing, security & growth (implemented)

| Area | Status | Location |
|------|--------|----------|
| AI credit consumption | Done | `aiRoutes.js` — deducts on generate/chat |
| Module feature guards | Done | `moduleFeatureGuard.js` — marketplace, payroll, hostel, transport, AI, etc. |
| Billing intervals + coupons | Done | `saasRoutes.js` checkout |
| Subscription cancel | Done | `POST /api/schools/:id/subscription/cancel` |
| Invoice PDF export | Done | `GET /api/subscription/invoices/:id/pdf` |
| Paystack webhook | Removed | N/A — manual payments only |
| Online payment gateways | Removed | Bank transfer + admin verification |
| Custom domain DNS verification | Done | Branding page + `domainHelpers.js` |
| Referral on registration + rewards | Done | `referralHelpers.js`, `/admin/referrals` |
| Communication center | Done | `/super-admin/communications` |
| CSRF protection | Done | `middleware/csrf.js` (cookie-only requests) |
| Redis rate limits (optional) | Done | `lib/redis.js` + `REDIS_URL` |
| Next.js tenant domain cookie | Done | `src/frontend/middleware.ts` |
| API usage tracking | Done | `server.js` middleware |

## Phase 3 — Polish, testing & compliance (implemented)

| Area | Status | Location |
|------|--------|----------|
| OpenAPI documentation | Done | `docs/openapi.yaml`, `GET /api/docs/openapi.yaml` |
| Deployment runbook | Done | `docs/DEPLOYMENT.md` |
| Backup & restore guide | Done | `docs/BACKUP_RESTORE.md` |
| Disaster recovery plan | Done | `docs/DISASTER_RECOVERY.md` |
| Security checklist | Done | `docs/SECURITY_CHECKLIST.md` |
| Audit log PII redaction | Done | `auditSanitize.js` |
| Trust proxy (production) | Done | `server.js` + `TRUST_PROXY` |
| SEO meta tags | Done | `components/Seo.tsx` |
| Lighthouse / perf headers | Done | `next.config.js` — compress, security headers, AVIF/WebP |
| WCAG polish | Done | Skip links, focus styles, `aria-*`, reduced motion |
| Playwright E2E | Done | `e2e/api.spec.js`, `e2e/ui.spec.js` |
| Expanded unit tests | Done | 40+ tests including security helpers |
| CI E2E step | Done | `.github/workflows/ci.yml` |

## Production launch checklist

- [x] Complete [SECURITY_CHECKLIST.md](./SECURITY_CHECKLIST.md) — `npm run security:audit`
- [x] Configure production secrets — `.env.production.example` + `npm run secrets:generate -- --write` + `npm run deploy:preflight`
- [x] Set `TRUST_PROXY=true` behind load balancer — `docker-compose.prod.yml` + nginx/Caddy templates
- [x] Configure `PLATFORM_BANK_*` for SaaS billing — see [DEPLOYMENT.md](./DEPLOYMENT.md) §2
- [ ] Complete operator checklist — [USER_SETUP_CHECKLIST.md](./USER_SETUP_CHECKLIST.md)
- [x] Schedule daily `npm run backup:db` — `backup` service in `docker-compose.prod.yml`
- [x] Run `npm run test:e2e:staging` against staging — `.github/workflows/staging-e2e.yml`
- [x] Lighthouse audit on `/` and `/login` — `npm run lighthouse` (target 95+)
- [x] Deploy to production — `npm run deploy:prod` (see [DEPLOYMENT.md](./DEPLOYMENT.md))
- [x] TLS/HSTS at load balancer — `deploy/nginx/schoolpilot.conf` + `deploy/Caddyfile`
- [x] Health monitoring on `/api/health/ready` — Docker healthchecks + `npm run health:monitor`
- [x] External services documented — [DEPLOYMENT.md](./DEPLOYMENT.md) §8 (Paystack, SMTP, Cloudinary, Redis, etc.)

## Commands

```bash
docker compose up -d db
npx prisma db push
npx prisma db seed
npm run dev:backend
npm run dev:frontend
```

Super Admin: `admin@example.com` / `admin123` → **Platform Dashboard** at `/super-admin`.

## Known feature / code gaps

| Area | Status | Notes |
|------|--------|-------|
| Referral program | Done | `/super-admin/referrals`, `GET/PATCH /api/platform/referrals` |
| Super Admin coupon UI | Done | `/super-admin/billing` → Coupons tab |
| Manual payment admin (shop, donations, SaaS) | Done | `/admin/marketplace-orders`, `/admin/alumni-donations`, billing payments tab |
| Custom domain SSL | Partial | DNS TXT verification works; issue TLS manually at load balancer (see [USER_SETUP_CHECKLIST.md](./USER_SETUP_CHECKLIST.md)) |
| Biometric hardware | Partial | Software layer only; no ZKTeco/device SDK — scans are API-driven/simulated |
| GPS / telematics | Partial | Bus tracking via manual admin GPS or browser geolocation, not live hardware feeds |
| Public gallery & staff pages | Content | UI/API/CMS exist; schools add content via `/admin/website-cms` |
| Playwright UI E2E in CI | Partial | `staging-e2e.yml` runs full suite; main `ci.yml` is API-only |
| Admin UI brand colors | Partial | Shared `btn-admin` utilities added; some legacy `blue-*` classes may remain on older pages |
| Redis rate limits | Done | Set `REDIS_URL` for distributed limits across instances |

## Phase 4 — Enterprise platform (in progress)

| Area | Status | Location |
|------|--------|----------|
| Master workflow blueprint | Done | `docs/PLATFORM_WORKFLOWS.md` |
| Enterprise gap analysis | Done | `docs/ENTERPRISE_GAP_ANALYSIS.md` |
| API keys & webhooks | Scaffold | `DeveloperApiKey`, `WebhookEndpoint`, `/admin/developer` |
| Integration catalog | Scaffold | `IntegrationProvider`, `/admin/integrations` |
| Workflow automation v1 | Scaffold | `WorkflowRule`, `workflowEngine.js`, `/admin/automation` |
| Calendar hub | Done | `GET /api/calendar`, `/calendar`, iCal export |
| Document vault | Done | `/admin/documents`, versions + expiry |
| OAuth integrations | Done | Google, Zoom OAuth; Paystack key verify |
| School success dashboard | Done | `/super-admin/success` |
| Paystack payments | Done | Fees + SaaS; webhook; see [PAYMENTS.md](./PAYMENTS.md) |
| Online payment gateways | Partial | Paystack live; Flutterwave/Stripe catalog only |

## Ongoing operations (manual)

- Monthly backup restore test on staging
- Weekly sync of `/uploads` to object storage (Cloudinary when configured)
- Quarterly disaster-recovery drill — see [DISASTER_RECOVERY.md](./DISASTER_RECOVERY.md)
- Monthly `npm run security:audit` review
