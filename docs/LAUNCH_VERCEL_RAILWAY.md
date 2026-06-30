# Launch Guide — Vercel + Railway/Render + Neon

Production stack for SchoolPilot Phase A:

| Layer | Service | Notes |
|-------|---------|--------|
| Database | **Neon** | PostgreSQL, already configured |
| Backend API | **Railway** or **Render** | Docker image from repo root |
| Frontend | **Vercel** | Next.js in `src/frontend` |

---

## 1. Neon (database) — done

Your schema is pushed and seeded. For production:

1. [Neon Console](https://console.neon.tech) → reset password if it was ever shared in chat
2. Copy connection string with `?sslmode=require`
3. Optional: use **pooled** URL (`-pooler` in hostname) for serverless/high concurrency

```env
DATABASE_URL=postgresql://USER:PASSWORD@ep-xxx-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require
```

Set `SKIP_DB_PUSH=true` on Railway/Render after the first deploy (schema already exists).

---

## 2. Generate production secrets

```bash
cp .env.production.example .env.production
npm run secrets:generate -- --write
```

Fill every `CHANGE_ME` value. Run:

```bash
npm run deploy:preflight
```

---

## 3. Deploy backend (Railway)

1. [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub repo**
2. Root directory: repository root (not `src/frontend`)
3. Railway detects `railway.toml` + `Dockerfile`
4. **Variables** — paste from `.env.production`:

| Variable | Example |
|----------|---------|
| `DATABASE_URL` | Neon connection string |
| `JWT_SECRET` / `REFRESH_SECRET` | from `secrets:generate` |
| `NODE_ENV` | `production` |
| `TRUST_PROXY` | `true` |
| `PORT` | `4000` |
| `APP_URL` | `https://your-app.vercel.app` |
| `API_PUBLIC_URL` | `https://your-api.up.railway.app` |
| `SKIP_DB_PUSH` | `true` |
| `RUN_SEED` | `false` |

5. Deploy → copy public URL (e.g. `https://schoolpilot-api.up.railway.app`)
6. Verify: `GET https://YOUR-API/api/health/ready` → `"status":"ready"`

### Render alternative

```bash
# Or use Render dashboard → New Blueprint → render.neon.yaml
```

Set the same env vars as Railway.

---

## 4. Deploy frontend (Vercel)

1. [vercel.com](https://vercel.com) → **Import** GitHub repo
2. **Root Directory:** `src/frontend`
3. Framework: Next.js (auto-detected)
4. **Environment variables:**

| Variable | Value |
|----------|--------|
| `BACKEND_URL` | `https://your-api.up.railway.app` |
| `NEXT_PUBLIC_API_BASE_URL` | Same as `BACKEND_URL` (for SSR/public pages) |
| `NEXT_PUBLIC_PLATFORM_BANK_NAME` | Platform bank for registration |
| `NEXT_PUBLIC_PLATFORM_BANK_ACCOUNT_NAME` | |
| `NEXT_PUBLIC_PLATFORM_BANK_ACCOUNT_NUMBER` | |

5. Deploy → copy Vercel URL
6. **Update Railway** `APP_URL` to your Vercel URL and redeploy (OAuth callbacks, emails, payment redirects)

### How API routing works

- Browser calls `/api/...` on the Vercel domain
- `next.config.js` rewrites to `BACKEND_URL/api/...`
- No CORS issues for same-origin requests

---

## 5. Payments go-live

### Platform SaaS (school registration / billing)

| Gateway | Env vars |
|---------|----------|
| Manual bank | `PLATFORM_BANK_*` |
| Paystack | `PAYSTACK_SECRET_KEY`, `PAYSTACK_PUBLIC_KEY` |

Webhook URL: `https://YOUR-API/api/webhooks/paystack`

### Per-school fees

School admin → **Integrations** → connect Paystack / Flutterwave / Stripe with live keys.

| Gateway | Platform fallback env |
|---------|----------------------|
| Paystack | `PAYSTACK_SECRET_KEY` |
| Flutterwave | `FLUTTERWAVE_SECRET_KEY`, `FLUTTERWAVE_SECRET_HASH` |
| Stripe | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` |

Webhooks:

- `POST /api/webhooks/paystack`
- `POST /api/webhooks/flutterwave`
- `POST /api/webhooks/stripe`

---

## 6. Email & SMS

### Gmail SMTP

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=you@gmail.com
SMTP_PASS=your_16_char_app_password
SMTP_FROM="SchoolPilot <you@gmail.com>"
```

Use a [Google App Password](https://myaccount.google.com/apppasswords) — not your main Gmail password.

### Termii SMS

```env
SMS_PROVIDER=termii
TERMII_API_KEY=your_key
TERMII_SENDER_ID=SchoolPilot
```

Test: register school → phone OTP on `/register-school`.

---

## 7. AI (OpenRouter)

```env
OPENROUTER_API_KEY=sk-or-v1-...
OPENROUTER_MODEL=openai/gpt-4o
AI_MODEL=openai/gpt-4o
AI_MAX_TOKENS=2048
```

Verify: `GET /api/ai/status` (authenticated) → `"provider":"openrouter"`.

---

## 8. School onboarding QA checklist

Run after deploy:

```bash
npm run smoke:launch
```

Manual flow:

1. `/register-school` → choose plan → bank details → upload receipt → documents → verify phone → create account
2. `/admin/setup-wizard` → complete school setup
3. `/admin/students` → add student or **Import CSV**
4. `/admin/integrations` → connect Paystack (test keys first)
5. Student login → `/student/fees` → test payment method

Super admin: `/super-admin/billing` → approve pending SaaS payments.

---

## 9. Post-launch

- [ ] Change seed passwords (`admin@example.com`, `sadmin@demoschool.edu`)
- [ ] Uptime monitor on `/api/health/ready`
- [ ] Neon automatic backups (enabled by default)
- [ ] Cloudinary for uploads in production
- [ ] Rotate any secrets shared in support chats

---

## Quick command reference

```bash
npm run deploy:preflight      # validate .env.production
npm run smoke:launch          # API smoke tests (set API_URL)
npm run vercel:deploy         # frontend CLI deploy
npm run secrets:generate      # new JWT secrets
```
