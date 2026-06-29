# SchoolPilot — Platform Workflows

**Last updated:** June 2026  
**Purpose:** End-to-end operational blueprint — every major journey from visitor to platform owner, mapped to real routes and APIs.

**Legend:** ✅ Implemented · ⚠️ Partial · ❌ Not built · 🔧 Phase 4 scaffold

---

## Master lifecycle

```text
Marketing Website → Register School → Verify Email → Trial/Subscription
  → Setup Wizard → Admissions → Academics → Teaching (LMS+AI)
  → Attendance → CBT/Results → Finance/Payroll → Library/Hostel/Transport
  → Marketplace/Alumni → Analytics → Automation → Monitoring → Renewal
```

---

## 1. Platform (SaaS) workflow

| Step | Route / API | Status |
|------|-------------|--------|
| Visitor lands | `/` | ✅ |
| Browse features | `/` (PlatformFeatures), `/pricing` | ✅ |
| Choose plan | `/pricing` | ✅ |
| Register school | `/register-school` | ✅ |
| Upload docs + payment ref | `POST /api/saas/register` | ✅ |
| Super admin approves | `/super-admin/schools` | ✅ |
| Verify email | `POST /api/auth/verify-email` | ✅ |
| Trial / subscription | `SchoolSubscription` + `/admin/billing` | ✅ |
| Setup wizard | `/admin/setup-wizard` | ✅ |
| School dashboard | `/dashboard` | ✅ |

---

## 2. Subscription workflow

| Step | Route / API | Status |
|------|-------------|--------|
| 14-day trial starts | `subscriptionJobs.js` | ✅ |
| Reminder emails | `dispatchNotification` + email queue | ✅ |
| Upgrade / checkout | `/admin/billing`, `POST /api/schools/:id/subscription/checkout` | ✅ |
| Manual payment + receipt | Bank transfer + admin verify | ✅ |
| Renewal reminder | `subscriptionJobs.js` | ✅ |
| Grace period | `graceEndsAt` on subscription | ✅ |
| Suspend school | Status `suspended` | ✅ |
| Reactivate | `/super-admin/billing` manual override | ✅ |
| Online Paystack/Stripe | — | ❌ Removed |

---

## 3. School setup wizard

| Step | Route / API | Status |
|------|-------------|--------|
| Upload logo / colors | `/admin/school-branding` | ✅ |
| Custom domain | `/admin/school-branding` + DNS TXT | ⚠️ SSL manual |
| School information | Setup wizard profile step | ✅ |
| Academic calendar | `/admin/sessions`, `/admin/terms` | ✅ |
| Create admin users | `/admin/users` | ✅ |
| Complete setup | `PUT /api/schools/:id/onboarding` | ✅ |

---

## 4. Admission workflow

| Step | Route / API | Status |
|------|-------------|--------|
| Public application | `/apply`, `POST /api/admission/applications` | ✅ |
| Document upload | Application `documents` JSON | ✅ |
| Admin review | `/admin/admissions` | ✅ |
| Entrance exam | CBT link to admission cycle | ⚠️ Manual link |
| Interview | Application status notes | ⚠️ |
| Decision / offer | Status transitions | ✅ |
| Acceptance fee | Finance module | ✅ |
| Enroll → student account | Approve → create student | ✅ |
| Parent account | Linked on enrollment | ✅ |
| Student ID | `/admin/id-cards` | ✅ |

---

## 5. Academic workflow

| Step | Route | Status |
|------|-------|--------|
| Session | `/admin/sessions` | ✅ |
| Term | `/admin/terms` | ✅ |
| Classes | `/admin/classes` | ✅ |
| Subjects | `/admin/subjects` | ✅ |
| Teachers | `/admin/teachers` | ✅ |
| Students | `/admin/students` | ✅ |
| Timetable | `/admin/timetable` | ✅ |

---

## 6. Teacher workflow

| Step | Route | Status |
|------|-------|--------|
| Login | `/login` | ✅ |
| Dashboard | `/teacher` | ✅ |
| Today's timetable | Teacher dashboard | ✅ |
| Mark attendance | `/teacher/attendance`, `POST /api/attendance` | ✅ |
| Lesson / assignment | `/teacher/lms` | ✅ |
| AI lesson / exam gen | `/teacher/ai` | ✅ |
| CBT create | `/teacher/cbt` | ✅ |
| Grade & publish results | `/teacher/results` | ✅ |
| Parent notify | `notificationDispatcher` | ✅ |

---

## 7. Student workflow

| Step | Route | Status |
|------|-------|--------|
| Dashboard | `/student` | ✅ |
| Timetable | Student dashboard | ✅ |
| Live class | `/student/live-classes` | ✅ |
| LMS materials | `/student/lms` | ✅ |
| Submit assignment | LMS submit endpoints | ✅ |
| Take CBT | `/student/cbt` | ✅ |
| AI tutor | `/student/ai-tutor` | ✅ |
| Results | `/student/results` | ✅ |
| Certificate | `/student/certificates` | ✅ |

