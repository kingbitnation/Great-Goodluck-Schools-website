# School Management System — Architecture

## Stack
- **Frontend:** Next.js 13 (Pages Router), React 18, TypeScript, Tailwind CSS
- **Backend:** Node.js, Express.js, JWT auth, Prisma ORM
- **Database:** PostgreSQL 15
- **Infra:** Docker Compose (db + backend + frontend), GitHub Actions CI, health probes, backup scripts, local/Cloudinary uploads

## Structure
```
coggc/
├── prisma/              # Schema, migrations, seed
├── src/backend/         # Express API (server.js + routes/)
├── src/frontend/        # Next.js app (pages/, components/, lib/)
├── tests/               # API smoke tests
└── .github/workflows/   # CI pipeline
```

## Roles (9)
SuperAdmin, SchoolAdmin, Teacher, Student, Parent, Accountant, Librarian, HostelManager, TransportManager

## Auth flow
Login → access JWT (15m) + HttpOnly refresh cookie (7d) → silent refresh via `/api/auth/refresh` → role-guarded APIs

## API domains
Auth, schools, users, students, teachers, classes, subjects, sessions, attendance, assignments, exams/CBT, results, fees/payments, library, hostel, transport, messages, notifications, analytics

## Public site
Marketing pages at `/`, `/about`, `/admissions`, `/contact`, `/apply`, etc. with forms posting to `/api/public/*`
