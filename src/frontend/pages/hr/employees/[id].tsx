import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import AppLayout from '../../../components/layout/AppLayout'
import { withAuth } from '../../../components/withAuth'
import { apiGet, apiPost } from '../../../lib/api'
import type { AuthUser } from '../../../lib/useAuth'

type Employee = {
  id: string
  firstName: string
  lastName: string
  jobTitle: string
  email: string
  contracts: Array<{ id: string; title: string; startDate: string; salary?: number; status: string }>
  performanceReviews: Array<{ id: string; periodLabel: string; rating?: number; status: string }>
  leaveRequests: Array<{ id: string; leaveType: string; status: string; startDate: string; endDate: string }>
}

function HrEmployeeDetail({ user }: { user: AuthUser }) {
  const router = useRouter()
  const id = String(router.query.id || '')
  const [emp, setEmp] = useState<Employee | null>(null)
  const [contract, setContract] = useState({ title: '', salary: '', startDate: '' })
  const [review, setReview] = useState({ periodLabel: '', rating: '4', strengths: '', goals: '' })

  function load() {
    if (!id) return
    apiGet<Employee>(`/api/hr/employees/${id}`).then(setEmp)
  }

  useEffect(() => { load() }, [id])

  async function addContract() {
    await apiPost(`/api/hr/employees/${id}/contracts`, {
      title: contract.title || undefined,
      salary: contract.salary ? Number(contract.salary) : undefined,
      startDate: contract.startDate || new Date().toISOString(),
    })
    setContract({ title: '', salary: '', startDate: '' })
    load()
  }

  async function addReview() {
    await apiPost(`/api/hr/employees/${id}/reviews`, {
      ...review,
      rating: Number(review.rating),
      status: 'final',
    })
    setReview({ periodLabel: '', rating: '4', strengths: '', goals: '' })
    load()
  }

  if (!emp) return <AppLayout user={user} title="Employee"><div className="p-8">Loading…</div></AppLayout>

  return (
    <AppLayout user={user} title={`${emp.firstName} ${emp.lastName}`}>
      <div className="mx-auto max-w-4xl space-y-8 p-8">
        <Link href="/hr/employees" className="text-sm text-slate-500">← Employees</Link>
        <div>
          <h1 className="text-2xl font-bold">{emp.firstName} {emp.lastName}</h1>
          <p className="text-slate-600">{emp.jobTitle} · {emp.email}</p>
        </div>

        <section className="content-card p-6">
          <h2 className="font-semibold">Contracts</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {emp.contracts.map((c) => (
              <li key={c.id}>{c.title} — from {new Date(c.startDate).toLocaleDateString()} {c.salary ? `· ₦${c.salary}` : ''}</li>
            ))}
          </ul>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <input placeholder="Contract title" value={contract.title} onChange={(e) => setContract({ ...contract, title: e.target.value })} className="rounded border p-2 text-sm" />
            <input placeholder="Salary" value={contract.salary} onChange={(e) => setContract({ ...contract, salary: e.target.value })} className="rounded border p-2 text-sm" />
            <button type="button" onClick={addContract} className="rounded bg-school-navy px-3 py-2 text-sm text-white">Add contract</button>
          </div>
        </section>

        <section className="content-card p-6">
          <h2 className="font-semibold">Performance reviews</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {emp.performanceReviews.map((r) => (
              <li key={r.id}>{r.periodLabel} — {r.rating ?? '—'}/5 · {r.status}</li>
            ))}
          </ul>
          <div className="mt-4 space-y-2">
            <input placeholder="Period e.g. Q1 2026" value={review.periodLabel} onChange={(e) => setReview({ ...review, periodLabel: e.target.value })} className="w-full rounded border p-2 text-sm" />
            <textarea placeholder="Strengths" value={review.strengths} onChange={(e) => setReview({ ...review, strengths: e.target.value })} className="w-full rounded border p-2 text-sm" rows={2} />
            <button type="button" onClick={addReview} className="rounded bg-school-navy px-3 py-2 text-sm text-white">Save review</button>
          </div>
        </section>

        <section className="content-card p-6">
          <h2 className="font-semibold">Leave history</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {emp.leaveRequests.map((l) => (
              <li key={l.id} className="capitalize">{l.leaveType} — {l.status} ({new Date(l.startDate).toLocaleDateString()} – {new Date(l.endDate).toLocaleDateString()})</li>
            ))}
          </ul>
        </section>
      </div>
    </AppLayout>
  )
}

export default withAuth(HrEmployeeDetail, { roles: ['SuperAdmin', 'SchoolAdmin', 'HRManager'] })
