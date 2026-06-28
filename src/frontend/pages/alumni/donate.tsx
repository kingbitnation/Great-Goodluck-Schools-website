import { useEffect, useState } from 'react'
import Link from 'next/link'
import PublicLayout from '../../components/layout/PublicLayout'
import Reveal from '../../components/public/Reveal'
import PaymentReceiptUpload, { fileToDataUrl } from '../../components/payments/PaymentReceiptUpload'
import { fetchWithAuth, getToken } from '../../lib/auth'
import type { AuthUser } from '../../lib/useAuth'

type SchoolInfo = { id: string; name: string }

type BankDetails = {
  bankName: string
  accountName: string
  accountNumber: string
  amount: number
  reference: string
}

export default function AlumniDonatePage() {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [school, setSchool] = useState<SchoolInfo | null>(null)
  const [form, setForm] = useState({
    donorName: '',
    donorEmail: '',
    amount: '',
    message: '',
  })
  const [bankDetails, setBankDetails] = useState<BankDetails | null>(null)
  const [donationId, setDonationId] = useState('')
  const [receiptFileName, setReceiptFileName] = useState<string | null>(null)
  const [receiptUploaded, setReceiptUploaded] = useState(false)
  const [uploadingReceipt, setUploadingReceipt] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const base = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000'
    const token = getToken()
    const loadSchool = (schoolId?: string | null) => {
      const url = schoolId
        ? `${base}/api/public/alumni/school?schoolId=${schoolId}`
        : `${base}/api/public/alumni/school`
      fetch(url)
        .then((r) => r.json())
        .then(setSchool)
        .catch(() => setSchool(null))
    }

    if (token) {
      fetchWithAuth('/api/auth/me')
        .then(async (res) => {
          if (!res.ok) return loadSchool()
          const data = await res.json()
          const u = (data.user || data) as AuthUser
          setUser(u)
          setForm((f) => ({
            ...f,
            donorName: u.firstName ? `${u.firstName} ${u.lastName || ''}`.trim() : f.donorName,
            donorEmail: u.email || f.donorEmail,
          }))
          loadSchool(u.schoolId)
        })
        .catch(() => loadSchool())
    } else {
      loadSchool()
    }
  }, [])

  async function handleDonate(e: React.FormEvent) {
    e.preventDefault()
    if (!school?.id) return setError('School not found')
    setLoading(true)
    setError('')
    setBankDetails(null)
    setDonationId('')
    setReceiptFileName(null)
    setReceiptUploaded(false)
    try {
      const base = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000'
      const res = await fetch(`${base}/api/alumni/donations/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolId: school.id,
          donorName: form.donorName,
          donorEmail: form.donorEmail,
          amount: Number(form.amount),
          message: form.message || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Checkout failed')
      if (data.manual && data.bankDetails) {
        setDonationId(data.donationId)
        setBankDetails(data.bankDetails)
        return
      }
      throw new Error('Checkout failed')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Checkout failed')
    } finally {
      setLoading(false)
    }
  }

  async function uploadReceipt(file: File) {
    if (!donationId) return
    setUploadingReceipt(true)
    setError('')
    setReceiptFileName(file.name)
    try {
      const base = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000'
      const fileBase64 = await fileToDataUrl(file)
      const res = await fetch(`${base}/api/alumni/donations/${donationId}/upload-receipt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileBase64,
          mimeType: file.type,
          donorEmail: form.donorEmail,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Upload failed')
      setReceiptUploaded(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload receipt')
      setReceiptFileName(null)
    } finally {
      setUploadingReceipt(false)
    }
  }

  return (
    <PublicLayout title="Donate" subtitle="Support your alma mater">
      <Reveal>
        {bankDetails ? (
          <div className="glass-card mx-auto max-w-lg rounded-3xl p-7 sm:p-9">
            <h2 className="text-xl font-bold text-school-navy">Bank transfer instructions</h2>
            <p className="mt-2 text-sm text-slate-600">
              Transfer your donation using the details below. {school?.name} will confirm receipt.
            </p>
            <dl className="mt-6 space-y-3 text-sm">
              <div className="flex justify-between gap-4"><dt className="text-slate-500">Bank</dt><dd className="font-medium">{bankDetails.bankName}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-slate-500">Account name</dt><dd className="font-medium">{bankDetails.accountName}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-slate-500">Account number</dt><dd className="font-mono font-medium">{bankDetails.accountNumber}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-slate-500">Amount</dt><dd className="font-bold">₦{bankDetails.amount.toLocaleString()}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-slate-500">Reference</dt><dd className="font-mono text-xs font-bold text-school-royal">{bankDetails.reference}</dd></div>
            </dl>
            <div className="mt-6">
              <PaymentReceiptUpload
                uploading={uploadingReceipt}
                fileName={receiptFileName}
                onFile={uploadReceipt}
                disabled={receiptUploaded}
              />
              {receiptUploaded && (
                <p className="mt-2 text-sm text-school-green">Receipt submitted. The school will confirm your donation.</p>
              )}
            </div>
            {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
            <button type="button" onClick={() => { setBankDetails(null); setDonationId(''); setReceiptUploaded(false); setReceiptFileName(null) }} className="btn-gold mt-6 w-full">
              Make another donation
            </button>
          </div>
        ) : (
          <form onSubmit={handleDonate} className="glass-card mx-auto max-w-lg rounded-3xl p-7 sm:p-9">
            <p className="text-sm text-slate-600 mb-4">
              {school ? `Donating to ${school.name}` : 'Loading school...'}
            </p>
            <input required placeholder="Your name" value={form.donorName} onChange={(e) => setForm({ ...form, donorName: e.target.value })} className="w-full" />
            <input required type="email" placeholder="Email" value={form.donorEmail} onChange={(e) => setForm({ ...form, donorEmail: e.target.value })} className="w-full mt-4" />
            <input required type="number" min={100} placeholder="Amount (NGN, min 100)" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="mt-4 w-full" />
            <textarea placeholder="Message (optional)" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} className="mt-4 w-full" rows={3} />
            <p className="mt-4 text-xs text-slate-500">Donations are paid by bank transfer. Account details are shown on the next step.</p>
            {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
            <button type="submit" disabled={loading} className="btn-gold mt-6 w-full disabled:opacity-50">
              {loading ? 'Processing...' : 'Continue'}
            </button>
            <p className="mt-4 text-center text-sm text-slate-500">
              {user ? (
                <Link href="/alumni" className="text-school-gold hover:underline">Alumni portal</Link>
              ) : (
                <Link href="/alumni/join" className="text-school-gold hover:underline">Join the alumni network</Link>
              )}
            </p>
          </form>
        )}
      </Reveal>
    </PublicLayout>
  )
}