---

## 8. Parent workflow

| Step | Route | Status |
|------|-------|--------|
| Choose child | `/parent` | ✅ |
| Attendance | `/parent/attendance` | ✅ |
| Results | `/parent/results` | ✅ |
| Fees / pay | `/parent/fees` | ✅ |
| Transport tracking | `/parent/transport` | ⚠️ Manual GPS |
| Messages | `/parent/messages` | ✅ |
| AI summary | `/parent/ai-summary` | ✅ |
| Notifications | `/notifications` | ✅ |

---

## 9. Finance / fee payment workflow

| Step | Route / API | Status |
|------|-------------|--------|
| View outstanding | `/student/fees`, `/parent/fees` | ✅ |
| Generate reference | Payment reference on initiate | ✅ |
| Paystack / Flutterwave / Stripe | — | ❌ |
| Manual transfer | School bank on branding page | ✅ |
| Upload receipt | `POST /api/payments` with receipt | ✅ |
| Accountant review | `/admin/payments` | ✅ |
| Approve / reject | `PATCH /api/payments/:id` | ✅ |
| Ledger + receipt | Finance routes | ✅ |
| Notify parent/student | Notifications | ✅ |

---

## 10. Accountant workflow

| Step | Route | Status |
|------|-------|--------|
| Pending payments | `/admin/payments` | ✅ |
| Approve / reject | Payment admin actions | ✅ |
| Financial reports | `/admin/finance` | ✅ |
| Export | Report export endpoints | ⚠️ |

---

## 11. HR & payroll workflows

| Step | Route | Status |
|------|-------|--------|
| Job vacancy | `/admin/hr/jobs` | ✅ |
| Applications | HR applications | ✅ |
| Hire → employee | `/admin/hr/employees` | ✅ |
| Leave | `/admin/hr/leave` | ✅ |
| Salary structure | `/admin/payroll/settings` | ✅ |
| Payroll run | `/admin/payroll/runs` | ✅ |
| Payslip | Employee portal | ✅ |
| Bank export | Payroll export | ⚠️ |

---

## 12. CBT workflow

| Step | Route | Status |
|------|-------|--------|
| Teacher creates exam | `/teacher/cbt` | ✅ |
| Question bank | `/admin/question-bank` | ✅ |
| Student takes exam | `/student/cbt` | ✅ |
| Timer + autosave | CBT session API | ✅ |
| Auto grade | CBT grading | ✅ |
| Teacher review | Results review | ✅ |
| Publish | Publish results flow | ✅ |

---

## 13. Results & certificate workflows

| Step | Route | Status |
|------|-------|--------|
| Enter scores | `/teacher/results` | ✅ |
| Department / principal approval | Results workflow states | ⚠️ |
| Publish + notify | Results publish | ✅ |
| Report card | `/admin/results` broadsheet | ✅ |
| Certificate + QR verify | `/certificates/verify/:code` | ✅ |

---

## 14. Library / hostel / transport

| Module | Admin route | Status |
|--------|-------------|--------|
| Library borrow/return/fine | `/admin/library` | ✅ |
| Hostel allocate | `/admin/hostel` | ✅ |
| Transport + GPS | `/admin/transport`, parent tracking | ⚠️ GPS partial |

---

## 15. Marketplace & alumni

| Step | Route | Status |
|------|-------|--------|
| Browse / cart / checkout | `/marketplace` | ✅ |
| Order + delivery | `/admin/marketplace-orders` | ✅ |
| Alumni directory / events | `/alumni`, `/admin/alumni` | ✅ |
| Donations | `/admin/alumni-donations` | ✅ |

---

## 16. AI workflow

| Step | API | Status |
|------|-----|--------|
| Choose tool | `/api/ai/*` | ✅ |
| Credits check | `AiCreditBalance` | ✅ |
| OpenRouter / OpenAI | `aiRoutes.js` | ✅ |
| Usage logged | `FeatureUsageLog`, `SchoolUsageDaily` | ✅ |
| Platform AI admin | `/super-admin` metrics | ⚠️ |

---

## 17. Notification workflow

| Step | Component | Status |
|------|-----------|--------|
| System event | Module routes | ✅ |
| Dispatcher | `notificationDispatcher.js` | ✅ |
| Email / SMS / push / in-app | Queues + VAPID | ✅ |
| Delivery logs | Email/SMS queue tables | ⚠️ |

---

## 18. Support workflow

| Step | Route | Status |
|------|-------|--------|
| Create ticket | `/support` | ✅ |
| Assign agent | `/super-admin/support` | ✅ |
| Conversation | Ticket messages API | ✅ |
| Resolved + rating | Ticket status | ⚠️ Rating partial |

---

## 19. Backup workflow

