import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import AppLayout from '../../../components/layout/AppLayout'
import { withAuth } from '../../../components/withAuth'
import { apiGet, apiPatch, apiPost } from '../../../lib/api'
import type { AuthUser } from '../../../lib/useAuth'

type Application = {
  id: string
  referenceNo: string
  fullName: string
  email: string
  phone?: string
  coverLetter?: string
  status: string
  posting: { title: string; department?: string }
  interviews: Array<{ id: string; scheduledAt: string; location?: string; outcome?: string }>
}

function HrApplicationDetail({ user }: { user: AuthUser }) {
  const router = useRouter()
  const id = String(router.query.id || '')
  const [app, setApp] = useState<Application | null>(null)
  const [interview, setInterview] = useState({ scheduledAt: '', location: '', interviewer: '' })

  function load() {
    if (!id) return
    apiGet<Application>(`/api/hr/applications/${id}`).then(setApp)
  }

  useEffect(() => { load() }, [id])

  async function setStatus(status: string) {
    await apiPatch(`/api/hr/applications/${id}/status`, { status })
    load()
  }

  async function scheduleInterview() {
    await apiPost(`/api/hr/applications/${id}/interviews`, interview)
    setInterview({ scheduledAt: '', location: '', interviewer: '' })
    load()
  }

  if (!app) return <AppLayout user={user} title="Application"><div className="p-8">Loading…</div></AppLayout>

  return (
    <AppLayout user={user} title={app.referenceNo}>
      <div className="mx-auto max-w-3xl space-y-6 p-8">
        <Link href="/hr/applications" className="text-sm text-slate-500">← Applications</Link>
        <h1 className="text-2xl font-bold">{app.fullName}</h1>
        <p className="text-sm text-slate-500">{app.posting.title} · <span className="capitalize">{app.status}</span></p>
        <p className="text-sm">{app.email} · {app.phone || '—'}</p>
        {app.coverLetter && <p className="rounded bg-slate-50 p-4 text-sm">{app.coverLetter}</p>}

        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setStatus('screening')} className="rounded border px-3 py-1 text-sm">Screening</button>
          <button type="button" onClick={() => setStatus('offered')} className="rounded bg-green-600 px-3 py-1 text-sm text-white">Offer</button>
          <button type="button" onClick={() => setStatus('hired')} className="rounded bg-school-navy px-3 py-1 text-sm text-white">Hired</button>
          <button type="button" onClick={() => setStatus('rejected')} className="rounded bg-red-600 px-3 py-1 text-sm text-white">Reject</button>
        </div>

        <div className="content-card space-y-3 p-4">
          <h2 className="font-semibold">Schedule interview</h2>
          <input type="datetime-local" value={interview.scheduledAt} onChange={(e) => setInterview({ ...interview, scheduledAt: e.target.value })} className="w-full rounded border p-2 text-sm" />
          <input placeholder="Location" value={interview.location} onChange={(e) => setInterview({ ...interview, location: e.target.value })} className="w-full rounded border p-2 text-sm" />
          <button type="button" onClick={scheduleInterview} className="rounded bg-indigo-600 px-3 py-1.5 text-sm text-white">Schedule & email</button>
          {app.interviews.map((iv) => (
            <p key={iv.id} className="text-sm text-slate-600">{new Date(iv.scheduledAt).toLocaleString()} {iv.location ? `· ${iv.location}` : ''}</p>
          ))}
        </div>
      </div>
    </AppLayout>
  )
}

export default withAuth(HrApplicationDetail, { roles: ['SuperAdmin', 'SchoolAdmin', 'HRManager'] })
