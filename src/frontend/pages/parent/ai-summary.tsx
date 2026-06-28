import { useEffect, useState } from 'react'
import AppLayout from '../../components/layout/AppLayout'
import { AiPlanBanner } from '../../components/AiPlanBanner'
import { withAuth } from '../../components/withAuth'
import { apiGet, apiPost } from '../../lib/api'
import type { AuthUser } from '../../lib/useAuth'

type Child = {
  id: string
  user: { firstName: string; lastName: string }
  class?: { name: string }
}

type Summary = {
  summary: string
  highlights: string[]
  concerns: string[]
  provider?: string
}

function ParentAiSummaryPage({ user }: { user: AuthUser }) {
  const [children, setChildren] = useState<Child[]>([])
  const [studentId, setStudentId] = useState('')
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    apiGet<Child[]>('/api/parents/children')
      .then((rows) => {
        setChildren(rows)
        if (rows.length) setStudentId(rows[0].id)
      })
      .catch(() => setError('Failed to load children'))
  }, [])

  async function handleGenerate() {
    if (!studentId) return
    setLoading(true)
    setError('')
    setSummary(null)
    try {
      const res = await apiPost<Summary>('/api/ai/parent/summary', { studentId })
      setSummary(res)
    } catch (e: any) {
      setError(e.message || 'Failed to generate summary')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AppLayout user={user} title="AI Parent Summary">
      <div className="mx-auto max-w-3xl space-y-6 p-8">
        <h1 className="text-3xl font-bold">Weekly Progress Summary</h1>
        <p className="text-slate-600">
          AI-generated overview of your child&apos;s recent results and attendance — for conversation starters at home.
        </p>
        <AiPlanBanner />

        <div className="content-card space-y-4 p-6">
          <div>
            <label className="mb-1 block text-sm font-medium">Child</label>
            <select
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              className="w-full rounded border p-2"
            >
              {children.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.user.firstName} {c.user.lastName}
                  {c.class ? ` (${c.class.name})` : ''}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={loading || !studentId}
            className="rounded bg-school-navy px-4 py-2 text-white disabled:opacity-50"
          >
            {loading ? 'Generating…' : 'Generate summary'}
          </button>
        </div>

        {error && <div className="rounded bg-red-50 p-4 text-red-700">{error}</div>}

        {summary && (
          <div className="content-card space-y-4 p-6">
            <p className="leading-relaxed text-slate-800">{summary.summary}</p>
            {summary.highlights?.length > 0 && (
              <div>
                <h3 className="font-semibold text-green-800">Highlights</h3>
                <ul className="mt-2 list-inside list-disc text-sm">
                  {summary.highlights.map((h, i) => (
                    <li key={i}>{h}</li>
                  ))}
                </ul>
              </div>
            )}
            {summary.concerns?.length > 0 && (
              <div>
                <h3 className="font-semibold text-amber-800">Areas to support</h3>
                <ul className="mt-2 list-inside list-disc text-sm">
                  {summary.concerns.map((c, i) => (
                    <li key={i}>{c}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  )
}

export default withAuth(ParentAiSummaryPage, { roles: ['Parent', 'SuperAdmin', 'SchoolAdmin'] })
