# Deploy SchoolPilot frontend to Vercel

Vercel hosts the **Next.js frontend** only. The **Express API + PostgreSQL** must run elsewhere (Docker on a VPS, Railway, Render, etc.).

## 1. Deploy the API first

Your API must be publicly reachable over HTTPS, for example:

- `https://api.yourdomain.com` (Docker + nginx on a VPS)
- Railway / Render / Fly.io

Set `APP_URL` on the backend to your Vercel frontend URL after step 2.

## 2. Import project on Vercel

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import your **SchoolPilot** GitHub repository (repo name may still be `Great-Goodluck-Schools-website` until you rename it on GitHub)
3. Set **Root Directory** to `src/frontend`
4. Framework: **Next.js** (auto-detected)

## 3. Environment variables (Vercel → Settings → Environment Variables)

| Variable | Example | Required |
|----------|---------|----------|
| `BACKEND_URL` | `https://api.yourdomain.com` | Yes — API proxy target (build + runtime) |
| `API_INTERNAL_URL` | Same as `BACKEND_URL` | Yes — SSR and rewrites |
| `NEXT_PUBLIC_API_BASE_URL` | Same as `BACKEND_URL` | Recommended — legacy direct calls |

Apply to **Production**, **Preview**, and **Development**.

## 4. Deploy

**From GitHub:** push to `main` — Vercel auto-deploys.

**From CLI:**

```powershell
cd C:\Users\HP\Documents\coggc\src\frontend
npx vercel login
npx vercel link
npx vercel env add BACKEND_URL production
npx vercel --prod
```

## 5. After deploy

1. Open your `*.vercel.app` URL — public pages should load
2. Test login — requires live API + database
3. Update backend `APP_URL` and CORS if needed
4. Optional: add custom domain in Vercel → Domains

## Notes

- Without `BACKEND_URL`, login and portal pages return API errors
- Web push on Vercel needs HTTPS (works by default on `*.vercel.app`)
- Do not commit `.env.production` — set secrets in Vercel dashboard only
