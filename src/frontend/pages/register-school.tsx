import Link from 'next/link'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/router'
import PublicLayout from '../components/layout/PublicLayout'
import Seo from '../components/Seo'
import { SchoolLogo } from '../components/public/Brand'
import PricingCards, { BillingIntervalToggle, type Plan } from '../components/billing/PricingCards'
import type { BillingInterval } from '../lib/design-tokens'
import { saveToken } from '../lib/auth'
import { apiBaseUrl, parseJsonResponse } from '../lib/apiBase'
import { fetchSubscriptionPlans } from '../lib/fetchPlans'
import { passwordMeetsRules, passwordsMatch } from '../lib/passwordRules'
import PasswordRulesList from '../components/ui/PasswordRulesList'

type Step = 'plan' | 'payment' | 'documents' | 'details'

type Quote = {
  plan: Plan
  billingInterval: BillingInterval
  amount: number
  currency: string
  reference: string
  bankDetails: {
    bankName: string
    accountName: string
    accountNumber: string
    amount: number
    reference: string
  }
}

type UploadedDoc = {
  documentType: string
  label: string
  url: string
  fileName: string
}

const DOC_TYPES = [
  { type: 'cac', label: 'CAC / business registration certificate' },
  { type: 'license', label: 'Government school approval or license' },
  { type: 'premises', label: 'Utility bill or photo of school premises' },
  { type: 'other', label: 'Other official document' },
]

const STEPS: { id: Step; label: string }[] = [
  { id: 'plan', label: 'Choose plan' },
  { id: 'payment', label: 'Pay' },
  { id: 'documents', label: 'Verify school' },
  { id: 'details', label: 'Your account' },
]

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function priceForPlan(plan: Plan | undefined, interval: BillingInterval) {
  if (!plan || plan.contactSales) return null
  if (interval === 'yearly' && plan.yearlyPrice) return plan.yearlyPrice
  if (interval === 'quarterly' && plan.quarterlyPrice) return plan.quarterlyPrice
  return plan.price
}

