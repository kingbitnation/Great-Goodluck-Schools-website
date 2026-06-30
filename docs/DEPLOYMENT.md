# Deployment Guide

Production launch checklist for SchoolPilot.

**Recommended cloud stack (Phase A):** Neon + Railway/Render + Vercel — see **[LAUNCH_VERCEL_RAILWAY.md](./LAUNCH_VERCEL_RAILWAY.md)**.

## 1. Generate production secrets

```bash
cp .env.production.example .env.production
npm run secrets:generate -- --write
```

Edit `.env.production` and set:

| Variable | Action |
|----------|--------|
| `APP_URL` | `https://app.yourdomain.com` |
| `NEXT_PUBLIC_API_BASE_URL` | `https://api.yourdomain.com` |
| `API_PUBLIC_URL` | Same as API URL |
| `DATABASE_URL` | Dedicated DB user (not `postgres:postgres`) |
| `PLATFORM_BANK_NAME` | Bank name shown for SaaS subscription transfers |
| `PLATFORM_BANK_ACCOUNT_NAME` | Account name for platform billing |
| `PLATFORM_BANK_ACCOUNT_NUMBER` | Account number for platform billing |
| `SMTP_*` | Transactional email provider |

Validate before deploy:

```bash
npm run deploy:preflight
```

The server **refuses dev JWT/REFRESH defaults** when `NODE_ENV=production`.

---

## 2. Manual payments

All payments (school fees, shop, alumni donations, and SaaS subscriptions) use **bank transfer only**.

| Flow | Who pays | Bank details source | Confirmation |
|------|----------|---------------------|--------------|
| School fees | Students/parents | School branding (`bankName`, `bankAccountNumber`) | Accountant uploads receipt review |
| Shop | Students/parents | School bank account | Admin marks order paid |
| Alumni donations | Public/alumni | School bank account | Admin confirms donation |
| SaaS billing | School admin | `PLATFORM_BANK_*` in `.env` | Super Admin reviews proof |

Set platform billing account in `.env.production`:

```env
PLATFORM_BANK_NAME=Zenith Bank
PLATFORM_BANK_ACCOUNT_NAME=SchoolPilot Ltd
PLATFORM_BANK_ACCOUNT_NUMBER=1234567890
```

Schools configure their own bank details in **Admin → School branding** for fees, shop, and donations.

---

## 3. Deploy with Docker

```bash
npm run deploy:preflight
npm run deploy:prod
```

This runs:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml --env-file .env.production up -d --build
```

Production stack includes:

- **backend** — `TRUST_PROXY=true`, binds `127.0.0.1:4000`
- **frontend** — binds `127.0.0.1:3000`
- **db** — not exposed publicly
- **backup** — daily `npm run backup:schedule` loop (retain 30 days)

Manual backup:

```bash
npm run backup:db
```

---

## 4. TLS + HSTS (nginx or Caddy)

Put nginx/Caddy in front of the Docker stack. Templates:

- **nginx:** `deploy/nginx/schoolpilot.conf`
- **Caddy:** `deploy/Caddyfile` (automatic Let's Encrypt)

Both configure:

- TLS 1.2+
- HSTS `max-age=31536000; includeSubDomains; preload`
- Reverse proxy with `X-Forwarded-Proto`

```bash
# nginx + certbot example
sudo certbot certonly --webroot -w /var/www/certbot -d app.yourdomain.com -d api.yourdomain.com
sudo ln -s $(pwd)/deploy/nginx/schoolpilot.conf /etc/nginx/sites-enabled/schoolpilot
sudo nginx -t && sudo systemctl reload nginx
```

---

## 5. Health monitoring

Docker healthchecks poll `/api/health/ready` every 30s.

External monitoring (cron every 5 min):

```bash
HEALTH_CHECK_URL=https://api.yourdomain.com/api/health/ready \
SLACK_WEBHOOK_URL=https://hooks.slack.com/... \
npm run health:monitor
```

---

## 6. Staging E2E tests

Against local stack:

```bash
docker compose up -d db
npm run db:setup
npm run dev:backend    # terminal 1
npm run dev:frontend   # terminal 2
npm run test:e2e:staging
```

Against remote staging:

```bash
STAGING_API_URL=https://api.staging.yourdomain.com \
STAGING_BASE_URL=https://staging.yourdomain.com \
npm run test:e2e:staging
```

Full suite (API + UI):

```bash
npm run test:e2e:all
```

---

## 7. Lighthouse audit (target 95+)

With frontend running:

```bash
npm run lighthouse
# or staging:
BASE_URL=https://app.staging.yourdomain.com npm run lighthouse
```

Reports saved to `reports/lighthouse/`.

---

## 8. External services

| Service | Env vars | Required for |
|---------|----------|----------------|
| **Platform bank** | `PLATFORM_BANK_*` | SaaS subscription bank transfers |
| **SMTP** | `SMTP_*` | Email notifications |
| **Cloudinary** | `CLOUDINARY_*` | Cloud file uploads |
| **Redis** | `REDIS_URL` | Multi-instance rate limits |
| **OpenAI** | `OPENAI_API_KEY` | Live AI (demo works without) |
| **Termii/Twilio** | `TERMII_*` / `TWILIO_*` | SMS |
| **VAPID** | `VAPID_*` | Web push |

---

## 9. Manual production deploy

```bash
cd src/frontend && npm ci && npm run build
npx prisma migrate deploy
NODE_ENV=production TRUST_PROXY=true node src/backend/server.js
cd src/frontend && npm start
```

---

## 10. Post-deploy verification

```bash
curl -s https://api.yourdomain.com/api/health/ready
npm run security:audit
```

### Full local pipeline (Windows)

```powershell
# After Docker Desktop shows "Running":
.\scripts\run-pipeline.ps1

# Without Docker (Postgres must be on localhost:5432):
.\scripts\run-pipeline.ps1 -Native
```

Or step by step:

```powershell
npm run deploy:preflight
npm run deploy:prod          # requires Docker Desktop running
npm run health:monitor
npm run test:e2e:staging
npm run lighthouse
```

### Docker Desktop troubleshooting

If you see `500 Internal Server Error` on `dockerDesktopLinuxEngine`:

1. Quit Docker Desktop completely (system tray → Quit).
2. Reopen **Docker Desktop** and wait until status is **Running** (can take 1–2 minutes).
3. **Troubleshoot** → **Restart** if it still fails.
4. Ensure WSL 2 is enabled: `wsl --status`
5. Retry: `npm run deploy:prod`

---

1. Health returns `"status":"ready"`
2. Super Admin login → `/super-admin`
3. Public site → `/` and `/pricing`
4. Manual fee payment → receipt upload → accountant approval
5. Backup file appears in `backups/`

---

## CI

GitHub Actions runs unit tests, API E2E, and Docker builds on every push to `main`.

See also: [SECURITY_CHECKLIST.md](./SECURITY_CHECKLIST.md), [BACKUP_RESTORE.md](./BACKUP_RESTORE.md), [DISASTER_RECOVERY.md](./DISASTER_RECOVERY.md)
