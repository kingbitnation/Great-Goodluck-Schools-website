import { useEffect, useState } from 'react'
import AppLayout from '../../components/layout/AppLayout'
import { withAuth } from '../../components/withAuth'
import { apiGet, apiPost } from '../../lib/api'
import type { AuthUser } from '../../lib/useAuth'

type PendingForm = {
  id: string
  title: string
  body: string
  pendingStudents: Array<{ id: string; user?: { firstName: string; lastName: string } }>
}

function ParentConsentPage({ user }: { user: AuthUser }) {
  const [forms, setForms] = useState<PendingForm[]>([])
  const [signature, setSignature] = useState('')

  useEffect(() => {
    apiGet<{ forms: PendingForm[] }>('/api/consent/pending').then((d) => setForms(d.forms))
  }, [])

  async function respond(formId: string, studentId: string, status: 'approved' | 'rejected') {
    await apiPost(`/api/consent/forms/${formId}/respond`, { studentId, status, signatureName: signature || user.email })
    const d = await apiGet<{ forms: PendingForm[] }>('/api/consent/pending')
    setForms(d.forms)
  }

  return (
    <AppLayout user={user} title="Consent Forms">
      <p className="mb-4 text-sm text-slate-600">Review and sign consent forms for your children.</p>
      <label className="mb-4 block text-sm">
        Digital signature (full name)
        <input value={signature} onChange={(e) => setSignature(e.target.value)} className="mt-1 w-full max-w-md rounded-lg border px-3 py-2" placeholder="Your full name" />
      </label>
      {forms.length === 0 && <p className="text-sm text-slate-500">No pending consent forms.</p>}
      {forms.map((f) => (
        <article key={f.id} className="mb-4 rounded-xl border bg-white p-5">
          <h2 className="font-semibold">{f.title}</h2>
          <p className="mt-2 text-sm text-slate-600 whitespace-pre-wrap">{f.body}</p>
          {f.pendingStudents.map((s) => (
            <div key={s.id} className="mt-4 flex flex-wrap items-center gap-2 border-t pt-3">
              <span className="text-sm font-medium">{s.user?.firstName} {s.user?.lastName}</span>
              <button type="button" onClick={() => respond(f.id, s.id, 'approved')} className="rounded-lg bg-green-600 px-3 py-1 text-sm text-white">Approve</button>
              <button type="button" onClick={() => respond(f.id, s.id, 'rejected')} className="rounded-lg border px-3 py-1 text-sm">Decline</button>
            </div>
          ))}
        </article>
      ))}
    </AppLayout>
  )
}

export default withAuth(ParentConsentPage, { roles: ['Parent'] })
