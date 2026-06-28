import { useEffect, useState } from 'react'
import Link from 'next/link'
import AppLayout from '../../components/layout/AppLayout'
import { withAuth } from '../../components/withAuth'
import { apiGet, apiPatch } from '../../lib/api'
import type { AuthUser } from '../../lib/useAuth'

type Ticket = {
  id: string
  subject: string
  status: string
  priority: string
  category: string
  school?: { name: string }
  createdBy?: { firstName: string; lastName: string }
  _count?: { messages: number }
  updatedAt: string
}

function SupportPage({ user }: { user: AuthUser }) {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [error, setError] = useState<string | null>(null)

  function load() {
    apiGet<Ticket[]>('/api/support/tickets').then(setTickets).catch((e) => setError(e.message))
  }

  useEffect(() => { load() }, [])

  async function closeTicket(id: string) {
    await apiPatch(`/api/support/tickets/${id}`, { status: 'closed' })
    load()
  }

  return (
    <AppLayout user={user} title="Support Desk">
      <div className="mb-4 flex justify-between">
        <p className="text-sm text-gray-600">Manage support tickets from all schools.</p>
        <Link href="/admin/support" className="text-sm text-blue-600 hover:underline">School view</Link>
      </div>
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      <div className="overflow-x-auto rounded-lg border bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-500">
            <tr>
              <th className="p-3">Subject</th>
              <th className="p-3">School</th>
              <th className="p-3">Status</th>
              <th className="p-3">Priority</th>
              <th className="p-3">Updated</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {tickets.map((t) => (
              <tr key={t.id} className="border-t">
                <td className="p-3">
                  <Link href={`/super-admin/support/${t.id}`} className="font-medium text-blue-600 hover:underline">
                    {t.subject}
                  </Link>
                </td>
                <td className="p-3">{t.school?.name || '—'}</td>
                <td className="p-3 capitalize">{t.status.replace('_', ' ')}</td>
                <td className="p-3 capitalize">{t.priority}</td>
                <td className="p-3">{new Date(t.updatedAt).toLocaleDateString()}</td>
                <td className="p-3">
                  {t.status !== 'closed' && (
                    <button type="button" onClick={() => closeTicket(t.id)} className="text-xs text-gray-600 hover:underline">
                      Close
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppLayout>
  )
}

export default withAuth(SupportPage, { roles: ['SuperAdmin'] })
