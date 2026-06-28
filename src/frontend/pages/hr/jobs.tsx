import Link from 'next/link'
import { useEffect, useState } from 'react'
import AppLayout from '../../components/layout/AppLayout'
import { withAuth } from '../../components/withAuth'
import { apiGet, apiPatch, apiPost } from '../../lib/api'
import type { AuthUser } from '../../lib/useAuth'

type Job = {
  id: string
  title: string
  department?: string
  status: string
  employmentType: string
  _count?: { applications: number }
}

function HrJobsPage({ user }: { user: AuthUser }) {
  const [jobs, setJobs] = useState<Job[]>([])
  const [form, setForm] = useState({ title: '', department: '', description: '', employmentType: 'full_time' })
  const [showForm, setShowForm] = useState(false)

  function load() {
    apiGet<Job[]>('/api/hr/jobs').then(setJobs)
  }

  useEffect(() => { load() }, [])

  async function handleCreate() {
    if (!form.title.trim()) return
    await apiPost('/api/hr/jobs', form)
    setForm({ title: '', department: '', description: '', employmentType: 'full_time' })
    setShowForm(false)
    load()
  }

  async function toggleStatus(job: Job) {
    await apiPatch(`/api/hr/jobs/${job.id}`, { status: job.status === 'open' ? 'closed' : 'open' })
    load()
  }

  return (
    <AppLayout user={user} title="Job Postings">
      <div className="mx-auto max-w-5xl space-y-6 p-8">
        <div className="flex items-center justify-between">
          <Link href="/hr" className="text-sm text-slate-500 hover:text-school-navy">← HR</Link>
          <button type="button" onClick={() => setShowForm(!showForm)} className="rounded bg-school-navy px-4 py-2 text-sm text-white">
            {showForm ? 'Cancel' : '+ New posting'}
          </button>
        </div>

        {showForm && (
          <div className="content-card space-y-3 p-6">
            <input placeholder="Job title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full rounded border p-2" />
            <input placeholder="Department" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} className="w-full rounded border p-2" />
            <textarea placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full rounded border p-2" rows={3} />
            <button type="button" onClick={handleCreate} className="rounded bg-green-600 px-4 py-2 text-sm text-white">Publish</button>
          </div>
        )}

        <div className="space-y-3">
          {jobs.map((j) => (
            <div key={j.id} className="content-card flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <p className="font-semibold">{j.title}</p>
                <p className="text-sm text-slate-500">{j.department || '—'} · {j._count?.applications ?? 0} applications · <span className={j.status === 'open' ? 'text-green-600' : 'text-slate-400'}>{j.status}</span></p>
              </div>
              <button type="button" onClick={() => toggleStatus(j)} className="text-sm text-school-navy hover:underline">
                {j.status === 'open' ? 'Close' : 'Reopen'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </AppLayout>
  )
}

export default withAuth(HrJobsPage, { roles: ['SuperAdmin', 'SchoolAdmin', 'HRManager'] })
