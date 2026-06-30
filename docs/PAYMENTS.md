# SchoolPilot — Payments Guide

**Last updated:** June 2026

## How payments work

SchoolPilot supports **four payment modes** — schools can use any combination:

| Mode | Best for | Flow |
|------|----------|------|
| **Paystack (online)** | Nigeria instant collection | Student/parent pays → auto-verify → receipt |
| **Flutterwave (online)** | Multi-currency Nigeria/Africa | Redirect checkout → webhook/verify → receipt |
| **Stripe (online)** | International cards | Stripe Checkout → webhook/verify → receipt |
| **Bank transfer (manual)** | Schools without gateway | Transfer → upload receipt → accountant approves |

Platform SaaS subscriptions support **Paystack** (when `PAYSTACK_SECRET_KEY` is set) **or** manual bank transfer to platform account.

---

## School fee payments

### Per-school gateway setup

1. School admin → **Integrations** → connect Paystack, Flutterwave, or Stripe (keys verified live against each provider API).
2. Student/parent → **Fees** → choose gateway → redirect to checkout.
3. Callback/webhook confirms payment → ledger updated → receipt generated.

**Platform fallback env (optional):**

- `PAYSTACK_SECRET_KEY`, `PAYSTACK_PUBLIC_KEY`
- `FLUTTERWAVE_SECRET_KEY`, `FLUTTERWAVE_PUBLIC_KEY`, `FLUTTERWAVE_SECRET_HASH`
- `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`

### Manual bank transfer

1. School sets bank details in **School branding**.
2. Student initiates payment → receives reference + bank details.
3. Upload receipt → accountant reviews in **Payments**.

---

## Webhooks

| Provider | Endpoint | Header |
|----------|----------|--------|
| Paystack | `POST /api/webhooks/paystack` | `x-paystack-signature` |
| Flutterwave | `POST /api/webhooks/flutterwave` | `verif-hash` |
| Stripe | `POST /api/webhooks/stripe` | `stripe-signature` |

---

## SaaS subscription billing

- **Checkout:** `/admin/billing` → manual invoice or Paystack when platform keys configured.
- **Verify:** `POST /api/subscription/verify` with `{ reference }` after Paystack redirect.
- **Webhook:** `POST /api/webhooks/paystack` (HMAC signature required).

---

## Security

- Gateway secrets stored encrypted (`INTEGRATION_ENCRYPTION_KEY` or `JWT_SECRET`).
- Webhook signatures verified per provider.
- Manual receipts still require accountant approval (anti-fraud).
