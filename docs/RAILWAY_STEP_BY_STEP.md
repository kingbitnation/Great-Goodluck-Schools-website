# Railway deploy — do this now

Deploy the **backend API only** (frontend stays on Vercel later).

---

## Step 1 — Push code to GitHub

Railway builds from your repo. These files must be on `main`:

- `Dockerfile`
- `railway.toml`
- `src/backend/` (all backend code)
- `prisma/`
- `scripts/docker-entrypoint.sh`

If you have uncommitted changes, commit and push first:

```bash
git add Dockerfile railway.toml render.neon.yaml docs/LAUNCH_VERCEL_RAILWAY.md docs/RAILWAY_STEP_BY_STEP.md scripts/smoke-launch.js src/backend package.json prisma scripts/docker-entrypoint.sh
git commit -m "Add Railway deployment config and launch tooling"
git push origin main
```

---

## Step 2 — Create Railway project

1. Go to **[railway.app](https://railway.app)** → sign in with GitHub  
2. **New Project** → **Deploy from GitHub repo**  
3. Select: `kingbitnation/Great-Goodluck-Schools-website`  
4. Railway creates a service — it uses the root `Dockerfile` automatically  

**Do not** add a Railway PostgreSQL database — you already use **Neon**.

---

## Step 3 — Set environment variables

Railway → your service → **Variables** → **Raw Editor**

Copy variable **names** from [`railway-variables.template`](./railway-variables.template), then paste **values** from your local `.env`.

**Minimum required:**

| Variable | Value |
|----------|--------|
| `DATABASE_URL` | Your Neon pooled URL (from `.env`) |
| `JWT_SECRET` | From `.env` |
| `REFRESH_SECRET` | From `.env` |
| `NODE_ENV` | `production` |
| `TRUST_PROXY` | `true` |
| `SKIP_DB_PUSH` | `true` |
| `RUN_SEED` | `false` |
| `APP_URL` | `http://localhost:3000` for now (update after Vercel) |
| `API_PUBLIC_URL` | Leave empty until deploy finishes, then set to Railway URL |

Also add from `.env`: `SMTP_*`, `CLOUDINARY_*`, `TERMII_*`, `OPENROUTER_*`, `FLUTTERWAVE_*`, `PLATFORM_BANK_*`

**CLI alternative** (after login):

```bash
npm install -g @railway/cli
railway login
railway link
npm run railway:sync-env
```

---

## Step 4 — Deploy

Railway auto-deploys on push. Or click **Deploy** in the dashboard.

Watch **Build Logs** — first build takes ~3–5 minutes.

---

## Step 5 — Get your API URL

Railway → service → **Settings** → **Networking** → **Generate Domain**

You get something like:

```text
https://schoolpilot-api-production.up.railway.app
```

Update variables and redeploy:

```env
API_PUBLIC_URL=https://YOUR-RAILWAY-DOMAIN.up.railway.app
APP_URL=https://YOUR-RAILWAY-DOMAIN.up.railway.app
```

(Later change `APP_URL` to your Vercel frontend URL.)

---

## Step 6 — Verify

```bash
API_URL=https://YOUR-RAILWAY-DOMAIN.up.railway.app npm run smoke:launch
```

Or open in browser:

- `https://YOUR-RAILWAY-DOMAIN.up.railway.app/api/health/live` → `{"status":"ok"}`
- `https://YOUR-RAILWAY-DOMAIN.up.railway.app/api/health/ready` → `"db":true`

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Build fails on Prisma | Check build logs; ensure `prisma/` is in repo |
| `not_ready` / db false | Wrong `DATABASE_URL` — use Neon **pooled** URL with `sslmode=require` |
| App crashes on start | Check **Deploy Logs** — usually missing `JWT_SECRET` |
| 502 timeout | Wait for health check; increase timeout in `railway.toml` |

---

## Next: Vercel frontend

After Railway works, deploy frontend with:

```env
BACKEND_URL=https://YOUR-RAILWAY-DOMAIN.up.railway.app
```

See [LAUNCH_VERCEL_RAILWAY.md](./LAUNCH_VERCEL_RAILWAY.md).
