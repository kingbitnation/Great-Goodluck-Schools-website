# SchoolPilot

Multi-tenant school management SaaS — academics, fees, CBT, LMS, HR, payroll, marketplace, and platform billing.

## Quick start

```bash
cp .env.example .env
docker compose up -d db
npm install
cd src/frontend && npm install && cd ../..
npm run db:setup
npm run dev:backend   # :4000
npm run dev:frontend  # :3000
```

**Demo login:** `admin@example.com` / `admin123`

## Documentation

| Doc | Description |
|-----|-------------|
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | System design |
| [PRODUCTION_ROADMAP.md](docs/PRODUCTION_ROADMAP.md) | Launch readiness phases |
| [USER_SETUP_CHECKLIST.md](docs/USER_SETUP_CHECKLIST.md) | **Your** pre-launch checklist (hosting, secrets, bank accounts, TLS) |
| [DEPLOYMENT.md](docs/DEPLOYMENT.md) | Production deploy guide (secrets, TLS, Paystack, E2E, Lighthouse) |
| [BACKUP_RESTORE.md](docs/BACKUP_RESTORE.md) | Database backups |
| [DISASTER_RECOVERY.md](docs/DISASTER_RECOVERY.md) | Incident response |
| [SECURITY_CHECKLIST.md](docs/SECURITY_CHECKLIST.md) | Pre-launch security audit |
| [openapi.yaml](docs/openapi.yaml) | API reference (also at `/api/docs/openapi.yaml`) |

## Testing

```bash
npm run test:unit          # Unit tests
npm run test:integration   # API integration (backend must run)
npm run test:all           # Both
npm run test:coverage      # Coverage report
npm run test:e2e           # Playwright API smoke (backend running)
npm run test:e2e:ui        # Playwright browser tests (frontend + backend)
```

## Platform admin

Super Admin → `/super-admin` — MRR, plans, billing, feature flags, communications, system health.
