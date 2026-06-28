import Link from 'next/link'
import { useEffect, useState } from 'react'
import AppLayout from '../../components/layout/AppLayout'
import { withAuth } from '../../components/withAuth'
import { apiDelete, apiGet, apiPost } from '../../lib/api'
import type { AuthUser } from '../../lib/useAuth'

type School = {
  id: string
  name: string
  city?: string
  status?: string
  contactEmail?: string
  subscription?: { status: string; plan?: { name: string } }
  _count?: { students: number; teachers: number; classes: number }
}

type Registration = {
  id: string
  schoolName: string
  adminEmail: string
  adminFirstName: string
  adminLastName: string
  status: string
  proposedPlanSlug: string
  billingInterval?: string
  paymentReference?: string | null
  paymentAmount?: number | null
  paymentStatus?: string
  paymentReceiptUrl?: string | null
  proofUrl?: string | null
  subscriptionPaymentId?: string | null
  paymentReviewStatus?: string | null
  verificationDocuments?: Array<{ label: string; url: string; fileName?: string }> | null
  schoolId: string | null
  createdAt: string
}

function SchoolsPage({ user }: { user: AuthUser }) {
  const [schools, setSchools] = useState<School[]>([])
  const [pending, setPending] = useState<Registration[]>([])
  const [tab, setTab] = useState<'pending' | 'schools'>('pending')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [city, setCity] = useState('')
  const [creating, setCreating] = useState(false)

  function load() {
    setLoading(true)
    Promise.all([
      apiGet<School[]>('/api/schools'),
      apiGet<Registration[]>('/api/school-registrations?status=pending'),
    ])
      .then(([s, p]) => { setSchools(s); setPending(p) })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setCreating(true)
    setError(null)
    try {
      await apiPost('/api/schools', { name, city })
      setName('')
      setCity('')
      load()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Create failed')
    } finally {
      setCreating(false)
    }
  }

  async function verifyPayment(paymentId: string) {
    setError(null)
    try {
      await apiPost(`/api/platform/billing/payments/${paymentId}/approve`, {})
      load()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Payment verification failed')
    }
  }

  async function rejectPayment(paymentId: string) {
    const note = prompt('Reason for rejecting payment:')
    if (!note) return
    setError(null)
    try {
      await apiPost(`/api/platform/billing/payments/${paymentId}/reject`, { note })
      load()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Reject failed')
    }
  }

  async function approve(schoolId: string) {
    setError(null)
    try {
      await apiPost(`/api/schools/${schoolId}/approve`, {})
      load()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Approve failed')
    }
  }

  async function reject(schoolId: string) {
    const note = prompt('Reason for rejection (optional):') ?? 'Does not meet requirements'
    setError(null)
    try {
      await apiPost(`/api/schools/${schoolId}/reject`, { note })
      load()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Reject failed')
    }
  }

  async function suspend(schoolId: string) {
    if (!confirm('Suspend this school?')) return
    await apiPost(`/api/schools/${schoolId}/suspend`, {})
    load()
  }

  async function deleteSchool(schoolId: string, schoolName: string) {
    if (!confirm(`Permanently delete "${schoolName}" and all its data? This cannot be undone.`)) return
    setError(null)
    try {
      await apiDelete(`/api/schools/${schoolId}`)
      load()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Delete failed')
    }
  }

  const statusBadge = (status?: string) => {
    const colors: Record<string, string> = {
      active: 'bg-green-100 text-green-800',
      pending: 'bg-amber-100 text-amber-800',
      suspended: 'bg-red-100 text-red-800',
      trial: 'bg-blue-100 text-blue-800',
    }
    return (
      <span className={`rounded-pill px-2 py-0.5 text-xs font-medium capitalize ${colors[status || 'active'] || 'bg-slate-100'}`}>
        {status || 'active'}
      </span>
    )
  }

  const paymentBadge = (status?: string | null) => {
    if (!status) return <span className="text-slate-400">—</span>
    const colors: Record<string, string> = {
      under_review: 'bg-amber-100 text-amber-800',
      pending: 'bg-amber-100 text-amber-800',
      approved: 'bg-green-100 text-green-800',
      verified: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
    }
    return (
      <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${colors[status] || 'bg-slate-100'}`}>
        {status.replace('_', ' ')}
      </span>
    )
  }

  return (
    <AppLayout user={user} title="Schools">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-school-navy">School management</h1>
        <p className="mt-1 text-sm text-school-muted">
          Verify bank payments, review documents, then approve new schools. Also manage{' '}
          <Link href="/super-admin/billing" className="text-school-royal hover:underline">Billing → Payments</Link>.
        </p>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        <button type="button" onClick={() => setTab('pending')} className={`rounded-lg px-4 py-2 text-sm font-medium ${tab === 'pending' ? 'bg-school-navy text-white' : 'bg-slate-100'}`}>
          Pending verification ({pending.length})
        </button>
        <button type="button" onClick={() => setTab('schools')} className={`rounded-lg px-4 py-2 text-sm font-medium ${tab === 'schools' ? 'bg-school-navy text-white' : 'bg-slate-100'}`}>
          All schools ({schools.length})
        </button>
      </div>

      {tab === 'pending' && pending.length > 0 && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold">How to approve a new school</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5">
            <li>Check the payment receipt and bank reference match the amount.</li>
            <li>Click <strong>Verify payment</strong> to confirm the bank transfer.</li>
            <li>Review uploaded documents (CAC, license, etc.).</li>
            <li>Click <strong>Approve school</strong> to activate the school.</li>
          </ol>
        </div>
      )}

      {tab === 'schools' && (
        <form onSubmit={handleCreate} className="mb-8 content-card p-5">
          <h2 className="mb-4 text-sm font-semibold">Add school (direct)</h2>
          <div className="flex flex-wrap gap-3">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="School name" className="min-w-[200px] flex-1" required />
            <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="City" className="w-40" />
            <button type="submit" disabled={creating} className="btn-gold">{creating ? 'Creating...' : 'Create'}</button>
          </div>
        </form>
      )}

      {error && <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {loading ? (
        <p className="text-slate-500">Loading...</p>
      ) : tab === 'pending' ? (
        <div className="space-y-4">
          {pending.map((r) => {
            const docs = Array.isArray(r.verificationDocuments) ? r.verificationDocuments : []
            const receiptUrl = r.proofUrl || r.paymentReceiptUrl
            const paymentDone = ['approved', 'completed', 'verified'].includes(r.paymentReviewStatus || r.paymentStatus || '')
            return (
              <div key={r.id} className="content-card p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-lg font-bold text-school-navy">{r.schoolName}</p>
                    <p className="text-sm text-school-muted">
                      {r.adminFirstName} {r.adminLastName} · {r.adminEmail}
                    </p>
                    <p className="mt-1 text-sm capitalize">
                      Plan: <span className="font-medium">{r.proposedPlanSlug}</span> ({r.billingInterval || 'monthly'})
                    </p>
                    <p className="mt-1 text-xs text-school-muted">{new Date(r.createdAt).toLocaleString()}</p>

                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      <div className="rounded-lg border border-school-border bg-school-surface p-3">
                        <p className="text-xs font-semibold uppercase text-school-muted">Payment</p>
                        {r.paymentReference ? (
                          <>
                            <p className="mt-1 font-mono text-sm">{r.paymentReference}</p>
                            {r.paymentAmount != null && <p className="font-bold text-school-royal">₦{r.paymentAmount.toLocaleString()}</p>}
                            <div className="mt-2">{paymentBadge(r.paymentReviewStatus || r.paymentStatus)}</div>
                            {receiptUrl && (
                              <a href={receiptUrl} target="_blank" rel="noopener noreferrer" className="link-admin mt-2 inline-block text-sm">
                                View payment receipt →
                              </a>
                            )}
                          </>
                        ) : <p className="mt-1 text-sm text-slate-400">No payment info</p>}
                      </div>
                      <div className="rounded-lg border border-school-border bg-school-surface p-3">
                        <p className="text-xs font-semibold uppercase text-school-muted">Documents</p>
                        {docs.length === 0 ? (
                          <p className="mt-1 text-sm text-slate-400">None uploaded</p>
                        ) : (
                          <ul className="mt-2 space-y-1 text-sm">
                            {docs.map((d, i) => (
                              <li key={i}>
                                <a href={d.url} target="_blank" rel="noopener noreferrer" className="link-admin">
                                  {d.label || d.fileName || `Document ${i + 1}`}
                                </a>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-col gap-2 sm:min-w-[200px]">
                    {r.subscriptionPaymentId && !paymentDone && (
                      <>
                        <button type="button" onClick={() => verifyPayment(r.subscriptionPaymentId!)} className="btn-royal justify-center py-2 text-sm">
                          Verify payment
                        </button>
                        <button type="button" onClick={() => rejectPayment(r.subscriptionPaymentId!)} className="rounded-lg border border-red-200 px-3 py-2 text-sm text-red-600">
                          Reject payment
                        </button>
                      </>
                    )}
                    {paymentDone && r.schoolId && (
                      <p className="rounded-lg bg-green-50 px-3 py-2 text-center text-xs font-medium text-green-700">Payment verified</p>
                    )}
                    {r.schoolId && (
                      <>
                        <button
                          type="button"
                          onClick={() => approve(r.schoolId!)}
                          disabled={!paymentDone}
                          className="btn-green justify-center py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                          title={paymentDone ? 'Approve school' : 'Verify payment first'}
                        >
                          Approve school
                        </button>
                        <button type="button" onClick={() => reject(r.schoolId!)} className="rounded-lg border border-red-200 px-3 py-2 text-sm text-red-600">
                          Reject application
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
          {pending.length === 0 && (
            <div className="content-card p-8 text-center text-slate-500">No schools awaiting verification.</div>
          )}
        </div>
      ) : (
        <div className="content-card overflow-hidden">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Plan</th>
                <th className="px-4 py-3">Students</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {schools.map((school) => (
                <tr key={school.id} className="border-t">
                  <td className="px-4 py-3 font-medium">{school.name}<br /><span className="text-xs text-slate-500">{school.city || '—'}</span></td>
                  <td className="px-4 py-3">{statusBadge(school.status)}</td>
                  <td className="px-4 py-3">{school.subscription?.plan?.name || '—'}</td>
                  <td className="px-4 py-3">{school._count?.students ?? 0}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      {school.status === 'pending' && (
                        <>
                          <button type="button" onClick={() => approve(school.id)} className="text-green-600 hover:underline">Approve</button>
                          <button type="button" onClick={() => reject(school.id)} className="text-red-600 hover:underline">Reject</button>
                        </>
                      )}
                      {school.status === 'active' && (
                        <button type="button" onClick={() => suspend(school.id)} className="text-amber-600 hover:underline">Suspend</button>
                      )}
                      <button type="button" onClick={() => deleteSchool(school.id, school.name)} className="text-red-600 hover:underline">Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
              {schools.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">No schools yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </AppLayout>
  )
}

export default withAuth(SchoolsPage, { roles: ['SuperAdmin'] })
