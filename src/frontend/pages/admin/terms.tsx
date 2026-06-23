import { useEffect, useState, type FormEvent } from 'react'
import AppLayout from '../../components/layout/AppLayout'
import { withAuth } from '../../components/withAuth'
import { apiGet, apiPost } from '../../lib/api'
import type { AuthUser } from '../../lib/useAuth'

type TermRow = {
  id: string
  name: string
  startDate: string
  endDate: string
  session: { id: string; name: string }
}

type TermFormErrors = {
  sessionId?: string
  name?: string
  startDate?: string
  endDate?: string
}

function TermsPage({ user }: { user: AuthUser }) {
  const [terms, setTerms] = useState<TermRow[]>([])
  const [sessions, setSessions] = useState<{ id: string; name: string }[]>([])
  const [sessionId, setSessionId] = useState('')
  const [name, setName] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<TermFormErrors>({})
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const qs = user.schoolId ? `?schoolId=${user.schoolId}` : ''
    Promise.all([
      apiGet<TermRow[]>(`/api/terms${qs}`),
      apiGet<{ id: string; name: string }[]>(`/api/sessions${qs}`),
    ])
      .then(([termsRes, sessionsRes]) => {
        setTerms(termsRes)
        setSessions(sessionsRes)
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [user.schoolId])

  async function handleCreateTerm(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    setFieldErrors({})

    const validationErrors: TermFormErrors = {}
    if (!sessionId) validationErrors.sessionId = 'Session required'
    if (!name.trim()) validationErrors.name = 'Term name required'
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
      await apiPost('/api/terms', {
        sessionId,
        name,
        startDate,
        endDate,
      })
      const qs = user.schoolId ? `?schoolId=${user.schoolId}` : ''
      const termsRes = await apiGet<TermRow[]>(`/api/terms${qs}`)
      setTerms(termsRes)
      setSessionId('')
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
    <AppLayout user={user} title="Terms">
      <form onSubmit={handleCreateTerm} className="mb-6 rounded-lg border border-gray-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">Create term</h2>
        <div className="grid gap-3 md:grid-cols-3">
          <select
            value={sessionId}
            onChange={(e) => setSessionId(e.target.value)}
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
          >
            <option value="">Select session</option>
            {sessions.map((session) => (
              <option key={session.id} value={session.id}>{session.name}</option>
            ))}
          </select>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Term name"
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
            Create term
          </button>
        </div>
      </form>

      {error && <div className="mb-4 rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}

      {loading ? (
        <p className="text-gray-500">Loading terms...</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-500">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Session</th>
                <th className="px-4 py-3 font-medium">Dates</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {terms.map((term) => (
                <tr key={term.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{term.name}</td>
                  <td className="px-4 py-3 text-gray-600">{term.session.name}</td>
                  <td className="px-4 py-3 text-gray-600">{new Date(term.startDate).toLocaleDateString()} — {new Date(term.endDate).toLocaleDateString()}</td>
                </tr>
              ))}
              {terms.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-gray-500">No terms available</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </AppLayout>
  )
}

export default withAuth(TermsPage, { roles: ['SuperAdmin', 'SchoolAdmin'] })
