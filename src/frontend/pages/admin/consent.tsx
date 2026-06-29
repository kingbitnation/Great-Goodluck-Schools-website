import { useEffect, useState } from 'react'
import AppLayout from '../../components/layout/AppLayout'
import { withAuth } from '../../components/withAuth'
import { apiGet, apiPost } from '../../lib/api'
import type { AuthUser } from '../../lib/useAuth'

type ConsentForm = { id: string; title: string; description: string | null; isActive: boolean; _count: { responses: number } }

function ConsentAdminPage({ user }: { user: AuthUser }) {
  const [forms, setForms] = useState<ConsentForm[]>([])
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')

  const load = () => apiGet<{ forms: ConsentForm[] }>('/api/consent/forms').then((d) => setForms(d.forms))
  useEffect(() => { load() }, [])

  async function create(e: React.FormEvent) {
    e.preventDefault()
    await apiPost('/api/consent/forms', { title, body, description: 'Parent consent required' })
    setTitle('')
    setBody('')
    load()
  }

  return (
    <AppLayout user={user} title="Consent Forms">
      <form onSubmit={create} className="mb-6 space-y-3 rounded-xl border bg-white p-5">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Form title (e.g. School trip)" className="w-full rounded-lg border px-3 py-2 text-sm" required />
        <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Consent text parents must read" className="w-full rounded-lg border px-3 py-2 text-sm" rows={4} required />
        <button type="submit" className="rounded-lg bg-school-royal px-4 py-2 text-sm text-white">Send to parents</button>
      </form>
      <ul className="space-y-2">
        {forms.map((f) => (
          <li key={f.id} className="rounded-xl border bg-white p-4">
            <p className="font-medium">{f.title}</p>
            <p className="text-sm text-slate-500">{f._count.responses} responses</p>
          </li>
        ))}
      </ul>
    </AppLayout>
  )
}

export default withAuth(ConsentAdminPage, { roles: ['SchoolAdmin', 'Teacher'] })
