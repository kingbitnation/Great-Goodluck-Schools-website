import { useEffect, useState } from 'react'
import AppLayout from '../../components/layout/AppLayout'
import { withAuth } from '../../components/withAuth'
import PricingCards, { BillingIntervalToggle } from '../../components/billing/PricingCards'
import type { Plan } from '../../components/billing/PricingCards'
import PaymentReceiptUpload, { fileToDataUrl } from '../../components/payments/PaymentReceiptUpload'
import { apiGet, apiPost, apiPut } from '../../lib/api'
import { fetchWithAuth } from '../../lib/auth'
import type { AuthUser } from '../../lib/useAuth'
import type { BillingInterval } from '../../lib/design-tokens'

type BillingData = {
  school: { id: string; name: string; status: string }
  subscription: {
    status: string
    billingInterval: string
    trialEndsAt?: string
    trialDaysRemaining?: number
    currentPeriodEnd?: string
    autoRenew: boolean
    plan?: Plan
  } | null
  usage: {
    students: { used: number; limit: number | null }
    staff: { used: number; limit: number | null }
    storage: { usedGb: number; limitGb: number | null; percent: number }
    aiCredits: number
    aiUsed: number
    emailsSent: number
    emailLimit: number | null
    smsBalance: number
  }
  invoices: Array<{ id: string; reference: string; amount: number; status: string; createdAt: string }>
  payments: Array<{ id: string; reference: string; amount: number; status: string; gateway: string }>
  receipts: Array<{ id: string; receiptNumber: string; amount: number; issuedAt: string }>
  addons: Array<{ id: string; addon: { name: string; price: number } }>
  bankDetails: { bankName: string; accountName: string; accountNumber: string }
}

function UsageBar({ label, used, limit, unit = '' }: { label: string; used: number; limit: number | null; unit?: string }) {
  const pct = limit ? Math.min(100, Math.round((used / limit) * 100)) : 0
  return (
    <div>
      <div className="flex justify-between text-sm">
        <span className="text-slate-600">{label}</span>
        <span className="font-medium">{used.toLocaleString()}{unit}{limit ? ` / ${limit.toLocaleString()}${unit}` : ' (unlimited)'}</span>
      </div>
      {limit != null && (
        <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
          <div className={`h-full rounded-full transition-all ${pct > 90 ? 'bg-red-500' : pct > 70 ? 'bg-amber-500' : 'bg-school-royal'}`} style={{ width: `${pct}%` }} />
        </div>
      )}
    </div>
  )
}

