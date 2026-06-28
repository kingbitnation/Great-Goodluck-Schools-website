import { useEffect, useState } from 'react'
import Link from 'next/link'
import AppLayout from '../../components/layout/AppLayout'
import { withAuth } from '../../components/withAuth'
import { apiGet, apiPost } from '../../lib/api'
import type { AuthUser } from '../../lib/useAuth'

type Ticket = {
  id: string
  subject: string
  status: string
  updatedAt: string
}

function SchoolSupportPage({ user }: { user: AuthUser }) {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)

  function load() {
    apiGet<Ticket[]>('/api/support/tickets').then(setTickets).catch((e) => setError(e.message))
  }

  useEffect(() => { load() }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSending(true)
    try {
      await apiPost('/api/support/tickets', { subject, body, category: 'general' })
      setSubject('')
      setBody('')
      load()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed')
    } finally {
      setSending(false)
    }
  }

  return (
    <AppLayout user={user} title="Support">
      <p className="mb-6 text-sm text-gray-600">Open a ticket and our team will respond within one business day.</p>
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <form onSubmit={submit} className="mb-8 max-w-xl space-y-3 rounded-lg border bg-white p-6 shadow-sm">
        <h2 className="font-semibold">New ticket</h2>
        <input className="w-full rounded border px-3 py-2 text-sm" placeholder="Subject" value={subject}
          onChange={(e) => setSubject(e.target.value)} required />
        <textarea className="w-full rounded border px-3 py-2 text-sm" rows={5} placeholder="Describe the issue…"
          value={body} onChange={(e) => setBody(e.target.value)} required />
        <button type="submit" disabled={sending}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white disabled:opacity-50">
          {sending ? 'Submitting…' : 'Submit ticket'}
        </button>
      </form>

      <h2 className="mb-3 font-semibold">Your tickets</h2>
      <ul className="space-y-2">
        {tickets.map((t) => (
          <li key={t.id}>
            <Link href={`/admin/support/${t.id}`} className="block rounded border bg-white p-4 hover:border-blue-300">
              <p className="font-medium">{t.subject}</p>
              <p className="text-xs text-gray-500 capitalize">{t.status} · {new Date(t.updatedAt).toLocaleDateString()}</p>
            </Link>
          </li>
        ))}
      </ul>
    </AppLayout>
  )
}

export default withAuth(SchoolSupportPage, { roles: ['SchoolAdmin', 'SuperAdmin'] })
