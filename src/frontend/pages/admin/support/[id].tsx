import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import AppLayout from '../../../components/layout/AppLayout'
import { withAuth } from '../../../components/withAuth'
import { apiGet, apiPost } from '../../../lib/api'
import type { AuthUser } from '../../../lib/useAuth'

type TicketDetail = {
  id: string
  subject: string
  status: string
  messages: Array<{ id: string; body: string; createdAt: string; author?: { firstName: string; lastName: string } }>
}

function SchoolTicketPage({ user }: { user: AuthUser }) {
  const router = useRouter()
  const { id } = router.query
  const [ticket, setTicket] = useState<TicketDetail | null>(null)
  const [reply, setReply] = useState('')

  useEffect(() => {
    if (!id || typeof id !== 'string') return
    apiGet<TicketDetail>(`/api/support/tickets/${id}`).then(setTicket)
  }, [id])

  async function sendReply(e: React.FormEvent) {
    e.preventDefault()
    if (!id || typeof id !== 'string') return
    await apiPost(`/api/support/tickets/${id}/messages`, { body: reply })
    setReply('')
    apiGet<TicketDetail>(`/api/support/tickets/${id}`).then(setTicket)
  }

  return (
    <AppLayout user={user} title="Support Ticket">
      {ticket && (
        <>
          <h1 className="text-lg font-semibold">{ticket.subject}</h1>
          <p className="text-sm capitalize text-gray-500">{ticket.status}</p>
          <ul className="mt-6 space-y-3">
            {ticket.messages.map((m) => (
              <li key={m.id} className="rounded border bg-white p-4 text-sm">
                <p className="text-xs text-gray-500">{m.author?.firstName} {m.author?.lastName}</p>
                <p className="mt-1 whitespace-pre-wrap">{m.body}</p>
              </li>
            ))}
          </ul>
          {ticket.status !== 'closed' && (
            <form onSubmit={sendReply} className="mt-6">
              <textarea className="w-full rounded border p-3 text-sm" rows={3} value={reply}
                onChange={(e) => setReply(e.target.value)} required />
              <button type="submit" className="mt-2 rounded-lg bg-blue-600 px-4 py-2 text-sm text-white">Reply</button>
            </form>
          )}
        </>
      )}
    </AppLayout>
  )
}

export default withAuth(SchoolTicketPage, { roles: ['SchoolAdmin', 'SuperAdmin'] })
