import { useEffect, useState } from 'react'
import AppLayout from '../../components/layout/AppLayout'
import { withAuth } from '../../components/withAuth'
import { apiGet, apiPost } from '../../lib/api'
import type { AuthUser } from '../../lib/useAuth'

type Announcement = {
  id: string
  title: string
  body: string
  targetRoles: string[]
  isActive: boolean
  publishAt: string
  createdAt: string
}

function CommunicationsPage({ user }: { user: AuthUser }) {
  const [items, setItems] = useState<Announcement[]>([])
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [targetRole, setTargetRole] = useState('')
  const [message, setMessage] = useState('')

  function load() {
    apiGet<Announcement[]>('/api/platform/announcements/all').then(setItems)
  }

  useEffect(() => { load() }, [])

  async function publish(broadcast: boolean) {
    await apiPost('/api/platform/announcements', {
      title,
      body,
      targetRoles: targetRole ? [targetRole] : [],
      broadcast,
    })
    setTitle('')
    setBody('')
    setMessage(broadcast ? 'Announcement published and notifications sent' : 'Announcement saved')
    load()
  }

  return (
    <AppLayout user={user} title="Communication Center">
      <p className="mb-6 text-sm text-gray-600">Platform-wide announcements and targeted broadcasts.</p>
      {message && <p className="mb-4 rounded bg-green-50 px-4 py-2 text-sm text-green-800">{message}</p>}

      <form className="mb-8 max-w-xl space-y-3 rounded-lg border bg-white p-6 shadow-sm" onSubmit={(e) => e.preventDefault()}>
        <h2 className="font-semibold">New announcement</h2>
        <input className="w-full rounded border px-3 py-2 text-sm" placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} required />
        <textarea className="w-full rounded border px-3 py-2 text-sm" rows={4} placeholder="Message body" value={body} onChange={(e) => setBody(e.target.value)} required />
        <select className="w-full rounded border px-3 py-2 text-sm" value={targetRole} onChange={(e) => setTargetRole(e.target.value)}>
          <option value="">All roles</option>
          <option value="SchoolAdmin">School admins</option>
          <option value="Teacher">Teachers</option>
          <option value="Parent">Parents</option>
          <option value="Student">Students</option>
        </select>
        <div className="flex gap-2">
          <button type="button" onClick={() => publish(false)} className="rounded-lg border px-4 py-2 text-sm">Save draft</button>
          <button type="button" onClick={() => publish(true)} className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white">Publish & notify</button>
        </div>
      </form>

      <h2 className="mb-3 font-semibold">Recent announcements</h2>
      <ul className="space-y-3">
        {items.map((a) => (
          <li key={a.id} className="rounded-lg border bg-white p-4 text-sm">
            <p className="font-medium">{a.title}</p>
            <p className="mt-1 text-gray-600">{a.body}</p>
            <p className="mt-2 text-xs text-gray-400">{new Date(a.publishAt).toLocaleString()}</p>
          </li>
        ))}
      </ul>
    </AppLayout>
  )
}

export default withAuth(CommunicationsPage, { roles: ['SuperAdmin'] })
