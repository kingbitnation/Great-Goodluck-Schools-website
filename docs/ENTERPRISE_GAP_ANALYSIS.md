# SchoolPilot — Enterprise Gap Analysis

**Last updated:** June 2026  
**Purpose:** Honest assessment of platform completeness vs. enterprise competitors (Teachmint, PowerSchool, Blackbaud).

---

## Executive summary

SchoolPilot is a **strong, production-ready school ERP + LMS + SaaS core** — not a marketing slide at 100% on every module. A fair overall score is **~78–85%** toward “enterprise-grade globally,” with **core school operations at ~90–95%** and **enterprise platform layers at ~15–40%**.

The gap is not random features — it is **integration depth, automation, developer platform, operational observability, and compliance tooling** that enterprises expect on Ultimate / Enterprise plans.

---

## Corrected completeness matrix

| Area | Marketing claim | Codebase reality | Honest % | Priority |
|------|-------------------|------------------|----------|----------|
| Public website & CMS | ✅ 100% | Live pages, CMS, pricing fallbacks | **95%** | Low |
| Multi-school SaaS | ✅ 100% | Registration, trial, plans, manual billing | **90%** | Medium |
| Admissions CRM | ✅ 100% | Cycles, applications, review pipeline | **85%** | Medium |
| Student / Teacher / Parent portals | ✅ 100% | Dashboards, role nav, core flows | **90%** | Low |
| Finance & fees | ✅ 100% | Ledger, manual transfer, accountant review | **80%** | High |
| HR & Payroll | ✅ 100% | Employees, runs, payslips | **85%** | Medium |
| Library / Hostel / Transport | ✅ 100% | Full module routes + admin UI | **85%** | Low |
| Marketplace / Alumni | ✅ 100% | Orders, donations, directory | **85%** | Low |
| CBT / Results / Certificates | ✅ 100% | Exams, grading, verify portal | **88%** | Medium |
| AI suite | ✅ 100% | OpenRouter/OpenAI, credits, limits | **75%** | Medium |
| Notifications | ✅ 100% | Email, SMS, push, in-app | **85%** | Low |
| Analytics | ✅ 100% | School + platform dashboards | **70%** | High |
| Security & audit | ✅ 100% | RBAC, CSRF, 2FA, audit logs | **85%** | Medium |
| DevOps | ✅ 100% | Docker, CI, backup docs, health probes | **80%** | Medium |
| **API & Developer Portal** | ⚠️ Missing | OpenAPI doc only; **Phase 4 scaffold added** | **25%** | **Critical** |
| **Integration Marketplace** | ⚠️ Missing | Env status panel; **catalog + connect UI scaffold** | **20%** | **Critical** |
| **Workflow Automation** | ⚠️ Missing | Static notification maps; **rule engine scaffold** | **15%** | **Critical** |
| Document management | ⚠️ Missing | Uploads per module; no DMS | **30%** | High |
| Calendar hub | ⚠️ Missing | Per-module dates; no unified calendar | **25%** | High |
| Form builder | ⚠️ Missing | Fixed admission forms only | **10%** | High |
| Task / project management | ⚠️ Missing | Support tickets only | **15%** | Medium |
| Inventory / assets | ⚠️ Missing | Marketplace stock only | **20%** | Medium |
| Visitor management | ⚠️ Missing | — | **0%** | Medium |
| Maintenance module | ⚠️ Missing | — | **0%** | Medium |
| Consent management | ⚠️ Missing | — | **0%** | Medium |
| Disaster recovery UI | ⚠️ Missing | Docs + backup scripts | **40%** | High |
| Platform monitoring | ⚠️ Missing | `/super-admin/system-health` partial | **45%** | High |
| School success / growth KPIs | ⚠️ Missing | Basic MRR/school counts | **35%** | High |
| Online payment gateways | Not listed | **Removed** — manual bank transfer | **0%** live | High |

---

## What “enterprise-ready” actually requires

### Tier 1 — Launch blockers for large schools (Phase 4A)

1. **Fee payment clarity** — Paystack/Flutterwave/Stripe or clear “manual only” positioning in sales.
2. **Data import/export** — Bulk CSV for students, staff, results (partial exists; needs polish).
3. **Unified calendar** — Exams, fees, events, live classes in one view.
4. **Document vault** — Admission files, contracts, medical with permissions + expiry.
5. **Workflow automation v1** — At least: attendance streak → parent notify, fee overdue → reminder.

### Tier 2 — Enterprise plan differentiators (Phase 4B)

6. **Developer portal** — API keys, scopes, webhooks, usage analytics, rate limits.
7. **Integration marketplace** — OAuth connect for Google, Zoom, WhatsApp, storage providers.
8. **AI administration** — Per-school cost, token limits, feature toggles (extend existing credits).
9. **School success dashboard** — Churn, trial conversion, feature adoption, LTV estimates.
10. **DR dashboard** — Backup schedule UI, restore point selection, verification.

### Tier 3 — Market leader parity (Phase 5)

11. Custom form builder (drag-drop + conditional logic).
12. Visitor + maintenance + consent modules.
13. Inventory & procurement.
14. White-label mobile app workflow.
15. Full observability (CPU, queues, APM, alerting).

---

## Phase 4 implementation map (started)

| Deliverable | Status | Location |
|-------------|--------|----------|
| Master workflow blueprint | ✅ Done | [PLATFORM_WORKFLOWS.md](./PLATFORM_WORKFLOWS.md) |
| Gap analysis (this doc) | ✅ Done | This file |
| API keys + webhooks schema | ✅ Scaffold | `prisma/schema.prisma` — `DeveloperApiKey`, `WebhookEndpoint` |
| Integration catalog | ✅ Scaffold | `IntegrationProvider`, `SchoolIntegration` |
| Workflow rules engine | ✅ Scaffold | `WorkflowRule`, `lib/workflowEngine.js` |
| School admin: Integrations | ✅ Scaffold | `/admin/integrations` |
| School admin: Automation | ✅ Scaffold | `/admin/automation` |
| Super admin: Developer | ✅ Scaffold | `/super-admin/developer` |
| OpenAPI | ✅ Exists | `docs/openapi.yaml` |

---

## Recommended build order (next 8–12 weeks)

| Week | Focus | Outcome |
|------|-------|---------|
| 1–2 | Workflow v1 + calendar aggregation | Attendance/fee automations live |
| 3–4 | Developer portal MVP | Keys, webhooks, request logs |
| 5–6 | Integration marketplace MVP | Google + Zoom + Paystack connect flows |
| 7–8 | Document management v1 | Categories, permissions, version history |
| 9–10 | School success metrics | Churn, trial conversion, adoption |
| 11–12 | DR + monitoring dashboards | Restore UI, queue/AI/payment monitors |

---

## How to use this with sales

- **Starter / Standard:** Core ERP + LMS — sell honestly as “complete school operations.”
- **Premium:** Add AI, transport, marketplace — highlight automation roadmap.
- **Ultimate / Enterprise:** Require Phase 4B before promising API access, custom integrations, or SLA-backed DR.

See also: [PRODUCTION_ROADMAP.md](./PRODUCTION_ROADMAP.md) Phase 4, [PLATFORM_WORKFLOWS.md](./PLATFORM_WORKFLOWS.md).