function SchoolBillingPage({ user }: { user: AuthUser }) {
  const schoolId = user.schoolId || ''
  const [data, setData] = useState<BillingData | null>(null)
  const [plans, setPlans] = useState<Plan[]>([])
  const [interval, setInterval] = useState<BillingInterval>('monthly')
  const [couponCode, setCouponCode] = useState('')
  const [error, setError] = useState('')
  const [manualPayment, setManualPayment] = useState<{ paymentId: string; reference: string; amount: number; bankDetails: BillingData['bankDetails'] } | null>(null)
  const [receiptFileName, setReceiptFileName] = useState<string | null>(null)
  const [uploadingProof, setUploadingProof] = useState(false)
  const [loading, setLoading] = useState(true)

  function load() {
    if (!schoolId) return
    apiGet<BillingData>(`/api/schools/${schoolId}/billing`).then(setData)
    apiGet<Plan[]>('/api/subscription-plans').then(setPlans).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [schoolId])

  async function checkout(planSlug: string) {
    setError('')
    try {
      const res = await apiPost<{
        checkoutUrl?: string
        manual?: boolean
        reference?: string
        amount?: number
        bankDetails?: BillingData['bankDetails']
        paymentId?: string
      }>(`/api/schools/${schoolId}/subscription/checkout`, {
        planSlug,
        billingInterval: interval,
        couponCode: couponCode || undefined,
      })
      if (res.manual && res.bankDetails && res.paymentId) {
        setManualPayment({ paymentId: res.paymentId, reference: res.reference!, amount: res.amount!, bankDetails: res.bankDetails })
        return
      }
      setError('Checkout failed — use bank transfer instructions below.')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Checkout failed')
    }
  }

  async function submitProof(file: File) {
    if (!manualPayment) return
    setUploadingProof(true)
    setError('')
    setReceiptFileName(file.name)
    try {
      const fileBase64 = await fileToDataUrl(file)
      await apiPost(`/api/schools/${schoolId}/subscription/manual-payment`, {
        paymentId: manualPayment.paymentId,
        fileBase64,
        mimeType: file.type,
      })
      setManualPayment(null)
      setReceiptFileName(null)
      load()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to submit receipt')
      setReceiptFileName(null)
    } finally {
      setUploadingProof(false)
    }
  }

  async function toggleAutoRenew() {
    await apiPut(`/api/schools/${schoolId}/subscription/auto-renew`, {
      autoRenew: !data?.subscription?.autoRenew,
    })
    load()
  }

  async function downloadInvoice(id: string, reference: string) {
    const res = await fetchWithAuth(`/api/subscription/invoices/${id}/pdf`)
    if (!res.ok) return
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `invoice-${reference}.pdf`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (!schoolId) {
    return <AppLayout user={user} title="Billing"><p className="p-8">Select a school as Super Admin.</p></AppLayout>
  }

  const sub = data?.subscription
  const isTrial = sub?.status === 'trial'

  return (
    <AppLayout user={user} title="Billing & Subscription">
      <div className="mx-auto max-w-6xl space-y-8 p-6">
        {isTrial && sub.trialDaysRemaining != null && (
          <div className={`rounded-xl border p-4 ${sub.trialDaysRemaining <= 3 ? 'border-amber-300 bg-amber-50' : 'border-school-royal/30 bg-school-royal/5'}`}>
            <p className="font-semibold text-school-navy">
              {sub.trialDaysRemaining > 0
                ? `${sub.trialDaysRemaining} day${sub.trialDaysRemaining === 1 ? '' : 's'} left in your free trial`
                : 'Your trial has expired'}
            </p>
            <p className="mt-1 text-sm text-slate-600">Full access during trial. Subscribe before expiry to avoid suspension.</p>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="content-card p-6 lg:col-span-2">
            <h2 className="font-display text-lg font-bold text-school-navy">Current Plan</h2>
            {sub ? (
              <div className="mt-4">
                <p className="text-2xl font-bold">
                  {sub.plan?.name}
                  <span className="ml-2 text-sm font-normal capitalize text-slate-500">({sub.status})</span>
                </p>
                {sub.currentPeriodEnd && (
                  <p className="mt-1 text-sm text-slate-600">
                    Renews {new Date(sub.currentPeriodEnd).toLocaleDateString()}
                  </p>
                )}
                <label className="mt-4 flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={sub.autoRenew} onChange={toggleAutoRenew} className="rounded" />
                  Enable auto-renewal
                </label>
              </div>
            ) : (
              <p className="mt-4 text-slate-500">No active subscription</p>
            )}
          </div>

          <div className="content-card p-6">
            <h2 className="font-display text-lg font-bold text-school-navy">Usage</h2>
            {data?.usage && (
              <div className="mt-4 space-y-4">
                <UsageBar label="Students" used={data.usage.students.used} limit={data.usage.students.limit} />
                <UsageBar label="Staff" used={data.usage.staff.used} limit={data.usage.staff.limit} />
                <UsageBar label="Storage" used={data.usage.storage.usedGb} limit={data.usage.storage.limitGb} unit=" GB" />
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">AI Credits</span>
                  <span>{data.usage.aiCredits} remaining ({data.usage.aiUsed} used)</span>
                </div>
              </div>
            )}
          </div>
        </div>

        <section>
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <h2 className="font-display text-xl font-bold text-school-navy">Upgrade Plan</h2>
            <BillingIntervalToggle value={interval} onChange={setInterval} />
          </div>
          <div className="mb-4 flex flex-wrap gap-4">
            <input placeholder="Coupon code" value={couponCode} onChange={(e) => setCouponCode(e.target.value.toUpperCase())} className="rounded-lg border px-3 py-2 text-sm" />
          </div>
          <p className="mb-4 text-sm text-slate-600">All subscription payments are by bank transfer. You will receive account details after selecting a plan.</p>
          {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
          {!loading && (
            <PricingCards
              plans={plans}
              interval={interval}
              currentSlug={sub?.plan?.slug}
              onSelect={checkout}
            />
          )}
        </section>

        {manualPayment && (
          <div className="content-card border-amber-200 bg-amber-50 p-6 dark:border-amber-800 dark:bg-amber-950/40">
            <h3 className="font-bold text-slate-900 dark:text-white">Manual Bank Transfer</h3>
            <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
              <div><dt className="text-slate-500 dark:text-slate-400">Bank</dt><dd className="font-medium text-slate-900 dark:text-white">{manualPayment.bankDetails.bankName}</dd></div>
              <div><dt className="text-slate-500 dark:text-slate-400">Account Name</dt><dd className="font-medium text-slate-900 dark:text-white">{manualPayment.bankDetails.accountName}</dd></div>
              <div><dt className="text-slate-500 dark:text-slate-400">Account Number</dt><dd className="font-mono font-medium text-slate-900 dark:text-white">{manualPayment.bankDetails.accountNumber}</dd></div>
              <div><dt className="text-slate-500 dark:text-slate-400">Amount</dt><dd className="font-bold text-slate-900 dark:text-white">₦{manualPayment.amount.toLocaleString()}</dd></div>
              <div className="sm:col-span-2"><dt className="text-slate-500 dark:text-slate-400">Reference</dt><dd className="font-mono font-bold text-school-royal">{manualPayment.reference}</dd></div>
            </dl>
            <div className="mt-4">
              <PaymentReceiptUpload
                uploading={uploadingProof}
                fileName={receiptFileName}
                onFile={submitProof}
              />
            </div>
          </div>
        )}

        {data?.invoices && data.invoices.length > 0 && (
          <section className="content-card p-6">
            <h2 className="font-display text-lg font-bold">Invoices & Receipts</h2>
            <ul className="mt-4 divide-y">
              {data.invoices.map((inv) => (
                <li key={inv.id} className="flex items-center justify-between py-3 text-sm">
                  <span>{inv.reference} — ₦{inv.amount.toLocaleString()} <span className="capitalize text-slate-500">({inv.status})</span></span>
                  <button type="button" onClick={() => downloadInvoice(inv.id, inv.reference)} className="text-school-royal hover:underline">Download PDF</button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </AppLayout>
  )
}

export default withAuth(SchoolBillingPage, { roles: ['SchoolAdmin', 'SuperAdmin'] })
