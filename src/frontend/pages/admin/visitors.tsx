import { useEffect, useState } from 'react'
import AppLayout from '../../components/layout/AppLayout'
import { withAuth } from '../../components/withAuth'
import { apiGet, apiPost } from '../../lib/api'
import type { AuthUser } from '../../lib/useAuth'

type Visitor = { id: string; fullName: string; phone: string | null; purpose: string; hostName: string | null; passCode: string; status: string; checkInAt: string; checkOutAt: string | null }

function VisitorsPage({ user }: { user: AuthUser }) {
  const [visitors, setVisitors] = useState<Visitor[]>([])
  const [form, setForm] = useState({ fullName: '', phone: '', purpose: '', hostName: '' })
  const [error, setError] = useState<string | null>(null)

  const load = () => apiGet<{ visitors: Visitor[] }>('/api/visitors').then((d) => setVisitors(d.visitors)).catch((e) => setError(e.message))
  useEffect(() => { load() }, [])

  async function checkIn(e: React.FormEvent) {
    e.preventDefault()
    await apiPost('/api/visitors/check-in', form)
    setForm({ fullName: '', phone: '', purpose: '', hostName: '' })
    load()
  }

  async function checkOut(id: string) {
    await apiPost(`/api/visitors/${id}/check-out`, {})
    load()
  }

  return (
    <AppLayout user={user} title="Visitor Management">
      <form onSubmit={checkIn} className="mb-6 grid gap-3 rounded-xl border border-slate-200 bg-white p-5 sm:grid-cols-2">
        <input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} placeholder="Visitor name" className="rounded-lg border px-3 py-2 text-sm" required />
        <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Phone" className="rounded-lg border px-3 py-2 text-sm" />
        <input value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} placeholder="Purpose of visit" className="rounded-lg border px-3 py-2 text-sm sm:col-span-2" required />
        <input value={form.hostName} onChange={(e) => setForm({ ...form, hostName: e.target.value })} placeholder="Host (staff name)" className="rounded-lg border px-3 py-2 text-sm" />
        <button type="submit" className="rounded-lg bg-school-royal px-4 py-2 text-sm font-medium text-white">Check in & generate pass</button>
      </form>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <ul className="space-y-2">
        {visitors.map((v) => (
          <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-white p-4">
            <div>
              <p className="font-medium">{v.fullName}</p>
              <p className="text-sm text-slate-500">{v.purpose} · Pass <strong>{v.passCode}</strong></p>
              <p className="text-xs text-slate-400">{new Date(v.checkInAt).toLocaleString()}</p>
            </div>
            {v.status === 'checked_in' && (
              <button type="button" onClick={() => checkOut(v.id)} className="rounded-lg border px-3 py-1 text-sm">Check out</button>
            )}
          </li>
        ))}
      </ul>
    </AppLayout>
  )
}

export default withAuth(VisitorsPage, { roles: ['SchoolAdmin', 'Teacher'] })
