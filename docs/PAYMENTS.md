# SchoolPilot — Payments Guide

**Last updated:** June 2026

## How payments work

SchoolPilot supports **two payment modes** — schools can use either or both:

| Mode | Best for | Flow |
|------|----------|------|
| **Paystack (online)** | Instant collection | Student/parent pays → auto-verify → receipt |
| **Bank transfer (manual)** | Schools without gateway | Transfer → upload receipt → accountant approves |

Platform SaaS subscriptions support **Paystack** (when `PAYSTACK_SECRET_KEY` is set) **or** manual bank transfer to platform account.

---

## School fee payments

### Paystack (per school)

1. School admin → **Integrations** → connect Paystack (public + secret keys verified live).
2. Student/parent → **Fees** → choose Paystack → redirect to Paystack checkout.
3. Callback/webhook confirms payment → ledger updated → receipt generated.

**Env (optional platform fallback):** `PAYSTACK_SECRET_KEY`, `PAYSTACK_PUBLIC_KEY`

### Manual bank transfer

1. School sets bank details in **School branding**.
2. Student initiates payment → receives reference + bank details.
3. Upload receipt → accountant reviews in **Payments**.

---

## SaaS subscription billing

- **Checkout:** `/admin/billing` → manual invoice or Paystack when platform keys configured.
- **Verify:** `POST /api/subscription/verify` with `{ reference }` after Paystack redirect.
- **Webhook:** `POST /api/webhooks/paystack` (HMAC signature required).

---

## Sales positioning

- **Starter / Standard:** Manual bank transfer included on all plans.
- **Premium+:** Highlight Paystack when school connects integration.
- **Enterprise:** API webhooks on `payment.approved` events.

---

## Security

- Paystack secrets stored encrypted (`INTEGRATION_ENCRYPTION_KEY` or `JWT_SECRET`).
- Webhook signatures verified with `x-paystack-signature`.
- Manual receipts still require accountant approval (anti-fraud).
