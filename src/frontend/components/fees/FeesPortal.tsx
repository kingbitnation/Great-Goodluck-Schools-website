import { useState, useEffect, useRef } from 'react'
import AppLayout from '../layout/AppLayout'
import { apiGet, apiPost } from '../../lib/api'
import type { AuthUser } from '../../lib/useAuth'

type FeeRow = {
  id: string
  name: string
  description?: string
  dueDate: string
  baseAmount: number
  netAmount: number
  discountApplied: number
  penaltyApplied: number
  paid: number
  outstanding: number
  overdue: boolean
  allowPartial: boolean
  status: string
  installments: Array<{ id: string; label: string; amount: number; dueDate: string; outstanding: number }>
}

type Payment = {
  id: string
  fee?: { name: string }
  amount: number
  paidAmount: number
  status: string
  verificationStatus: string
  gateway: string
  paymentReference?: string
  receiptNumber?: string
  createdAt: string
}

type BankDetails = {
  bankName: string
  accountName: string
  accountNumber: string
  amount: number
  paymentReference: string
  discountApplied?: number
  penaltyApplied?: number
}

type Props = {
  user: AuthUser
  studentId: string
  title?: string
  pageTitle?: string
}

export default function FeesPortal({ user, studentId, title = 'Fees & Payments', pageTitle = 'Fees' }: Props) {
  const [fees, setFees] = useState<FeeRow[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [summary, setSummary] = useState({ totalDue: 0, totalPaid: 0, balance: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedFee, setSelectedFee] = useState('')
  const [selectedInstallment, setSelectedInstallment] = useState('')
  const [payAmount, setPayAmount] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [step, setStep] = useState<'form' | 'bank' | 'upload'>('form')
  const [processing, setProcessing] = useState(false)
  const [pendingPayment, setPendingPayment] = useState<Payment | null>(null)
  const [bankDetails, setBankDetails] = useState<BankDetails | null>(null)
  const [gateways, setGateways] = useState<Array<{ id: string; label: string; available: boolean }>>([])
  const [paymentMethod, setPaymentMethod] = useState<'manual' | 'paystack'>('manual')
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => { if (studentId) loadData() }, [studentId])

  useEffect(() => {
    apiGet<{ gateways: Array<{ id: string; label: string; available: boolean }> }>('/api/payments/gateways')
      .then((d) => {
        setGateways(d.gateways)
        if (d.gateways.some((g) => g.id === 'paystack')) setPaymentMethod('paystack')
      })
      .catch(() => {})
  }, [])

  async function loadData() {
    try {
      setLoading(true)
      const [overview, studentPayments] = await Promise.all([
        apiGet<{ fees: FeeRow[]; totalDue: number; totalPaid: number; balance: number }>(`/api/students/${studentId}/fee-summary`),
        apiGet<Payment[]>(`/api/payments?studentId=${studentId}`),
      ])
      setFees(overview.fees)
      setSummary({ totalDue: overview.totalDue, totalPaid: overview.totalPaid, balance: overview.balance })
      setPayments(studentPayments)
    } catch {
      setError('Failed to load fee data')
    } finally {
      setLoading(false)
    }
  }

  function resetModal() {
    setModalOpen(false)
    setStep('form')
    setPendingPayment(null)
    setBankDetails(null)
    setSelectedFee('')
    setSelectedInstallment('')
    setPayAmount('')
  }

  function onFeeSelect(feeId: string) {
    setSelectedFee(feeId)
    setSelectedInstallment('')
    const fee = fees.find((f) => f.id === feeId)
    if (fee) setPayAmount(String(fee.outstanding))
  }

  async function handlePayment() {
    const fee = fees.find((f) => f.id === selectedFee)
    const amount = Number(payAmount) || fee?.outstanding || 0
    if (amount <= 0) {
      setError('Enter a valid amount')
      return
    }

    try {
      setProcessing(true)
      setError('')

      const payload = { studentId, feeId: selectedFee || null, amount, installmentId: selectedInstallment || null, email: user.email }

      if (paymentMethod === 'paystack' && gateways.some((g) => g.id === 'paystack')) {
        const res = await apiPost<{ authorizationUrl: string }>('/api/payments/paystack/initialize', payload)
        if (res.authorizationUrl) {
          window.location.href = res.authorizationUrl
          return
        }
      }

      const res = await apiPost<{ payment: Payment; bankDetails: BankDetails }>('/api/payments/manual', payload)
      setPendingPayment(res.payment)
      setBankDetails(res.bankDetails)
      setStep('bank')
    } catch (e: any) {
      setError(e.message || 'Payment initiation failed')
    } finally {
      setProcessing(false)
    }
  }

  async function handleReceiptUpload(file: File) {
    if (!pendingPayment) return
    setProcessing(true)
    try {
      const reader = new FileReader()
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = reject
        reader.readAsDataURL(file)
      })
      await apiPost(`/api/payments/${pendingPayment.id}/upload-receipt`, { fileBase64: base64, mimeType: file.type })
      resetModal()
      loadData()
    } catch {
      setError('Failed to upload receipt')
    } finally {
      setProcessing(false)
    }
  }

  async function downloadReceipt(paymentId: string) {
    const token = localStorage.getItem('sms_token')
    const base = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000'
    const res = await fetch(`${base}/api/payments/${paymentId}/receipt/pdf`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      credentials: 'include',
    })
    if (!res.ok) return
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `receipt-${paymentId.slice(-8)}.pdf`
    a.click()
    URL.revokeObjectURL(url)
  }

  const statusLabel = (p: Payment) => {
    if (p.gateway === 'manual' && p.verificationStatus === 'pending_verification') return 'Awaiting receipt'
    if (p.verificationStatus === 'under_review') return 'Under review'
    if (p.verificationStatus === 'rejected') return 'Rejected'
    if (p.status === 'completed' || p.status === 'partial') return p.status === 'partial' ? 'Partial' : 'Paid'
    return p.status
  }

  const selectedFeeData = fees.find((f) => f.id === selectedFee)

  if (loading) {
    return <AppLayout user={user} title={pageTitle}><div className="p-8">Loading...</div></AppLayout>
  }

  return (
    <AppLayout user={user} title={pageTitle}>
      <div className="mx-auto max-w-6xl p-6 sm:p-8">
        <h1 className="font-display text-2xl font-bold text-school-navy sm:text-3xl">{title}</h1>
        {error && <div className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {[
            { label: 'Net Due', value: summary.totalDue },
            { label: 'Paid', value: summary.totalPaid },
            { label: 'Balance', value: summary.balance },
          ].map((c) => (
            <div key={c.label} className="content-card p-5">
              <p className="text-sm text-slate-500">{c.label}</p>
              <p className="text-2xl font-bold text-school-navy">₦{c.value.toLocaleString()}</p>
            </div>
          ))}
        </div>

        {modalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
              {step === 'form' && (
                <>
                  <h2 className="text-xl font-bold">Make Payment</h2>
                  <div className="mt-5 space-y-4">
                    <select value={selectedFee} onChange={(e) => onFeeSelect(e.target.value)} className="w-full">
                      <option value="">Select fee</option>
                      {fees.filter((f) => f.outstanding > 0).map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.name} — ₦{f.outstanding.toLocaleString()} due
                        </option>
                      ))}
                    </select>
                    {selectedFeeData && selectedFeeData.installments.length > 0 && (
                      <select value={selectedInstallment} onChange={(e) => {
                        setSelectedInstallment(e.target.value)
                        const inst = selectedFeeData.installments.find((i) => i.id === e.target.value)
                        if (inst) setPayAmount(String(inst.outstanding))
                      }} className="w-full">
                        <option value="">Full outstanding</option>
                        {selectedFeeData.installments.filter((i) => i.outstanding > 0).map((i) => (
                          <option key={i.id} value={i.id}>{i.label} — ₦{i.outstanding.toLocaleString()}</option>
                        ))}
                      </select>
                    )}
                    {selectedFeeData && (selectedFeeData.discountApplied > 0 || selectedFeeData.penaltyApplied > 0) && (
                      <p className="text-xs text-slate-500">
                        {selectedFeeData.discountApplied > 0 && `Discount: ₦${selectedFeeData.discountApplied.toLocaleString()} `}
                        {selectedFeeData.penaltyApplied > 0 && `Penalty: ₦${selectedFeeData.penaltyApplied.toLocaleString()}`}
                      </p>
                    )}
                    <input type="number" min="1" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} className="w-full" placeholder="Amount" />
                    {gateways.length > 1 && (
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-slate-600">Payment method</p>
                        {gateways.map((g) => (
                          <label key={g.id} className="flex items-center gap-2 text-sm">
                            <input type="radio" name="gateway" checked={paymentMethod === g.id} onChange={() => setPaymentMethod(g.id as 'manual' | 'paystack')} />
                            {g.label}
                          </label>
                        ))}
                      </div>
                    )}
                    <p className="text-xs text-slate-500">
                      {paymentMethod === 'paystack' ? 'Pay instantly with card, bank, or USSD via Paystack.' : 'Pay by bank transfer, then upload your receipt.'}
                    </p>
                  </div>
                  <div className="mt-6 flex gap-3">
                    <button onClick={handlePayment} disabled={processing} className="btn-gold flex-1 justify-center">{processing ? 'Processing...' : 'Continue'}</button>
                    <button onClick={resetModal} className="flex-1 rounded-pill border py-3 text-sm">Cancel</button>
                  </div>
                </>
              )}
              {step === 'bank' && bankDetails && (
                <>
                  <h2 className="text-xl font-bold">Bank Transfer</h2>
                  <dl className="mt-4 space-y-2 rounded-xl bg-slate-50 p-4 text-sm">
                    <div className="flex justify-between"><dt>Bank</dt><dd>{bankDetails.bankName}</dd></div>
                    <div className="flex justify-between"><dt>Account</dt><dd>{bankDetails.accountNumber}</dd></div>
                    <div className="flex justify-between"><dt>Amount</dt><dd className="font-bold">₦{bankDetails.amount.toLocaleString()}</dd></div>
                    <div className="flex justify-between"><dt>Reference</dt><dd className="font-mono text-xs">{bankDetails.paymentReference}</dd></div>
                  </dl>
                  <button onClick={() => setStep('upload')} className="btn-gold mt-4 w-full justify-center">Upload receipt</button>
                </>
              )}
              {step === 'upload' && (
                <>
                  <h2 className="text-xl font-bold">Upload Receipt</h2>
                  <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="mt-4 w-full" onChange={(e) => e.target.files?.[0] && handleReceiptUpload(e.target.files[0])} />
                </>
              )}
            </div>
          </div>
        )}

        <div className="content-card mt-8 overflow-hidden">
          <div className="border-b px-6 py-4 font-semibold">Fees</div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-6 py-3">Fee</th>
                <th className="px-6 py-3">Net</th>
                <th className="px-6 py-3">Paid</th>
                <th className="px-6 py-3">Balance</th>
                <th className="px-6 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {fees.map((f) => (
                <tr key={f.id} className="border-t">
                  <td className="px-6 py-3">{f.name}</td>
                  <td className="px-6 py-3">₦{f.netAmount.toLocaleString()}</td>
                  <td className="px-6 py-3">₦{f.paid.toLocaleString()}</td>
                  <td className="px-6 py-3">₦{f.outstanding.toLocaleString()}</td>
                  <td className="px-6 py-3 capitalize">{f.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="border-t px-6 py-4 text-right">
            <button onClick={() => setModalOpen(true)} className="btn-gold">Make payment</button>
          </div>
        </div>

        <div className="content-card mt-8 overflow-hidden">
          <div className="border-b px-6 py-4 font-semibold">Payment history</div>
          {payments.length === 0 ? (
            <p className="px-6 py-8 text-center text-slate-500">No payments yet</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-6 py-3">Date</th>
                  <th className="px-6 py-3">Reference</th>
                  <th className="px-6 py-3">Amount</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} className="border-t">
                    <td className="px-6 py-3">{new Date(p.createdAt).toLocaleDateString()}</td>
                    <td className="px-6 py-3 font-mono text-xs">{p.paymentReference || '—'}</td>
                    <td className="px-6 py-3">₦{p.amount.toLocaleString()}</td>
                    <td className="px-6 py-3">{statusLabel(p)}</td>
                    <td className="px-6 py-3">
                      {(p.status === 'completed' || p.status === 'partial') && (
                        <button type="button" onClick={() => downloadReceipt(p.id)} className="text-school-gold hover:underline">PDF</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </AppLayout>
  )
}
