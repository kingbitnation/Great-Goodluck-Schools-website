# Deploy Backend on Render (API + Postgres)

This deploys the SchoolPilot backend (`src/backend`) and a managed PostgreSQL database using the repository blueprint.

## 1) Deploy from blueprint

1. Open Render Dashboard: [https://dashboard.render.com/blueprints](https://dashboard.render.com/blueprints)
2. Click **New Blueprint Instance**
3. Select your **SchoolPilot** GitHub repository
4. Render will detect `render.yaml`
5. Confirm creation of:
   - Web service: `schoolpilot-backend`
   - Database: `schoolpilot-db`

## 2) Set required env vars on backend service

In Render service settings (`schoolpilot-backend`), set these values:

- `APP_URL` = your frontend URL (example: `https://schoolpilot-frontend-five.vercel.app`)
- `NEXT_PUBLIC_API_BASE_URL` = backend public URL (Render gives this after first deploy)
- `API_PUBLIC_URL` = same backend public URL
- `BACKEND_URL` = same backend public URL
- `PLATFORM_BANK_NAME` = your platform bank name
- `PLATFORM_BANK_ACCOUNT_NAME` = your account name
- `PLATFORM_BANK_ACCOUNT_NUMBER` = your account number

Optional but recommended:

- `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`
- `OPENAI_API_KEY`
- `TERMII_*` or `TWILIO_*`
- `CLOUDINARY_*` (recommended for production uploads)

## 3) Update Vercel env vars (frontend)

In Vercel project `schoolpilot-frontend`, set:

- `BACKEND_URL` = Render backend URL
- `API_INTERNAL_URL` = Render backend URL
- `NEXT_PUBLIC_API_BASE_URL` = Render backend URL

Then redeploy Vercel.

## 4) Verify deployment

Check these URLs:

- Backend live probe: `https://<render-backend-domain>/api/health/live`
- Backend ready probe: `https://<render-backend-domain>/api/health/ready`
- Frontend login: `https://schoolpilot-frontend-five.vercel.app/login`

## 5) Seed demo data (optional)

If you want demo users (admin/student/etc), run one-time seed by setting:

- `RUN_SEED=true`, deploy once, then set it back to `false`.

Default seed super admin:

- Email: `admin@example.com`
- Password: `admin123`
