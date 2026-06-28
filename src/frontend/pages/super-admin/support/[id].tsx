import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import AppLayout from '../../../components/layout/AppLayout'
import { withAuth } from '../../../components/withAuth'
import { apiGet, apiPost } from '../../../lib/api'
import type { AuthUser } from '../../../lib/useAuth'

type Message = {
  id: string
  body: string
  isInternal: boolean
  createdAt: string
  author?: { firstName: string; lastName: string; role?: { name: string } }
}

type TicketDetail = {
  id: string
  subject: string
  status: string
  school?: { name: string }
  messages: Message[]
}

function TicketDetailPage({ user }: { user: AuthUser }) {
  const router = useRouter()
  const { id } = router.query
  const [ticket, setTicket] = useState<TicketDetail | null>(null)
  const [reply, setReply] = useState('')
  const [internal, setInternal] = useState(false)

  function load() {
    if (!id || typeof id !== 'string') return
    apiGet<TicketDetail>(`/api/support/tickets/${id}`).then(setTicket)
  }

  useEffect(() => { load() }, [id])

  async function sendReply(e: React.FormEvent) {
    e.preventDefault()
    if (!id || typeof id !== 'string' || !reply.trim()) return
    await apiPost(`/api/support/tickets/${id}/messages`, { body: reply, isInternal: internal })
    setReply('')
    load()
  }

  return (
    <AppLayout user={user} title="Support Ticket">
      {!ticket ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : (
        <>
          <h1 className="text-lg font-semibold">{ticket.subject}</h1>
          <p className="text-sm text-gray-500">{ticket.school?.name} · {ticket.status}</p>
          <ul className="mt-6 space-y-4">
            {ticket.messages.map((m) => (
              <li key={m.id} className={`rounded-lg border p-4 ${m.isInternal ? 'border-amber-200 bg-amber-50' : 'bg-white'}`}>
                <p className="text-xs text-gray-500">
                  {m.author?.firstName} {m.author?.lastName}
                  {m.isInternal && ' · Internal note'}
                </p>
                <p className="mt-2 whitespace-pre-wrap text-sm">{m.body}</p>
              </li>
            ))}
          </ul>
          <form onSubmit={sendReply} className="mt-6 space-y-3">
            <textarea className="w-full rounded border p-3 text-sm" rows={4} value={reply}
              onChange={(e) => setReply(e.target.value)} placeholder="Reply…" required />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={internal} onChange={(e) => setInternal(e.target.checked)} />
              Internal note (staff only)
            </label>
            <button type="submit" className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white">Send</button>
          </form>
        </>
      )}
    </AppLayout>
  )
}

export default withAuth(TicketDetailPage, { roles: ['SuperAdmin'] })
