import Link from 'next/link'
import { useEffect, useState } from 'react'
import { withAuth } from '../../components/withAuth'
import AppLayout from '../../components/layout/AppLayout'
import { apiGet, apiPost } from '../../lib/api'
import type { AuthUser } from '../../lib/useAuth'

type Donation = {
  id: string
  donorName: string
  donorEmail: string
  amount: number
  reference: string
  status: string
  receiptUrl?: string | null
  gateway: string
  message?: string | null
  createdAt: string
}

function AdminAlumniDonationsPage({ user }: { user: AuthUser }) {
  const [donations, setDonations] = useState<Donation[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'pending' | 'all'>('pending')

  function load() {
    apiGet<Donation[]>('/api/alumni/donations').then(setDonations).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  async function confirm(id: string) {
    await apiPost(`/api/alumni/donations/${id}/confirm`, {})
    load()
  }

  async function reject(id: string) {
    const note = prompt('Reason for rejection (optional):')
    if (note === null) return
    await apiPost(`/api/alumni/donations/${id}/reject`, { note })
    load()
  }

  const visible = filter === 'pending'
    ? donations.filter((d) => d.status === 'pending')
    : donations

  return (
    <AppLayout user={user} title="Alumni Donations">
      <div className="mx-auto max-w-5xl p-6 sm:p-8">
        <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-school-navy">Donation confirmations</h1>
            <p className="text-sm text-school-muted">Mark bank transfers as received after verifying payment.</p>
          </div>
          <Link href="/admin/alumni" className="text-sm text-school-royal hover:underline">← Alumni hub</Link>
        </div>

        <div className="mb-4 flex gap-2">
          <button
            type="button"
            onClick={() => setFilter('pending')}
            className={`rounded-lg px-4 py-2 text-sm font-medium ${filter === 'pending' ? 'bg-school-royal text-white' : 'border border-school-border bg-school-surface'}`}
          >
            Pending ({donations.filter((d) => d.status === 'pending').length})
          </button>
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={`rounded-lg px-4 py-2 text-sm font-medium ${filter === 'all' ? 'bg-school-royal text-white' : 'border border-school-border bg-school-surface'}`}
          >
            All
          </button>
        </div>

        {loading ? (
          <p className="text-school-muted">Loading…</p>
        ) : visible.length === 0 ? (
          <div className="content-card p-8 text-center text-school-muted">No donations in this view.</div>
        ) : (
          <ul className="space-y-3">
            {visible.map((d) => (
              <li key={d.id} className="content-card flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold text-school-navy">{d.donorName}</p>
                  <p className="text-sm text-school-muted">{d.donorEmail}</p>
                  <p className="mt-1 text-lg font-bold text-school-royal">₦{d.amount.toLocaleString()}</p>
                  <p className="font-mono text-xs text-school-muted">Ref: {d.reference}</p>
                  {d.receiptUrl && (
                    <a href={d.receiptUrl} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-sm text-school-royal hover:underline">
                      View payment receipt
                    </a>
                  )}
                  <p className="text-xs text-school-muted">{new Date(d.createdAt).toLocaleString()}</p>
                </div>
                <div className="flex flex-col gap-2 sm:items-end">
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${
                    d.status === 'completed' ? 'bg-school-green/15 text-[#047857]' :
                    d.status === 'pending' ? 'bg-school-gold/15 text-[#b45309]' :
                    'bg-red-100 text-red-700'
                  }`}>{d.status}</span>
                  {d.status === 'pending' && (
                    <div className="flex gap-2">
                      <button type="button" onClick={() => confirm(d.id)} className="btn-green py-2 text-sm">Confirm received</button>
                      <button type="button" onClick={() => reject(d.id)} className="rounded-lg border border-red-200 px-3 py-2 text-sm text-red-600">Reject</button>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppLayout>
  )
}

export default withAuth(AdminAlumniDonationsPage, { roles: ['SuperAdmin', 'SchoolAdmin'] })
