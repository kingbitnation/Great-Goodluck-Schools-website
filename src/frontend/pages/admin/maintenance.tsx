import { useEffect, useState } from 'react'
import AppLayout from '../../components/layout/AppLayout'
import { withAuth } from '../../components/withAuth'
import { apiGet, apiPatch, apiPost } from '../../lib/api'
import type { AuthUser } from '../../lib/useAuth'

type Ticket = { id: string; title: string; description: string; category: string; priority: string; status: string; location: string | null; createdAt: string }

function MaintenancePage({ user }: { user: AuthUser }) {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('facilities')
  const [location, setLocation] = useState('')

  const load = () => apiGet<{ tickets: Ticket[] }>('/api/maintenance').then((d) => setTickets(d.tickets))
  useEffect(() => { load() }, [])

  async function report(e: React.FormEvent) {
    e.preventDefault()
    await apiPost('/api/maintenance', { title, description, category, location, priority: 'medium' })
    setTitle('')
    setDescription('')
    setLocation('')
    load()
  }

  async function resolve(id: string) {
    await apiPatch(`/api/maintenance/${id}`, { status: 'resolved' })
    load()
  }

  return (
    <AppLayout user={user} title="Maintenance">
      <form onSubmit={report} className="mb-6 space-y-3 rounded-xl border bg-white p-5">
        <h2 className="text-sm font-semibold text-slate-800">Report an issue</h2>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Short title" className="w-full rounded-lg border px-3 py-2 text-sm" required />
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe the problem" className="w-full rounded-lg border px-3 py-2 text-sm" rows={3} required />
        <div className="flex gap-2">
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="rounded-lg border px-3 py-2 text-sm">
            {['facilities', 'electrical', 'plumbing', 'it', 'furniture'].map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Location" className="flex-1 rounded-lg border px-3 py-2 text-sm" />
        </div>
        <button type="submit" className="rounded-lg bg-school-royal px-4 py-2 text-sm text-white">Submit ticket</button>
      </form>
      <ul className="space-y-2">
        {tickets.map((t) => (
          <li key={t.id} className="rounded-xl border bg-white p-4">
            <div className="flex justify-between gap-2">
              <p className="font-medium">{t.title}</p>
              <span className="text-xs capitalize text-slate-500">{t.priority} · {t.status}</span>
            </div>
            <p className="mt-1 text-sm text-slate-600">{t.description}</p>
            {t.status !== 'resolved' && user.role !== 'Teacher' && (
              <button type="button" onClick={() => resolve(t.id)} className="mt-2 text-sm text-school-royal">Mark resolved</button>
            )}
          </li>
        ))}
      </ul>
    </AppLayout>
  )
}

export default withAuth(MaintenancePage, { roles: ['SchoolAdmin', 'Teacher', 'Accountant', 'HRManager'] })
