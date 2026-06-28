import { useEffect, useState } from 'react'
import Link from 'next/link'
import { withAuth } from '../../components/withAuth'
import AppLayout from '../../components/layout/AppLayout'
import { apiGet, apiPost } from '../../lib/api'
import type { AuthUser } from '../../lib/useAuth'

type Mentor = {
  id: string
  fullName: string
  graduationYear?: number | null
  currentRole?: string | null
  company?: string | null
}

type Mentorship = {
  id: string
  mentor?: Mentor | null
  menteeName: string
  menteeEmail: string
  focusArea?: string | null
  status: string
}

function AlumniMentorshipPage({ user }: { user: AuthUser }) {
  const [mentors, setMentors] = useState<Mentor[]>([])
  const [mentorships, setMentorships] = useState<Mentorship[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ mentorId: '', menteeName: '', menteeEmail: '', focusArea: '', notes: '' })
  const isAdmin = user.role === 'SchoolAdmin' || user.role === 'SuperAdmin'
  const isAlumniMentor = user.role === 'Alumni'

  useEffect(() => {
    load()
  }, [])

  async function load() {
    try {
      const [m, s] = await Promise.all([
        apiGet<Mentor[]>('/api/alumni/mentors'),
        apiGet<Mentorship[]>('/api/alumni/mentorships'),
      ])
      setMentors(m)
      setMentorships(s)
    } catch {
      setError('Failed to load mentorship data')
    } finally {
      setLoading(false)
    }
  }

  async function requestMentorship(e: React.FormEvent) {
    e.preventDefault()
    if (!form.mentorId || !form.menteeName || !form.menteeEmail) {
      return setError('Select a mentor and provide mentee details')
    }
    try {
      await apiPost('/api/alumni/mentorships', form)
      setForm({ mentorId: '', menteeName: '', menteeEmail: '', focusArea: '', notes: '' })
      setError('')
      load()
    } catch {
      setError('Could not submit mentorship request')
    }
  }

  async function updateStatus(id: string, status: string) {
    await apiPost(`/api/alumni/mentorships/${id}/status`, { status })
    load()
  }

  return (
    <AppLayout user={user} title="Mentorship">
      <div className="p-8 max-w-5xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Mentorship Program</h1>
        <p className="text-gray-600 mb-8">Connect experienced alumni with current students.</p>

        {error && <div className="bg-red-100 text-red-700 p-4 rounded mb-4">{error}</div>}

        {(user.role === 'Student' || user.role === 'Alumni') && (
          <div className="bg-white rounded-lg shadow p-6 mb-8">
            <h2 className="font-bold text-lg mb-4">Request a mentor</h2>
            <form onSubmit={requestMentorship} className="space-y-3">
              <select required value={form.mentorId} onChange={(e) => setForm({ ...form, mentorId: e.target.value })} className="w-full border rounded-lg px-3 py-2">
                <option value="">Select mentor</option>
                {mentors.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.fullName} — {m.currentRole || 'Alumni'}{m.graduationYear ? ` (${m.graduationYear})` : ''}
                  </option>
                ))}
              </select>
              <input required placeholder="Mentee name" value={form.menteeName} onChange={(e) => setForm({ ...form, menteeName: e.target.value })} className="w-full border rounded-lg px-3 py-2" />
              <input required type="email" placeholder="Mentee email" value={form.menteeEmail} onChange={(e) => setForm({ ...form, menteeEmail: e.target.value })} className="w-full border rounded-lg px-3 py-2" />
              <input placeholder="Focus area (e.g. STEM, careers)" value={form.focusArea} onChange={(e) => setForm({ ...form, focusArea: e.target.value })} className="w-full border rounded-lg px-3 py-2" />
              <textarea placeholder="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="w-full border rounded-lg px-3 py-2" rows={2} />
              <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium">Submit request</button>
            </form>
          </div>
        )}

        <h2 className="font-bold text-lg mb-4">Mentorship requests</h2>
        {loading ? (
          <div className="text-gray-500">Loading...</div>
        ) : mentorships.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center text-gray-600">No mentorship requests yet.</div>
        ) : (
          <div className="space-y-3">
            {mentorships.map((m) => (
              <div key={m.id} className="bg-white rounded-lg shadow p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div>
                  <p className="font-medium">{m.menteeName}</p>
                  <p className="text-sm text-gray-600">
                    Mentor: {m.mentor?.fullName || '—'} · {m.focusArea || 'General'}
                  </p>
                  <span className={`inline-block mt-2 px-2 py-0.5 text-xs rounded-full ${
                    m.status === 'active' ? 'bg-green-100 text-green-800' :
                    m.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-gray-100 text-gray-700'
                  }`}>{m.status}</span>
                </div>
                {(isAdmin || isAlumniMentor) && m.status === 'pending' && (
                  <div className="flex gap-2">
                    <button onClick={() => updateStatus(m.id, 'active')} className="px-3 py-1 bg-green-600 text-white rounded text-sm">Accept</button>
                    <button onClick={() => updateStatus(m.id, 'declined')} className="px-3 py-1 border rounded text-sm">Decline</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <p className="mt-6 text-sm">
          <Link href="/alumni" className="text-blue-600 hover:underline">← Alumni portal</Link>
        </p>
      </div>
    </AppLayout>
  )
}

export default withAuth(AlumniMentorshipPage, { roles: ['SuperAdmin', 'SchoolAdmin', 'Alumni', 'Student'] })