| Step | Location | Status |
|------|----------|--------|
| Automatic backup | `npm run backup:db`, Docker | ✅ |
| Cloud storage | Docs + Cloudinary for uploads | ⚠️ |
| Restore | `docs/BACKUP_RESTORE.md` | ⚠️ Manual |
| DR dashboard | — | ❌ |

---

## Enterprise workflows (Phase 4)

### 20. API & developer portal

```text
Developer → Generate API Key → Permissions → Secret (once) → REST API
  → Webhooks → Usage analytics → Rate limits → Revoke
```

| Step | Route / API | Status |
|------|-------------|--------|
| OpenAPI spec | `GET /api/docs/openapi.yaml` | ✅ |
| API keys CRUD | `/api/developer/keys` | 🔧 |
| Webhook endpoints | `/api/developer/webhooks` | 🔧 |
| API key auth on REST | Middleware | 🔧 |
| OAuth for third parties | — | ❌ |
| SDKs | — | ❌ |
| Super admin overview | `/super-admin/developer` | 🔧 |

### 21. Integration marketplace

```text
Admin → Browse apps → Authenticate → Configure → Test → Activate → Sync logs
```

| Step | Route | Status |
|------|-------|--------|
| Catalog | `/api/developer/integrations/catalog` | 🔧 |
| School connections | `/admin/integrations` | 🔧 |
| Google / Zoom / WhatsApp live OAuth | — | ❌ |
| Env status only | `/super-admin/system-health` | ⚠️ |

### 22. Workflow automation

```text
Admin → Trigger + Conditions + Actions → Save → Auto execute → Logs
```

Example: **3 consecutive absences** → email parent → SMS → notify teacher → create task.

| Step | Route / API | Status |
|------|-------------|--------|
| Rule CRUD | `/api/developer/workflows` | 🔧 |
| Attendance trigger | `workflowEngine.js` on `POST /api/attendance` | 🔧 |
| Fee overdue trigger | — | ❌ |
| Visual builder UI | — | ❌ |
| Run logs | `WorkflowRun` model | 🔧 |
| Admin UI | `/admin/automation` | 🔧 |

### 23. Document management

```text
Upload → Scan → Categorize → Permissions → Version → Archive → Audit
```

| Status | Notes |
|--------|-------|
| ❌ | Per-module uploads exist; no unified DMS |

### 24. Calendar hub

| Status | Notes |
|--------|-------|
| ❌ | Events scattered across sessions, exams, live classes, fees |

### 25. Inventory / visitor / maintenance / consent

| Module | Status |
|--------|--------|
| Inventory & assets | ❌ |
| Visitor management | ❌ |
| Maintenance tickets | ❌ |
| Parent consent forms | ❌ |

### 26. Platform monitoring

| Step | Route | Status |
|------|-------|--------|
| Health probe | `/api/health/ready`, `/api/platform/health` | ⚠️ |
| CPU / RAM / DB | Partial in health JSON | ⚠️ |
| Queue depth | Email/SMS counts | ⚠️ |
| Full APM | — | ❌ |

### 27. School success dashboard

| KPI | Status |
|-----|--------|
| Active schools / users | ✅ `/super-admin` |
| MRR / ARR | ⚠️ Billing overview |
| Churn / LTV / CAC | ❌ |
| Feature adoption | ⚠️ `FeatureUsageLog` |
| Trial conversion | ⚠️ Manual from metrics |

### 28. Platform super admin business workflow

| Step | Route | Status |
|------|-------|--------|
| Registration pipeline | `/super-admin/schools` | ✅ |
| Subscription & invoices | `/super-admin/billing` | ✅ |
| Support | `/super-admin/support` | ✅ |
| Communications | `/super-admin/communications` | ✅ |
| Feature flags | `/super-admin/feature-flags` | ✅ |
| Referrals | `/super-admin/referrals` | ✅ |
| Growth executive dashboard | — | ⚠️ |

---

## Cross-module automation examples (target state)

| Trigger | Actions |
|---------|---------|
| Student absent 3 days | Email + SMS parent, notify teacher, workflow log |
| Fee overdue 7 days | Reminder email, flag accountant dashboard |
| Payment approved | Ledger update, receipt PDF, parent notify, webhook `payment.approved` |
| CBT submitted | Auto-grade, teacher review queue, webhook `exam.submitted` |
| Trial expires in 3 days | Email admin, in-app banner, success team alert |

---

## Related docs

- [ENTERPRISE_GAP_ANALYSIS.md](./ENTERPRISE_GAP_ANALYSIS.md) — honest % complete and phased roadmap
- [PRODUCTION_ROADMAP.md](./PRODUCTION_ROADMAP.md) — Phase 4 enterprise modules
- [openapi.yaml](./openapi.yaml) — REST API reference (expanding)
- [PAGE_TEST_CHECKLIST.md](./PAGE_TEST_CHECKLIST.md) — QA every route
