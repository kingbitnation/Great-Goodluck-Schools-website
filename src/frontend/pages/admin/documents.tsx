import { useEffect, useRef, useState } from 'react'
import AppLayout from '../../components/layout/AppLayout'
import { withAuth } from '../../components/withAuth'
import { apiDelete, apiGet, apiPatch, apiPost } from '../../lib/api'
import type { AuthUser } from '../../lib/useAuth'

type Doc = {
  id: string
  title: string
  category: string
  visibility: string
  expiresAt: string | null
  folder?: { name: string } | null
  latestVersion?: { fileUrl: string; versionNumber: number } | null
}

function DocumentsPage({ user }: { user: AuthUser }) {
  const [docs, setDocs] = useState<Doc[]>([])
  const [expiring, setExpiring] = useState<Doc[]>([])
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('general')
  const [expiresAt, setExpiresAt] = useState('')
  const [visibility, setVisibility] = useState('staff')
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = () => {
    apiGet<{ documents: Doc[] }>('/api/documents').then((d) => setDocs(d.documents)).catch((e) => setError(e.message))
    apiGet<{ documents: Doc[] }>('/api/documents/expiring/list').then((d) => setExpiring(d.documents)).catch(() => {})
  }

  useEffect(() => { load() }, [])

  async function upload(e: React.FormEvent) {
    e.preventDefault()
    const file = fileRef.current?.files?.[0]
    if (!file || !title) return
    setError(null)
    const reader = new FileReader()
    reader.onload = async () => {
      try {
        await apiPost('/api/documents', {
          title,
          category,
          visibility,
          expiresAt: expiresAt || null,
          fileBase64: reader.result,
          mimeType: file.type,
        })
        setTitle('')
        setExpiresAt('')
        if (fileRef.current) fileRef.current.value = ''
        load()
      } catch (err: any) {
        setError(err.message)
      }
    }
    reader.readAsDataURL(file)
  }

  async function archive(id: string) {
    await apiPatch(`/api/documents/${id}`, { archived: true })
    load()
  }

  async function remove(id: string) {
    if (!confirm('Delete this document permanently?')) return
    await apiDelete(`/api/documents/${id}`)
    load()
  }

  return (
    <AppLayout user={user} title="Document Vault">
      <p className="mb-4 text-sm text-gray-600">Secure storage with versions, role permissions, and expiry tracking.</p>
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {expiring.length > 0 && (
        <section className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <h2 className="text-sm font-semibold text-amber-900">Expiring within 30 days</h2>
          <ul className="mt-2 text-sm text-amber-800">
            {expiring.map((d) => (
              <li key={d.id}>{d.title} — {d.expiresAt ? new Date(d.expiresAt).toLocaleDateString() : ''}</li>
            ))}
          </ul>
        </section>
      )}

      <form onSubmit={upload} className="mb-8 grid gap-3 rounded-lg border bg-white p-4 shadow-sm md:grid-cols-2">
        <h2 className="md:col-span-2 text-sm font-semibold uppercase text-gray-500">Upload document</h2>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className="rounded border px-3 py-2 text-sm" required />
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="rounded border px-3 py-2 text-sm">
          {['general', 'admission', 'medical', 'contract', 'certificate', 'staff', 'student'].map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select value={visibility} onChange={(e) => setVisibility(e.target.value)} className="rounded border px-3 py-2 text-sm">
          <option value="staff">Staff only</option>
          <option value="school">Whole school</option>
          <option value="student">Students</option>
          <option value="parent">Parents</option>
        </select>
        <input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} className="rounded border px-3 py-2 text-sm" />
        <input ref={fileRef} type="file" accept=".pdf,image/*" className="md:col-span-2 text-sm" required />
        <button type="submit" className="md:col-span-2 rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white">Upload</button>
      </form>

      <ul className="space-y-2">
        {docs.map((d) => (
          <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-white p-4">
            <div>
              <p className="font-medium">{d.title}</p>
              <p className="text-sm text-gray-500">{d.category} · {d.visibility}{d.folder?.name ? ` · ${d.folder.name}` : ''}</p>
              {d.expiresAt && <p className="text-xs text-gray-400">Expires {new Date(d.expiresAt).toLocaleDateString()}</p>}
            </div>
            <div className="flex gap-2">
              {d.latestVersion?.fileUrl && (
                <a href={d.latestVersion.fileUrl} target="_blank" rel="noreferrer" className="rounded border px-3 py-1 text-sm">Download</a>
              )}
              <button type="button" onClick={() => archive(d.id)} className="rounded border px-3 py-1 text-sm">Archive</button>
              <button type="button" onClick={() => remove(d.id)} className="rounded border border-red-200 px-3 py-1 text-sm text-red-700">Delete</button>
            </div>
          </li>
        ))}
      </ul>
    </AppLayout>
  )
}

export default withAuth(DocumentsPage, { roles: ['SuperAdmin', 'SchoolAdmin', 'Teacher', 'Accountant', 'HRManager'] })
