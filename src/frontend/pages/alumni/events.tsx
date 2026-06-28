import Link from 'next/link'
import { useEffect, useState } from 'react'
import { withAuth } from '../../components/withAuth'
import AppLayout from '../../components/layout/AppLayout'
import { apiGet, apiPost, apiDelete } from '../../lib/api'
import type { AuthUser } from '../../lib/useAuth'

type AlumniEvent = {
  id: string
  title: string
  description?: string | null
  venue?: string | null
  eventDate: string
  capacity?: number | null
  rsvpCount: number
  status: string
}

function AlumniEventsPage({ user }: { user: AuthUser }) {
  const [events, setEvents] = useState<AlumniEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const isAdmin = user.role === 'SchoolAdmin' || user.role === 'SuperAdmin'
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ title: '', description: '', venue: '', eventDate: '', capacity: '' })

  useEffect(() => {
    loadEvents()
  }, [])

  async function loadEvents() {
    try {
      setEvents(await apiGet<AlumniEvent[]>('/api/alumni/events'))
    } catch {
      setError('Failed to load events')
    } finally {
      setLoading(false)
    }
  }

  async function handleCreate() {
    if (!form.title || !form.eventDate) return setError('Title and date required')
    try {
      await apiPost('/api/alumni/events', {
        ...form,
        capacity: form.capacity ? Number(form.capacity) : null,
      })
      setShowForm(false)
      setForm({ title: '', description: '', venue: '', eventDate: '', capacity: '' })
      loadEvents()
    } catch {
      setError('Failed to create event')
    }
  }

  async function rsvp(eventId: string) {
    try {
      await apiPost(`/api/alumni/events/${eventId}/rsvp`, { guests: 1 })
      loadEvents()
    } catch {
      setError('RSVP failed — ensure you have an alumni profile')
    }
  }

  async function cancelRsvp(eventId: string) {
    await apiDelete(`/api/alumni/events/${eventId}/rsvp`)
    loadEvents()
  }

  return (
    <AppLayout user={user} title="Alumni Events">
      <div className="p-8 max-w-5xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold">Alumni Events</h1>
            <p className="text-gray-600">Reunions, networking, and school gatherings.</p>
          </div>
          {isAdmin && (
            <button onClick={() => setShowForm(!showForm)} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium">
              {showForm ? 'Cancel' : 'Create event'}
            </button>
          )}
        </div>

        {error && <div className="bg-red-100 text-red-700 p-4 rounded mb-4">{error}</div>}

        {showForm && (
          <div className="bg-white rounded-lg shadow p-6 mb-6 space-y-3">
            <input placeholder="Event title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full border rounded-lg px-3 py-2" />
            <textarea placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full border rounded-lg px-3 py-2" />
            <input placeholder="Venue" value={form.venue} onChange={(e) => setForm({ ...form, venue: e.target.value })} className="w-full border rounded-lg px-3 py-2" />
            <input type="datetime-local" value={form.eventDate} onChange={(e) => setForm({ ...form, eventDate: e.target.value })} className="w-full border rounded-lg px-3 py-2" />
            <input type="number" placeholder="Capacity (optional)" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} className="w-full border rounded-lg px-3 py-2" />
            <button onClick={handleCreate} className="w-full bg-blue-600 text-white py-2 rounded-lg font-medium">Publish event</button>
          </div>
        )}

        {loading ? (
          <div className="text-gray-500">Loading...</div>
        ) : events.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center text-gray-600">No events scheduled.</div>
        ) : (
          <div className="space-y-4">
            {events.map((event) => (
              <div key={event.id} className="bg-white rounded-lg shadow p-6">
                <div className="flex flex-col md:flex-row md:justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold">{event.title}</h2>
                    <p className="text-sm text-blue-600 mt-1">{new Date(event.eventDate).toLocaleString()}</p>
                    {event.venue && <p className="text-sm text-gray-600 mt-1">{event.venue}</p>}
                    {event.description && <p className="text-sm text-gray-700 mt-2">{event.description}</p>}
                    <p className="text-xs text-gray-500 mt-2">{event.rsvpCount} RSVPs{event.capacity ? ` / ${event.capacity} capacity` : ''}</p>
                  </div>
                  {user.role === 'Alumni' && event.status === 'published' && (
                    <div className="flex gap-2 shrink-0">
                      <button onClick={() => rsvp(event.id)} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm">RSVP</button>
                      <button onClick={() => cancelRsvp(event.id)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm">Cancel</button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <p className="mt-6 text-sm text-gray-500">
          <Link href="/admin/alumni" className="text-blue-600 hover:underline">Admin dashboard</Link>
        </p>
      </div>
    </AppLayout>
  )
}

export default withAuth(AlumniEventsPage, { roles: ['SuperAdmin', 'SchoolAdmin', 'Alumni', 'Student', 'Parent'] })
