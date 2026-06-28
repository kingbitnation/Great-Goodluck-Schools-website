import { useEffect, useState } from 'react'
import { withAuth } from '../../components/withAuth'
import AppLayout from '../../components/layout/AppLayout'
import { apiDelete, apiGet, apiPost } from '../../lib/api'
import type { AuthUser } from '../../lib/useAuth'

type Adjustment = {
  id: string
  type: string
  value: number
  isPercent: boolean
  reason: string | null
  isActive: boolean
  student: { user: { firstName: string; lastName: string } }
  fee: { name: string } | null
}

type Student = { id: string; user: { firstName: string; lastName: string } }

function FeeAdjustmentsPage({ user }: { user: AuthUser }) {
  const [items, setItems] = useState<Adjustment[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [form, setForm] = useState({ studentId: '', type: 'scholarship', value: '', isPercent: false, reason: '' })
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    const [adj, studs] = await Promise.all([
      apiGet<Adjustment[]>('/api/fee-adjustments'),
      apiGet<Student[]>('/api/students'),
    ])
    setItems(adj)
    setStudents(studs)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    try {
      await apiPost('/api/fee-adjustments', {
        ...form,
        value: Number(form.value),
      })
      setMessage('Adjustment created')
      setForm({ studentId: '', type: 'scholarship', value: '', isPercent: false, reason: '' })
      load()
    } catch (err: any) {
      setError(err.message)
    }
  }

  async function remove(id: string) {
    await apiDelete(`/api/fee-adjustments/${id}`)
    load()
  }

  return (
    <AppLayout user={user} title="Fee adjustments">
      <div className="mx-auto max-w-5xl space-y-8 p-6">
        <h1 className="text-2xl font-bold text-school-navy">Scholarships, waivers & penalties</h1>
        {message && <p className="rounded-lg bg-green-50 px-4 py-2 text-sm text-green-800">{message}</p>}
        {error && <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>}

        <form onSubmit={submit} className="content-card grid gap-4 p-6 sm:grid-cols-2">
          <select value={form.studentId} onChange={(e) => setForm({ ...form, studentId: e.target.value })} required className="w-full sm:col-span-2">
            <option value="">Select student</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>{s.user.firstName} {s.user.lastName}</option>
            ))}
          </select>
          <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="w-full">
            <option value="scholarship">Scholarship</option>
            <option value="waiver">Waiver</option>
            <option value="sibling_discount">Sibling discount</option>
            <option value="penalty">Penalty</option>
          </select>
          <input type="number" placeholder="Value" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} required className="w-full" />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.isPercent} onChange={(e) => setForm({ ...form, isPercent: e.target.checked })} />
            Percentage (not fixed amount)
          </label>
          <input placeholder="Reason" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} className="w-full sm:col-span-2" />
          <button type="submit" className="btn-gold sm:col-span-2 sm:w-fit">Add adjustment</button>
        </form>

        <div className="content-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left">
              <tr>
                <th className="px-4 py-3">Student</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Value</th>
                <th className="px-4 py-3">Reason</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {items.filter((i) => i.isActive).map((item) => (
                <tr key={item.id} className="border-t">
                  <td className="px-4 py-3">{item.student.user.firstName} {item.student.user.lastName}</td>
                  <td className="px-4 py-3 capitalize">{item.type.replace('_', ' ')}</td>
                  <td className="px-4 py-3">{item.isPercent ? `${item.value}%` : `₦${item.value}`}</td>
                  <td className="px-4 py-3">{item.reason || '—'}</td>
                  <td className="px-4 py-3">
                    <button type="button" onClick={() => remove(item.id)} className="text-red-600 hover:underline">Remove</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppLayout>
  )
}

export default withAuth(FeeAdjustmentsPage, { roles: ['SuperAdmin', 'SchoolAdmin', 'Accountant'] })
