import { useEffect, useState } from 'react'
import AppLayout from '../../components/layout/AppLayout'
import { withAuth } from '../../components/withAuth'
import { apiGet, apiPost } from '../../lib/api'
import type { AuthUser } from '../../lib/useAuth'

type Form = { id: string; title: string; slug: string; category: string; isPublished: boolean; _count: { submissions: number }; fields: unknown }

const FIELD_TYPES = ['text', 'email', 'number', 'textarea', 'select', 'date', 'file']

function FormsPage({ user }: { user: AuthUser }) {
  const [forms, setForms] = useState<Form[]>([])
  const [title, setTitle] = useState('')
  const [fieldLabel, setFieldLabel] = useState('')
  const [fieldType, setFieldType] = useState('text')
  const [draftFields, setDraftFields] = useState<Array<{ id: string; label: string; type: string; required: boolean }>>([])
  const [error, setError] = useState<string | null>(null)

  const load = () => apiGet<{ forms: Form[] }>('/api/forms').then((d) => setForms(d.forms)).catch((e) => setError(e.message))
  useEffect(() => { load() }, [])

  function addField() {
    if (!fieldLabel.trim()) return
    setDraftFields((f) => [...f, { id: `f-${Date.now()}`, label: fieldLabel, type: fieldType, required: true }])
    setFieldLabel('')
  }

  async function saveForm(e: React.FormEvent) {
    e.preventDefault()
    if (!title || draftFields.length === 0) return
    await apiPost('/api/forms', { title, fields: draftFields, isPublished: true, category: 'general' })
    setTitle('')
    setDraftFields([])
    load()
  }

  return (
    <AppLayout user={user} title="Form Builder">
      <p className="mb-4 text-sm text-slate-600">Build admission forms, surveys, and permission slips. Share via <code className="rounded bg-slate-100 px-1">/forms/[slug]</code>.</p>
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <form onSubmit={saveForm} className="mb-8 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-800">New form</h2>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Form title" className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" required />
        <div className="mt-3 flex flex-wrap gap-2">
          <input value={fieldLabel} onChange={(e) => setFieldLabel(e.target.value)} placeholder="Field label" className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <select value={fieldType} onChange={(e) => setFieldType(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
            {FIELD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <button type="button" onClick={addField} className="rounded-lg bg-slate-800 px-3 py-2 text-sm text-white">Add field</button>
        </div>
        {draftFields.length > 0 && (
          <ul className="mt-3 space-y-1 text-sm text-slate-600">
            {draftFields.map((f) => <li key={f.id}>{f.label} ({f.type})</li>)}
          </ul>
        )}
        <button type="submit" className="mt-4 rounded-lg bg-school-royal px-4 py-2 text-sm font-medium text-white">Publish form</button>
      </form>

      <ul className="space-y-3">
        {forms.map((f) => (
          <li key={f.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4">
            <div>
              <p className="font-medium text-slate-900">{f.title}</p>
              <p className="text-sm text-slate-500">{f._count.submissions} submissions · /forms/{f.slug}</p>
            </div>
            <span className={`rounded-full px-2 py-0.5 text-xs ${f.isPublished ? 'bg-green-100 text-green-800' : 'bg-slate-100'}`}>{f.isPublished ? 'Live' : 'Draft'}</span>
          </li>
        ))}
      </ul>
    </AppLayout>
  )
}

export default withAuth(FormsPage, { roles: ['SchoolAdmin'] })