export default function RegisterSchool() {
  const router = useRouter()
  const referralCode = typeof router.query.ref === 'string' ? router.query.ref : ''
  const initialPlan = typeof router.query.plan === 'string' ? router.query.plan : ''

  const [step, setStep] = useState<Step>('plan')
  const [plans, setPlans] = useState<Plan[]>([])
  const [interval, setInterval] = useState<BillingInterval>('monthly')
  const [quote, setQuote] = useState<Quote | null>(null)
  const [loadingPlans, setLoadingPlans] = useState(true)
  const [loadingQuote, setLoadingQuote] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadingReceipt, setUploadingReceipt] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    schoolName: '',
    adminFirstName: '',
    adminLastName: '',
    adminEmail: '',
    adminPhone: '',
    address: '',
    city: '',
    country: 'Nigeria',
    proposedPlanSlug: '',
    registrationNumber: '',
    password: '',
    confirm: '',
    paymentReference: '',
  })
  const [phoneCode, setPhoneCode] = useState('')
  const [phoneVerificationToken, setPhoneVerificationToken] = useState('')
  const [phoneVerified, setPhoneVerified] = useState(false)
  const [phoneDevHint, setPhoneDevHint] = useState('')
  const [sendingCode, setSendingCode] = useState(false)
  const [verifyingCode, setVerifyingCode] = useState(false)
  const [documents, setDocuments] = useState<UploadedDoc[]>([])
  const [paymentReceipt, setPaymentReceipt] = useState<{ url: string; fileName: string } | null>(null)
  const [pendingDocType, setPendingDocType] = useState(DOC_TYPES[0].type)

  useEffect(() => {
    fetchSubscriptionPlans()
      .then((data: Plan[]) => {
        setPlans(data)
        const slug = resolveInitialPlan(data, initialPlan)
        setForm((f) => ({ ...f, proposedPlanSlug: slug }))
      })
      .catch(() => setError('Could not load subscription plans'))
      .finally(() => setLoadingPlans(false))
  }, [initialPlan])

  const selectedPlan = plans.find((p) => p.slug === form.proposedPlanSlug)

  const loadQuote = useCallback(async (planSlug: string, billingInterval: BillingInterval) => {
    setLoadingQuote(true)
    setError('')
    try {
      const res = await fetch(
        `${apiBaseUrl()}/api/public/schools/register/quote?planSlug=${encodeURIComponent(planSlug)}&interval=${billingInterval}`
      )
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || 'Could not load payment details')
      if (body.contactSales) {
        setError('Ultimate plan requires sales contact — choose another plan or contact us.')
        setQuote(null)
        return
      }
      setQuote(body)
      setForm((f) => (f.paymentReference ? f : { ...f, paymentReference: body.reference }))
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Quote failed')
    } finally {
      setLoadingQuote(false)
    }
  }, [])

  useEffect(() => {
    if (step === 'payment' && form.proposedPlanSlug) {
      loadQuote(form.proposedPlanSlug, interval)
    }
  }, [step, form.proposedPlanSlug, interval, loadQuote])

  function resolveInitialPlan(data: Plan[], slug: string) {
    if (slug && data.some((p) => p.slug === slug)) return slug
    return data.find((p) => p.isPopular)?.slug || data[0]?.slug || 'standard'
  }

  function goNext() {
    setError('')
    if (step === 'plan') {
      if (!form.proposedPlanSlug) {
        setError('Select a subscription plan to continue')
        return
      }
      setStep('payment')
      return
    }
    if (step === 'payment') {
      if (!form.paymentReference.trim()) {
        setError('Enter the bank transfer reference you used (or copy the one we generated)')
        return
      }
      if (!paymentReceipt?.url) {
        setError('Upload a screenshot or PDF of your bank transfer receipt')
        return
      }
      setStep('documents')
      return
    }
    if (step === 'documents') {
      if (documents.length < 1) {
        setError('Upload at least one document proving your school exists')
        return
      }
      setStep('details')
    }
  }

  function goBack() {
    setError('')
    const order: Step[] = ['plan', 'payment', 'documents', 'details']
    const idx = order.indexOf(step)
    if (idx > 0) setStep(order[idx - 1])
  }

  async function uploadRegistrationFile(file: File, documentType: string) {
    const fileBase64 = await fileToBase64(file)
    const res = await fetch(`${apiBaseUrl()}/api/public/schools/register/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileBase64, documentType, originalName: file.name }),
    })
    const body = await parseJsonResponse<{ error?: string; url?: string }>(res)
    if (!res.ok) throw new Error(body.error || 'Upload failed')
    if (!body.url) throw new Error('Upload failed — no file URL returned')
    return { url: body.url, fileName: file.name }
  }

  async function sendPhoneCode() {
    if (!form.adminPhone.trim()) {
      setError('Enter your phone number first')
      return
    }
    setSendingCode(true)
    setError('')
    setPhoneDevHint('')
    setPhoneVerified(false)
    setPhoneVerificationToken('')
    try {
      const res = await fetch(`${apiBaseUrl()}/api/public/schools/register/phone/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: form.adminPhone }),
      })
      const body = await parseJsonResponse<{ error?: string; message?: string; devCode?: string }>(res)
      if (!res.ok) throw new Error(body.error || 'Could not send code')
      setPhoneDevHint(body.devCode ? `Dev code: ${body.devCode}` : (body.message || 'Code sent'))
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not send code')
    } finally {
      setSendingCode(false)
    }
  }

  async function verifyPhoneCode() {
    setVerifyingCode(true)
    setError('')
    try {
      const res = await fetch(`${apiBaseUrl()}/api/public/schools/register/phone/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: form.adminPhone, code: phoneCode }),
      })
      const body = await parseJsonResponse<{ error?: string; phoneVerificationToken?: string }>(res)
      if (!res.ok) throw new Error(body.error || 'Verification failed')
      setPhoneVerificationToken(body.phoneVerificationToken || '')
      setPhoneVerified(true)
      setPhoneDevHint('Phone verified')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Verification failed')
    } finally {
      setVerifyingCode(false)
    }
  }

  async function handleUpload(file: File) {
    setUploading(true)
    setError('')
    try {
      const docMeta = DOC_TYPES.find((d) => d.type === pendingDocType) || DOC_TYPES[0]
      const uploaded = await uploadRegistrationFile(file, pendingDocType)
      setDocuments((prev) => [
        ...prev,
        {
          documentType: pendingDocType,
          label: docMeta.label,
          url: uploaded.url,
          fileName: uploaded.fileName,
        },
      ])
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  async function handleReceiptUpload(file: File) {
    setUploadingReceipt(true)
    setError('')
    try {
      const uploaded = await uploadRegistrationFile(file, 'payment-receipt')
      setPaymentReceipt(uploaded)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Receipt upload failed')
    } finally {
      setUploadingReceipt(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.schoolName || !form.adminFirstName || !form.adminLastName || !form.adminEmail || !form.password) {
      setError('Fill in all required fields')
      return
    }
    if (form.password !== form.confirm) {
      setError('Passwords do not match')
      return
    }
    if (!passwordMeetsRules(form.password)) {
      setError('Password does not meet all requirements')
      return
    }
    if (!form.address.trim()) {
      setError('School address is required')
      return
    }
    if (!phoneVerified || !phoneVerificationToken) {
      setError('Verify your phone number before continuing')
      return
    }
    if (documents.length < 1) {
      setError('Upload at least one verification document')
      return
    }
    if (!paymentReceipt?.url) {
      setError('Payment receipt is required')
      return
    }

    setSubmitting(true)
    setError('')
    try {
      const regRes = await fetch(`${apiBaseUrl()}/api/public/schools/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolName: form.schoolName,
          adminFirstName: form.adminFirstName,
          adminLastName: form.adminLastName,
          adminEmail: form.adminEmail,
          adminPhone: form.adminPhone,
          address: form.address.trim(),
          city: form.city,
          country: form.country,
          phoneVerificationToken,
          proposedPlanSlug: form.proposedPlanSlug,
          billingInterval: interval,
          password: form.password,
          referralCode: referralCode || undefined,
          paymentReference: form.paymentReference.trim(),
          paymentAmount: quote?.amount,
          paymentReceiptUrl: paymentReceipt.url,
          registrationNumber: form.registrationNumber || undefined,
          verificationDocuments: documents.map((d) => ({
            type: d.documentType,
            label: d.label,
            url: d.url,
            fileName: d.fileName,
          })),
        }),
      })
      const regBody = await parseJsonResponse<{ error?: string }>(regRes)
      if (!regRes.ok) throw new Error(regBody.error || 'Registration failed')

      const loginRes = await fetch(`${apiBaseUrl()}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: form.adminEmail, password: form.password }),
      })
      const loginBody = await parseJsonResponse<{ error?: string; accessToken?: string }>(loginRes)
      if (!loginRes.ok || !loginBody.accessToken) {
        throw new Error('School created but sign-in failed. Try logging in with your email and password.')
      }

      saveToken(loginBody.accessToken)
      await router.push('/admin/setup-wizard?registered=1')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Registration failed')
    } finally {
      setSubmitting(false)
    }
  }

  const stepIndex = STEPS.findIndex((s) => s.id === step)

  return (
    <>
      <Seo
        title="Register your school"
        description="Join SchoolPilot — choose a plan, pay by bank transfer, verify your school, then create your admin account."
        path="/register-school"
      />
      <PublicLayout title="Register your school" noHero fullWidth>
        <div className="section-pad bg-school-bg">
          <div className={`container-school mx-auto ${step === 'plan' ? 'max-w-7xl' : 'max-w-5xl'}`}>
            <div className="mb-10 text-center">
              <SchoolLogo size="lg" />
              <h1 className="mt-6 font-display text-3xl font-bold text-school-navy">Register on SchoolPilot</h1>
              <p className="mt-2 text-school-muted">
                Choose plan → pay by bank transfer → upload school proof → create your admin account
              </p>
              {referralCode && (
                <p className="mt-2 text-sm font-medium text-school-gold">Referral code: {referralCode}</p>
              )}
            </div>

            <nav className="mb-8 flex flex-wrap justify-center gap-2" aria-label="Registration steps">
              {STEPS.map((s, i) => (
                <span
                  key={s.id}
                  className={`rounded-full px-4 py-1.5 text-sm font-medium ${
                    i === stepIndex
                      ? 'bg-school-royal text-white'
                      : i < stepIndex
                        ? 'bg-school-green/15 text-school-green'
                        : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {i + 1}. {s.label}
                </span>
              ))}
            </nav>

            {selectedPlan && step !== 'plan' && (
              <div className="mb-6 rounded-xl border border-school-royal/20 bg-school-royal/5 px-4 py-3 text-center text-sm">
                <span className="text-school-muted">Selected plan: </span>
                <strong className="text-school-navy">{selectedPlan.name}</strong>
                <span className="text-school-muted"> · </span>
                <strong className="text-school-royal">
                  ₦{priceForPlan(selectedPlan, interval)?.toLocaleString()}/{interval}
                </strong>
                <button type="button" onClick={() => setStep('plan')} className="ml-3 text-school-royal hover:underline">
                  Change
                </button>
              </div>
            )}

            <div className="content-card p-6 sm:p-8">
              {error && (
                <p className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
                  {error}
                </p>
              )}

              {step === 'plan' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-xl font-bold text-school-navy">Choose your subscription plan</h2>
                    <p className="mt-1 text-sm text-school-muted">
                      Same plans as on the pricing page. Click <strong>Select plan</strong> on the card you want.
                    </p>
                  </div>
                  <div className="flex justify-center px-1">
                    <BillingIntervalToggle value={interval} onChange={setInterval} compact />
                  </div>
                  {loadingPlans ? (
                    <p className="text-center text-slate-500">Loading plans…</p>
                  ) : plans.length === 0 ? (
                    <p className="text-center text-red-600">No plans available. Please try again later.</p>
                  ) : (
                    <PricingCards
                      plans={plans}
                      interval={interval}
                      currentSlug={form.proposedPlanSlug}
                      onSelect={(slug) => setForm({ ...form, proposedPlanSlug: slug })}
                      showCta={false}
                      layout="register"
                    />
                  )}
                </div>
              )}

              {step === 'payment' && (
                <div className="mx-auto max-w-lg space-y-4">
                  <h2 className="text-xl font-bold text-school-navy">Pay by bank transfer</h2>
                  <p className="text-sm text-school-muted">
                    Transfer the subscription fee to SchoolPilot <strong>before</strong> uploading documents. Use the
                    reference in your bank narration.
                  </p>
                  {loadingQuote ? (
                    <p className="text-slate-500">Loading payment details…</p>
                  ) : quote ? (
                    <>
                      <div className="rounded-xl border border-school-border bg-slate-50 p-5 text-sm">
                        <p className="font-semibold text-school-navy">
                          {quote.plan.name} — ₦{quote.amount.toLocaleString()} / {interval}
                        </p>
                        <dl className="mt-4 space-y-2">
                          <div className="flex justify-between gap-4">
                            <dt className="text-slate-500">Bank</dt>
                            <dd className="font-medium">{quote.bankDetails.bankName}</dd>
                          </div>
                          <div className="flex justify-between gap-4">
                            <dt className="text-slate-500">Account name</dt>
                            <dd className="font-medium">{quote.bankDetails.accountName}</dd>
                          </div>
                          <div className="flex justify-between gap-4">
                            <dt className="text-slate-500">Account number</dt>
                            <dd className="font-mono font-bold">{quote.bankDetails.accountNumber}</dd>
                          </div>
                          <div className="flex justify-between gap-4">
                            <dt className="text-slate-500">Amount</dt>
                            <dd className="font-bold text-school-royal">₦{quote.amount.toLocaleString()}</dd>
                          </div>
                        </dl>
                      </div>
                      <label className="block text-sm font-medium text-school-navy">
                        Transfer reference (bank narration) *
                        <input
                          value={form.paymentReference}
                          onChange={(e) => setForm({ ...form, paymentReference: e.target.value })}
                          className="mt-1 w-full font-mono"
                          required
                        />
                      </label>

                      <div className="rounded-xl border border-dashed border-school-border bg-white p-4">
                        <p className="text-sm font-medium text-school-navy">Upload payment receipt *</p>
                        <p className="mt-1 text-xs text-school-muted">
                          Screenshot or PDF from your bank app showing the completed transfer.
                        </p>
                        <div className="mt-3 flex flex-wrap items-center gap-3">
                          <label className="btn-admin-sm cursor-pointer">
                            {uploadingReceipt ? 'Uploading…' : paymentReceipt ? 'Replace receipt' : 'Choose receipt'}
                            <input
                              type="file"
                              accept="image/*,.pdf"
                              className="sr-only"
                              disabled={uploadingReceipt}
                              onChange={(e) => {
                                const file = e.target.files?.[0]
                                if (file) handleReceiptUpload(file)
                                e.target.value = ''
                              }}
                            />
                          </label>
                          {paymentReceipt && (
                            <span className="text-sm text-school-green">
                              ✓ {paymentReceipt.fileName}
                            </span>
                          )}
                        </div>
                      </div>

                      <p className="text-xs text-slate-500">
                        After uploading your receipt, continue to submit documents proving your school exists.
                      </p>
                    </>
                  ) : (
                    <p className="text-red-600">Could not load payment details. Go back and select a plan.</p>
                  )}
                </div>
              )}

              {step === 'documents' && (
                <div className="mx-auto max-w-lg space-y-4">
                  <h2 className="text-xl font-bold text-school-navy">Prove your school exists</h2>
                  <p className="text-sm text-school-muted">
                    Upload official documents (CAC certificate, government approval, or premises proof). At least one
                    file is required before you create your account.
                  </p>
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <select
                      value={pendingDocType}
                      onChange={(e) => setPendingDocType(e.target.value)}
                      className="flex-1"
                    >
                      {DOC_TYPES.map((d) => (
                        <option key={d.type} value={d.type}>
                          {d.label}
                        </option>
                      ))}
                    </select>
                    <label className="btn-admin-sm cursor-pointer text-center">
                      {uploading ? 'Uploading…' : 'Choose file'}
                      <input
                        type="file"
                        accept="image/*,.pdf"
                        className="sr-only"
                        disabled={uploading}
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) handleUpload(file)
                          e.target.value = ''
                        }}
                      />
                    </label>
                  </div>
                  {documents.length > 0 ? (
                    <ul className="space-y-2 rounded-lg border border-school-border p-4 text-sm">
                      {documents.map((d, i) => (
                        <li key={i} className="flex items-center justify-between gap-2">
                          <span>
                            <span className="font-medium">{d.label}</span>
                            <span className="text-slate-500"> — {d.fileName}</span>
                          </span>
                          <button
                            type="button"
                            className="text-red-600 text-xs"
                            onClick={() => setDocuments((prev) => prev.filter((_, j) => j !== i))}
                          >
                            Remove
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="rounded-lg border border-dashed border-school-border p-6 text-center text-sm text-slate-500">
                      No documents uploaded yet
                    </p>
                  )}
                </div>
              )}

              {step === 'details' && (
                <form onSubmit={handleSubmit} className="mx-auto max-w-lg space-y-4">
                  <h2 className="text-xl font-bold text-school-navy">School &amp; admin account</h2>
                  <p className="text-sm text-school-muted">
                    Last step — create your school admin login. You will go straight into the setup wizard.
                  </p>
                  <input
                    placeholder="School name *"
                    value={form.schoolName}
                    onChange={(e) => setForm({ ...form, schoolName: e.target.value })}
                    className="w-full"
                    required
                  />
                  <input
                    placeholder="CAC / registration number (optional)"
                    value={form.registrationNumber}
                    onChange={(e) => setForm({ ...form, registrationNumber: e.target.value })}
                    className="w-full"
                  />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <input
                      placeholder="Admin first name *"
                      value={form.adminFirstName}
                      onChange={(e) => setForm({ ...form, adminFirstName: e.target.value })}
                      required
                    />
                    <input
                      placeholder="Admin last name *"
                      value={form.adminLastName}
                      onChange={(e) => setForm({ ...form, adminLastName: e.target.value })}
                      required
                    />
                  </div>
                  <input
                    type="email"
                    placeholder="Admin email *"
                    value={form.adminEmail}
                    onChange={(e) => setForm({ ...form, adminEmail: e.target.value })}
                    className="w-full"
                    required
                  />
                  <textarea
                    placeholder="School address *"
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                    className="w-full min-h-[80px]"
                    required
                  />
                  <input
                    placeholder="City"
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                    className="w-full"
                  />
                  <div className="rounded-xl border border-school-border p-4 space-y-3">
                    <p className="text-sm font-medium text-school-navy">Verify phone number *</p>
                    <input
                      placeholder="Phone (e.g. 08012345678) *"
                      value={form.adminPhone}
                      onChange={(e) => {
                        setForm({ ...form, adminPhone: e.target.value })
                        setPhoneVerified(false)
                        setPhoneVerificationToken('')
                      }}
                      className="w-full"
                      required
                    />
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={sendPhoneCode} disabled={sendingCode} className="btn-navy text-sm py-2 px-4">
                        {sendingCode ? 'Sending…' : 'Send code'}
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <input
                        placeholder="6-digit code"
                        value={phoneCode}
                        onChange={(e) => setPhoneCode(e.target.value)}
                        className="min-w-[140px] flex-1"
                      />
                      <button type="button" onClick={verifyPhoneCode} disabled={verifyingCode || !phoneCode} className="btn-royal text-sm py-2 px-4">
                        {verifyingCode ? 'Checking…' : 'Verify'}
                      </button>
                    </div>
                    {phoneDevHint && <p className={`text-xs ${phoneVerified ? 'text-school-green' : 'text-school-muted'}`}>{phoneDevHint}</p>}
                  </div>
                  <input
                    type="password"
                    placeholder="Password *"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    className="w-full"
                    required
                  />
                  <input
                    type="password"
                    placeholder="Confirm password *"
                    value={form.confirm}
                    onChange={(e) => setForm({ ...form, confirm: e.target.value })}
                    className="w-full"
                    required
                  />
                  <PasswordRulesList password={form.password} confirm={form.confirm} />
                  <button
                    type="submit"
                    disabled={submitting || !passwordMeetsRules(form.password) || !passwordsMatch(form.password, form.confirm) || !phoneVerified}
                    className="btn-gold w-full disabled:opacity-50"
                  >
                    {submitting ? 'Creating your school…' : 'Create school & continue to setup'}
                  </button>
                </form>
              )}

              {step !== 'details' && (
                <div className="mt-8 flex justify-between gap-4 border-t border-school-border pt-6">
                  <button
                    type="button"
                    onClick={goBack}
                    disabled={step === 'plan'}
                    className="rounded-lg border border-school-border px-5 py-2 text-sm font-medium disabled:opacity-40"
                  >
                    Back
                  </button>
                  <button type="button" onClick={goNext} className="btn-royal">
                    Continue
                  </button>
                </div>
              )}

              {step === 'details' && (
                <div className="mt-6 border-t border-school-border pt-6">
                  <button type="button" onClick={goBack} className="text-sm text-school-royal hover:underline">
                    ← Back to documents
                  </button>
                </div>
              )}
            </div>

            <p className="mt-6 text-center text-sm text-school-muted">
              Already have an account? <Link href="/login" className="text-school-royal hover:underline">Sign in</Link>
            </p>
          </div>
        </div>
      </PublicLayout>
    </>
  )
}
