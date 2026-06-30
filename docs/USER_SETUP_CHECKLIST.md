# SchoolPilot — What only you can provide

Use this checklist before and after production launch. The platform code is ready for manual bank-transfer payments, multi-tenant schools, and SchoolPilot branding — but these items need **your** accounts, credentials, content, or operational follow-through.

---

## 1. Production hosting & domain

**Cloud (recommended):** See [LAUNCH_VERCEL_RAILWAY.md](./LAUNCH_VERCEL_RAILWAY.md) — Neon + Railway + Vercel.

**Self-hosted Docker:**

- [ ] Choose a VPS or cloud host (e.g. DigitalOcean, AWS, Hetzner) with at least 2 vCPU, 4 GB RAM, 40 GB disk
- [ ] Register your **platform** domain (e.g. `schoolpilot.ng`) and point DNS to your server
- [ ] Copy `.env.production.example` → `.env.production` and run `npm run secrets:generate -- --write` for JWT/CSRF secrets
- [ ] Set `LOCAL_DEPLOY=false` for real production
- [ ] Deploy with `docker compose -f docker-compose.prod.yml up -d` (see [DEPLOYMENT.md](./DEPLOYMENT.md))
- [ ] Enable TLS at nginx/Caddy (`deploy/nginx/schoolpilot.conf` or `deploy/Caddyfile`)
- [ ] Set `TRUST_PROXY=true` when behind a reverse proxy
- [ ] Smoke-test: `https://your-domain/api/health/ready` returns `ok`

---

## 2. Platform bank account (SaaS billing only)

SchoolPilot subscription invoices use **`PLATFORM_BANK_*`** in `.env.production` — **not** school fee/shop/donation accounts.

- [ ] `PLATFORM_BANK_NAME`
- [ ] `PLATFORM_BANK_ACCOUNT_NAME`
- [ ] `PLATFORM_BANK_ACCOUNT_NUMBER`
- [ ] Confirm Super Admin can approve pending payments at `/super-admin/billing` → **Payments**

---

## 3. Each school’s bank account (fees, shop, donations)

Every tenant school must set its own account in **Admin → School branding**:

- [ ] Bank name, account name, account number
- [ ] Test a fee payment, shop order, and alumni donation — checkout should show **that school’s** details
- [ ] School admins confirm bank transfers at:
  - `/admin/marketplace-orders` (shop)
  - `/admin/alumni-donations` (donations)
  - Finance / fees admin pages (existing fee verification flows)

---

## 4. Email (SMTP)

- [ ] Configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`
- [ ] Send a test email (password reset, fee receipt, or notification)
- [ ] If using a queue, set `REDIS_URL` for reliable delivery across restarts

---

## 5. File uploads (Cloudinary)

- [ ] Create a Cloudinary account and set `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
- [ ] Run `node scripts/cloudinary-onboarding.js` if prompted during setup
- [ ] Upload a school logo and a CMS image to verify

---

## 6. SMS (optional — Termii or similar)

- [ ] Set `TERMII_API_KEY`, `TERMII_SENDER_ID` (or your provider vars in `.env`)
- [ ] Send a test SMS from Communications or a notification trigger

---

## 7. AI features (optional)

- [ ] Set `OPENROUTER_API_KEY` (recommended) or `OPENAI_API_KEY`
- [ ] Set plan AI credit limits in Super Admin → Plans if you charge for AI usage
- [ ] **Rotate the key** if it was ever pasted in chat or committed by mistake

---

## 8. Redis (recommended for production)

- [ ] Provision Redis and set `REDIS_URL`
- [ ] Confirms distributed rate limits and email/SMS queues work with multiple app instances

---

## 9. Brand assets (logos)

Official palette: `#2563EB`, `#0F172A`, `#F59E0B`, `#10B981`, `#F8FAFC`.

Assets live in `src/frontend/public/brand/` (sourced from `src/img/`).

- [ ] Replace PNGs if your design exports still show corner labels (“HORIZONTAL LOCKUP”, “DARK BACKGROUND”) — export **cropped** wordmarks without metadata text
- [ ] Provide favicon / PWA icons if you want custom app install icons beyond `app-icon.png`
- [ ] Per-school logos: each school uploads via **School branding** or CMS

---

## 10. Public website content

UI and CMS exist; content is per school.

- [ ] **Admin → Website CMS** — home hero, about, academics, gallery, staff, news
- [ ] Principal message, stats, contact details, social links
- [ ] Run Lighthouse on `/`, `/login`, `/about` — target 95+ (`npm run lighthouse`)

---

## 11. Custom domains per school

DNS TXT verification works in **School branding**. Automated SSL provisioning is **not** built in.

- [ ] After TXT verify, point the school’s CNAME/A record to your platform load balancer
- [ ] Issue TLS certificates manually (Let’s Encrypt / Cloudflare / your host panel)
- [ ] Document which schools use custom domains in your runbook

---

## 12. Integrations you must source externally

| Integration | Platform support | Your action |
|-------------|------------------|-------------|
| ZKTeco / biometric hardware | API + admin UI; no device SDK | Buy devices, vendor SDK or middleware, push scans to `/api/biometrics/...` |
| GPS / fleet telematics | Manual GPS + browser geolocation | Contract telematics provider or enter coordinates in transport admin |
| Online payment gateways | Paystack, Flutterwave, Stripe + manual bank transfer | Set platform keys in `.env.production`; schools connect keys in **Integrations** |

---

## 13. Security & compliance (ongoing)

- [ ] Run `npm run security:audit` monthly; review [SECURITY_CHECKLIST.md](./SECURITY_CHECKLIST.md)
- [ ] Run `npm run test:penetration` before major releases (backend must be running for integration half)
- [ ] Schedule **monthly** DB restore test: [BACKUP_RESTORE.md](./BACKUP_RESTORE.md)
- [ ] Quarterly disaster-recovery drill: [DISASTER_RECOVERY.md](./DISASTER_RECOVERY.md)
- [ ] Consider a **third-party penetration test** before go-live with real student data
- [ ] Rotate any secrets that were shared in support chats or old `.env` backups

---

## 14. Demo vs production data

- [ ] Change default passwords (`admin@example.com` / `admin123`) before public launch
- [ ] Remove or anonymize seed/demo schools if not needed
- [ ] Define data retention and NDPR/GDPR policies for your jurisdiction

---

## 15. Post-launch monitoring

- [ ] Health checks on `/api/health/ready` (UptimeRobot, Better Stack, etc.)
- [ ] Daily backups via `backup` service in `docker-compose.prod.yml`
- [ ] Sync `/uploads` to object storage weekly if not fully on Cloudinary
- [ ] Super Admin: `/super-admin/system-health`, `/super-admin/billing`, `/super-admin/referrals`

---

## Quick reference — admin URLs

| Task | URL |
|------|-----|
| Approve SaaS subscription payments | `/super-admin/billing` → Payments |
| Referrals & rewards | `/super-admin/referrals` |
| Coupons | `/super-admin/billing` → Coupons |
| Confirm shop bank payments | `/admin/marketplace-orders` |
| Confirm alumni donations | `/admin/alumni-donations` |
| School bank + branding | `/admin/school-branding` |
| Custom domain DNS | `/admin/school-branding` → Custom domain |

When every box above is checked for your environment, SchoolPilot is ready for real schools and real money — with manual payment verification as the single payment path.
