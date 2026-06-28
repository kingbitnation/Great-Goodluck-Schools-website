import { useState, useEffect } from 'react'
import { withAuth } from '../../components/withAuth'
import AppLayout from '../../components/layout/AppLayout'
import { apiGet, apiPost } from '../../lib/api'
import type { AuthUser } from '../../lib/useAuth'

interface VerificationLog {
  id: string
  action: string
  note?: string
  createdAt: string
  performedBy: { firstName: string; lastName: string; email: string }
}

interface PendingPayment {
  id: string
  amount: number
  paymentReference?: string
  verificationStatus: string
  receiptUrl?: string
  receiptMimeType?: string
  createdAt: string
  fee?: { name: string }
  student: {
    user: { firstName: string; lastName: string; email: string }
    class?: { name: string }
  }
  verificationLogs: VerificationLog[]
}

export default withAuth(function PaymentVerificationPage({ user }: { user: AuthUser }) {
  const [payments, setPayments] = useState<PendingPayment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<PendingPayment | null>(null)
  const [note, setNote] = useState('')
  const [acting, setActing] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    try {
      setLoading(true)
      const data = await apiGet<PendingPayment[]>('/api/payments/pending-verification')
      setPayments(data)
    } catch {
      setError('Failed to load pending payments')
    } finally {
      setLoading(false)
    }
  }

  async function verify(action: 'approve' | 'reject' | 'under_review' | 'info_requested') {
    if (!selected) return
    setActing(true)
    setError('')
    try {
      await apiPost(`/api/payments/${selected.id}/verify`, { action, note })
      setSelected(null)
      setNote('')
      load()
    } catch {
      setError('Action failed')
    } finally {
      setActing(false)
    }
  }

  if (loading) {
    return <AppLayout user={user} title="Payment Verification"><div className="p-8">Loading...</div></AppLayout>
  }

  return (
    <AppLayout user={user} title="Payment Verification">
      <div className="mx-auto max-w-7xl p-6 sm:p-8">
        <h1 className="font-display text-2xl font-bold text-school-navy sm:text-3xl">Payment Verification</h1>
        <p className="mt-1 text-slate-500">Review manual bank transfers and approve or reject payments.</p>

        {error && <div className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <div className="content-card overflow-hidden">
            <div className="border-b border-slate-100 px-6 py-4">
              <h2 className="font-semibold">Pending ({payments.length})</h2>
            </div>
            {payments.length === 0 ? (
              <p className="px-6 py-10 text-center text-slate-500">No payments awaiting verification</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {payments.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => setSelected(p)}
                      className={`w-full px-6 py-4 text-left transition hover:bg-slate-50 ${selected?.id === p.id ? 'bg-amber-50' : ''}`}
                    >
                      <p className="font-medium text-school-navy">
                        {p.student.user.firstName} {p.student.user.lastName}
                      </p>
                      <p className="text-sm text-slate-500">{p.fee?.name || 'General payment'} · ₦{p.amount.toLocaleString()}</p>
                      <p className="mt-1 font-mono text-xs text-amber-700">{p.paymentReference}</p>
                      <span className="mt-2 inline-block rounded-pill bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                        {p.verificationStatus.replace(/_/g, ' ')}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="content-card p-6">
            {!selected ? (
              <p className="py-16 text-center text-slate-500">Select a payment to review</p>
            ) : (
              <>
                <h2 className="text-lg font-bold text-school-navy">Review Payment</h2>
                <dl className="mt-4 space-y-2 text-sm">
                  <div className="flex justify-between"><dt className="text-slate-500">Student</dt><dd>{selected.student.user.firstName} {selected.student.user.lastName}</dd></div>
                  <div className="flex justify-between"><dt className="text-slate-500">Class</dt><dd>{selected.student.class?.name || 'N/A'}</dd></div>
                  <div className="flex justify-between"><dt className="text-slate-500">Amount</dt><dd className="font-bold">₦{selected.amount.toLocaleString()}</dd></div>
                  <div className="flex justify-between"><dt className="text-slate-500">Reference</dt><dd className="font-mono text-xs">{selected.paymentReference}</dd></div>
                  <div className="flex justify-between"><dt className="text-slate-500">Submitted</dt><dd>{new Date(selected.createdAt).toLocaleString()}</dd></div>
                </dl>

                {selected.receiptUrl && (
                  <div className="mt-4">
                    <p className="mb-2 text-sm font-medium">Receipt</p>
                    {selected.receiptMimeType === 'application/pdf' || selected.receiptUrl.endsWith('.pdf') ? (
                      <a href={selected.receiptUrl} target="_blank" rel="noreferrer" className="text-sm text-school-gold underline">Open PDF receipt</a>
                    ) : (
                      <img src={selected.receiptUrl} alt="Receipt" className="max-h-48 rounded-lg border border-slate-200" />
                    )}
                  </div>
                )}

                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Note (optional for approval, required for rejection)"
                  rows={3}
                  className="mt-4 w-full"
                />

                <div className="mt-4 flex flex-wrap gap-2">
                  <button onClick={() => verify('approve')} disabled={acting} className="btn-gold px-4 py-2 text-sm">Approve</button>
                  <button onClick={() => verify('reject')} disabled={acting} className="rounded-pill bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700">Reject</button>
                  <button onClick={() => verify('info_requested')} disabled={acting} className="rounded-pill border border-slate-200 px-4 py-2 text-sm">Request Info</button>
                </div>

                {selected.verificationLogs.length > 0 && (
                  <div className="mt-6 border-t border-slate-100 pt-4">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-500">History</p>
                    <ul className="mt-2 space-y-2 text-xs text-slate-600">
                      {selected.verificationLogs.map((log) => (
                        <li key={log.id}>
                          <span className="font-medium capitalize">{log.action.replace(/_/g, ' ')}</span>
                          {' — '}{new Date(log.createdAt).toLocaleString()}
                          {log.note && <span className="block text-slate-500">{log.note}</span>}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  )
})
