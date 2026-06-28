import Link from 'next/link'
import { useEffect, useState } from 'react'
import AppLayout from '../../components/layout/AppLayout'
import { withAuth } from '../../components/withAuth'
import { apiGet, apiPost } from '../../lib/api'
import type { AuthUser } from '../../lib/useAuth'

type Application = {
  id: string
  referenceNo: string
  studentName: string
  parentName: string
  email: string
  phone?: string
  gradeApplied: string
  status: string
  examScore?: number | null
  createdAt: string
  interviews?: Array<{ scheduledAt: string }>
}

type Stats = { total: number; byStatus: Record<string, number> }

const STATUS_COLORS: Record<string, string> = {
  submitted: 'bg-slate-100 text-slate-700',
  under_review: 'bg-blue-100 text-blue-800',
  exam_scheduled: 'bg-purple-100 text-purple-800',
  interviewed: 'bg-indigo-100 text-indigo-800',
  accepted: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  waitlisted: 'bg-amber-100 text-amber-800',
  enrolled: 'bg-emerald-100 text-emerald-800',
}

function AdmissionsPage({ user }: { user: AuthUser }) {
  const [apps, setApps] = useState<Application[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  function load() {
    setLoading(true)
    const params = new URLSearchParams()
    if (statusFilter) params.set('status', statusFilter)
    if (search.trim()) params.set('q', search.trim())
    Promise.all([
      apiGet<Application[]>(`/api/admissions?${params}`),
      apiGet<Stats>('/api/admissions/stats'),
    ])
      .then(([a, s]) => {
        setApps(a)
        setStats(s)
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [statusFilter])

  return (
    <AppLayout user={user} title="Admissions CRM">
      <div className="mx-auto max-w-7xl space-y-6 p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Admissions CRM</h1>
            <p className="text-sm text-slate-600">Track applications from submission through enrollment.</p>
          </div>
          <Link href="/apply" target="_blank" className="text-sm text-school-navy hover:underline">
            Public apply form →
          </Link>
        </div>

        {stats && (
          <div className="grid gap-3 sm:grid-cols-4 lg:grid-cols-8">
            <div className="content-card p-3 text-center">
              <p className="text-2xl font-bold">{stats.total}</p>
              <p className="text-xs text-slate-500">Total</p>
            </div>
            {Object.entries(stats.byStatus).map(([status, count]) => (
              <button
                key={status}
                type="button"
                onClick={() => setStatusFilter(statusFilter === status ? '' : status)}
                className={`content-card p-3 text-center transition ${statusFilter === status ? 'ring-2 ring-school-gold' : ''}`}
              >
                <p className="text-xl font-bold">{count}</p>
                <p className="text-xs capitalize text-slate-500">{status.replace(/_/g, ' ')}</p>
              </button>
            ))}
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && load()}
            placeholder="Search name, email, reference…"
            className="min-w-[240px] flex-1 rounded border p-2 text-sm"
          />
          <button type="button" onClick={load} className="rounded bg-school-navy px-4 py-2 text-sm text-white">
            Search
          </button>
          {statusFilter && (
            <button type="button" onClick={() => setStatusFilter('')} className="text-sm text-slate-500 hover:underline">
              Clear filter
            </button>
          )}
        </div>

        {error && <div className="rounded bg-red-50 p-4 text-red-700">{error}</div>}

        {loading ? (
          <p className="text-slate-500">Loading…</p>
        ) : apps.length === 0 ? (
          <p className="text-slate-600">No applications yet.</p>
        ) : (
          <div className="content-card overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left">Reference</th>
                  <th className="px-4 py-3 text-left">Student</th>
                  <th className="px-4 py-3 text-left">Parent</th>
                  <th className="px-4 py-3 text-left">Grade</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Submitted</th>
                  <th className="px-4 py-3 text-left"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {apps.map((app) => (
                  <tr key={app.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono text-xs">{app.referenceNo}</td>
                    <td className="px-4 py-3 font-medium">{app.studentName}</td>
                    <td className="px-4 py-3">
                      <div>{app.parentName}</div>
                      <div className="text-xs text-slate-500">{app.email}</div>
                    </td>
                    <td className="px-4 py-3">{app.gradeApplied}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs capitalize ${STATUS_COLORS[app.status] || 'bg-slate-100'}`}>
                        {app.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{new Date(app.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <Link href={`/admin/admissions/${app.id}`} className="text-school-navy hover:underline">
                        Review
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppLayout>
  )
}

export default withAuth(AdmissionsPage, { roles: ['SuperAdmin', 'SchoolAdmin'] })
