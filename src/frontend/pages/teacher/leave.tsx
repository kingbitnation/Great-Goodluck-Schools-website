import { useEffect, useState } from 'react'
import AppLayout from '../../components/layout/AppLayout'
import { withAuth } from '../../components/withAuth'
import { apiGet, apiPost } from '../../lib/api'
import type { AuthUser } from '../../lib/useAuth'

type Leave = {
  id: string
  leaveType: string
  startDate: string
  endDate: string
  status: string
  reason?: string
}

function TeacherLeavePage({ user }: { user: AuthUser }) {
  const [requests, setRequests] = useState<Leave[]>([])
  const [form, setForm] = useState({ leaveType: 'annual', startDate: '', endDate: '', reason: '' })
  const [message, setMessage] = useState('')

  function load() {
    apiGet<Leave[]>('/api/hr/leave/mine').then(setRequests)
  }

  useEffect(() => { load() }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setMessage('')
    try {
      await apiPost('/api/hr/leave', form)
      setForm({ leaveType: 'annual', startDate: '', endDate: '', reason: '' })
      setMessage('Leave request submitted')
      load()
    } catch (err: any) {
      setMessage(err.message || 'Failed — ensure your employee profile exists (ask HR to sync staff)')
    }
  }

  return (
    <AppLayout user={user} title="My Leave">
      <div className="mx-auto max-w-2xl space-y-8 p-8">
        <h1 className="text-2xl font-bold">Leave requests</h1>

        <form onSubmit={handleSubmit} className="content-card space-y-3 p-6">
          <select value={form.leaveType} onChange={(e) => setForm({ ...form, leaveType: e.target.value })} className="w-full rounded border p-2">
            <option value="annual">Annual leave</option>
            <option value="sick">Sick leave</option>
            <option value="maternity">Maternity / paternity</option>
            <option value="other">Other</option>
          </select>
          <input required type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} className="w-full rounded border p-2" />
          <input required type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} className="w-full rounded border p-2" />
          <textarea placeholder="Reason (optional)" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} className="w-full rounded border p-2" rows={3} />
          <button type="submit" className="rounded bg-school-navy px-4 py-2 text-white">Submit request</button>
          {message && <p className="text-sm text-slate-600">{message}</p>}
        </form>

        <div className="space-y-3">
          {requests.map((r) => (
            <div key={r.id} className="content-card p-4 text-sm">
              <span className="font-medium capitalize">{r.leaveType}</span>
              <span className="mx-2 text-slate-400">·</span>
              <span className="capitalize">{r.status}</span>
              <p className="mt-1 text-slate-600">{new Date(r.startDate).toLocaleDateString()} – {new Date(r.endDate).toLocaleDateString()}</p>
            </div>
          ))}
        </div>
      </div>
    </AppLayout>
  )
}

export default withAuth(TeacherLeavePage, { roles: ['Teacher', 'HRManager', 'SchoolAdmin', 'Accountant', 'Librarian', 'HostelManager', 'TransportManager'] })
