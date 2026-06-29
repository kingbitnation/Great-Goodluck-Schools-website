# SchoolPilot — Page-by-page test checklist

Print this file or open in any markdown viewer. Mark **Pass** / **Fail** / **Skip** as you test.

**Base URL (local):** http://localhost:3000  
**Base URL (Vercel):** _your-project_.vercel.app  
**Default seed password:** `admin123`

---

## Test accounts

| Role | Email |
|------|--------|
| Super Admin | `admin@example.com` |
| School Admin | `sadmin@demoschool.edu` |
| Teacher | `teacher@demoschool.edu` |
| Student | `student@demoschool.edu` |
| Parent | `parent@demoschool.edu` |
| Accountant | `accountant@demoschool.edu` |
| HR | `hr@demoschool.edu` |
| Librarian | `librarian@demoschool.edu` |
| Hostel | `hostel@demoschool.edu` |
| Transport | `transport@demoschool.edu` |
| Biometric | `biometric@demoschool.edu` |
| Alumni | `alumni@demoschool.edu` |

---

## A. Public website (no login)

| Pass | Fail | Page | URL |
|:----:|:----:|------|-----|
| ☐ | ☐ | Home | `/` |
| ☐ | ☐ | About | `/about` |
| ☐ | ☐ | Academics | `/academics` |
| ☐ | ☐ | Admissions | `/admissions` |
| ☐ | ☐ | Apply | `/apply` |
| ☐ | ☐ | Application status | `/application/status` |
| ☐ | ☐ | Pricing | `/pricing` |
| ☐ | ☐ | Register school | `/register-school` |
| ☐ | ☐ | News | `/news` |
| ☐ | ☐ | Blog | `/blog` |
| ☐ | ☐ | Events | `/events` |
| ☐ | ☐ | Gallery | `/gallery` |
| ☐ | ☐ | Staff | `/staff` |
| ☐ | ☐ | Departments | `/departments` |
| ☐ | ☐ | Careers | `/careers` |
| ☐ | ☐ | Contact | `/contact` |
| ☐ | ☐ | Mission | `/mission` |
| ☐ | ☐ | Vision | `/vision` |
| ☐ | ☐ | History | `/history` |
| ☐ | ☐ | FAQ | `/faq` |
| ☐ | ☐ | Privacy | `/privacy` |
| ☐ | ☐ | Terms | `/terms` |
| ☐ | ☐ | Verify certificate | `/verify-certificate` |
| ☐ | ☐ | Verify ID card | `/verify-id-card` |
| ☐ | ☐ | Alumni join | `/alumni/join` |

---

## B. Authentication

| Pass | Fail | Page | URL |
|:----:|:----:|------|-----|
| ☐ | ☐ | Login | `/login` |
| ☐ | ☐ | Forgot password | `/forgot-password` |
| ☐ | ☐ | Security | `/settings/security` |
| ☐ | ☐ | Notifications + push | `/settings/notifications` |

---

## C. Super Admin

| Pass | Fail | Page | URL |
|:----:|:----:|------|-----|
| ☐ | ☐ | Platform dashboard | `/super-admin` |
| ☐ | ☐ | Schools | `/super-admin/schools` |
| ☐ | ☐ | Plans | `/super-admin/plans` |
| ☐ | ☐ | Billing | `/super-admin/billing` |
| ☐ | ☐ | Referrals | `/super-admin/referrals` |
| ☐ | ☐ | Feature flags | `/super-admin/feature-flags` |
| ☐ | ☐ | Support | `/super-admin/support` |
| ☐ | ☐ | Communications | `/super-admin/communications` |
| ☐ | ☐ | System health | `/super-admin/system-health` |
| ☐ | ☐ | All users | `/super-admin/users` |

---

## D. School Admin (sample — full list in repo)

| Pass | Fail | Page | URL |
|:----:|:----:|------|-----|
| ☐ | ☐ | Dashboard | `/dashboard` |
| ☐ | ☐ | Setup wizard | `/admin/setup-wizard` |
| ☐ | ☐ | Branding | `/admin/school-branding` |
| ☐ | ☐ | Website CMS | `/admin/website-cms` |
| ☐ | ☐ | Students | `/admin/students` |
| ☐ | ☐ | Teachers | `/admin/teachers` |
| ☐ | ☐ | Classes | `/admin/classes` |
| ☐ | ☐ | Results | `/admin/results` |
| ☐ | ☐ | Admissions | `/admin/admissions` |
| ☐ | ☐ | Finance | `/accountant/finance` |
| ☐ | ☐ | Verify payments | `/accountant/payments` |
| ☐ | ☐ | CBT exams | `/admin/cbt-exams` |
| ☐ | ☐ | LMS courses | `/admin/lms-courses` |
| ☐ | ☐ | Marketplace | `/admin/marketplace` |
| ☐ | ☐ | Shop orders | `/admin/marketplace-orders` |
| ☐ | ☐ | SMS & push | `/admin/notification-settings` |
| ☐ | ☐ | Analytics | `/admin/analytics` |
| ☐ | ☐ | Audit logs | `/admin/audit-logs` |

---

## E. Teacher / Student / Parent / Alumni

| Pass | Fail | Portal | URL |
|:----:|:----:|--------|-----|
| ☐ | ☐ | Teacher | `/teacher` |
| ☐ | ☐ | Student | `/student` |
| ☐ | ☐ | Parent | `/parent` |
| ☐ | ☐ | Alumni | `/alumni` |

---

## Sign-off

| Tester | Date | Environment | Pass | Fail | Notes |
|--------|------|-------------|------|------|-------|
| | | | | | |
