import { useEffect, useState, type FormEvent } from 'react'
import AppLayout from '../../components/layout/AppLayout'
import { withAuth } from '../../components/withAuth'
import { apiGet, apiPost } from '../../lib/api'
import type { AuthUser } from '../../lib/useAuth'

type SessionRow = {
  id: string
  name: string
  startDate: string
  endDate: string
  active: boolean
  terms: { id: string; name: string }[]
}

type SessionFormErrors = {
  name?: string
  startDate?: string
  endDate?: string
}

function SessionsPage({ user }: { user: AuthUser }) {
  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [name, setName] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<SessionFormErrors>({})
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const qs = user.schoolId ? `?schoolId=${user.schoolId}` : ''
    apiGet<SessionRow[]>(`/api/sessions${qs}`)
      .then(setSessions)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [user.schoolId])

  async function handleCreateSession(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    setFieldErrors({})

    const validationErrors: SessionFormErrors = {}
    if (!name.trim()) validationErrors.name = 'Session name required'
    if (!startDate) validationErrors.startDate = 'Start date required'
    if (!endDate) validationErrors.endDate = 'End date required'
    if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
      validationErrors.endDate = 'End date must come after start date'
    }

    if (Object.keys(validationErrors).length) {
      setFieldErrors(validationErrors)
      setSubmitting(false)
      return
    }

    try {
      await apiPost('/api/sessions', {
        schoolId: user.schoolId,
        name,
        startDate,
        endDate,
      })
      const qs = user.schoolId ? `?schoolId=${user.schoolId}` : ''
      const sessionsRes = await apiGet<SessionRow[]>(`/api/sessions${qs}`)
      setSessions(sessionsRes)
      setName('')
      setStartDate('')
      setEndDate('')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AppLayout user={user} title="Sessions">
      <form onSubmit={handleCreateSession} className="mb-6 rounded-lg border border-gray-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">Create session</h2>
        <div className="grid gap-3 md:grid-cols-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Session name"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div className="mt-4 flex gap-3">
          <button
            type="submit"
            disabled={submitting}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            Create session
          </button>
        </div>
      </form>

      {error && <div className="mb-4 rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}

      {loading ? (
        <p className="text-gray-500">Loading sessions...</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-500">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Dates</th>
                <th className="px-4 py-3 font-medium">Active</th>
                <th className="px-4 py-3 font-medium">Terms</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sessions.map((session) => (
                <tr key={session.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{session.name}</td>
                  <td className="px-4 py-3 text-gray-600">{new Date(session.startDate).toLocaleDateString()} — {new Date(session.endDate).toLocaleDateString()}</td>
                  <td className="px-4 py-3">{session.active ? 'Yes' : 'No'}</td>
                  <td className="px-4 py-3 text-gray-600">{session.terms.length}</td>
                </tr>
              ))}
              {sessions.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-gray-500">No sessions yet</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </AppLayout>
  )
}

export default withAuth(SessionsPage, { roles: ['SuperAdmin', 'SchoolAdmin'] })
