import { useEffect, useMemo, useState } from 'react'
import AppLayout from '../components/layout/AppLayout'
import { withAuth } from '../components/withAuth'
import { apiGet } from '../lib/api'
import { fetchWithAuth } from '../lib/auth'
import type { AuthUser } from '../lib/useAuth'

type CalEvent = {
  id: string
  title: string
  startAt: string
  endAt: string | null
  allDay: boolean
  category: string
  color: string
  location: string | null
  description: string | null
  source: string
}

const FILTERS = [
  { key: 'exam', label: 'Exams', color: '#ef4444' },
  { key: 'fee', label: 'Fees', color: '#f97316' },
  { key: 'live_class', label: 'Live classes', color: '#06b6d4' },
  { key: 'event', label: 'Events', color: '#8b5cf6' },
  { key: 'term', label: 'Terms', color: '#64748b' },
  { key: 'session', label: 'Sessions', color: '#475569' },
  { key: 'custom', label: 'Custom', color: '#f59e0b' },
]

function CalendarPage({ user }: { user: AuthUser }) {
  const [events, setEvents] = useState<CalEvent[]>([])
  const [active, setActive] = useState<string[]>(FILTERS.map((f) => f.key))
  const [error, setError] = useState<string | null>(null)
  const [month, setMonth] = useState(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })

  const range = useMemo(() => {
    const from = new Date(month.getFullYear(), month.getMonth(), 1)
    const to = new Date(month.getFullYear(), month.getMonth() + 1, 0, 23, 59, 59)
    return { from: from.toISOString(), to: to.toISOString() }
  }, [month])

  useEffect(() => {
    const cats = active.join(',')
    apiGet<{ events: CalEvent[] }>(`/api/calendar?from=${range.from}&to=${range.to}&categories=${cats}`)
      .then((d) => setEvents(d.events))
      .catch((e) => setError(e.message))
  }, [range.from, range.to, active.join(',')])

  function toggleFilter(key: string) {
    setActive((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]))
  }

  const monthLabel = month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })

  async function exportIcal() {
    const res = await fetchWithAuth(`/api/calendar/export.ics?from=${range.from}&to=${range.to}`)
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'school-calendar.ics'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <AppLayout user={user} title="School Calendar">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} className="rounded-lg border border-slate-300 px-3 py-1 text-sm hover:bg-slate-50">←</button>
          <h2 className="text-lg font-semibold text-slate-900">{monthLabel}</h2>
          <button type="button" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} className="rounded-lg border border-slate-300 px-3 py-1 text-sm hover:bg-slate-50">→</button>
        </div>
        <button type="button" onClick={exportIcal} className="text-sm font-medium text-school-royal hover:underline">Export iCal</button>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => toggleFilter(f.key)}
            className={`rounded-full px-3 py-1 text-xs font-medium ${active.includes(f.key) ? 'text-white' : 'border bg-white text-gray-600'}`}
            style={active.includes(f.key) ? { backgroundColor: f.color } : undefined}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <ul className="space-y-2">
        {events.length === 0 && <li className="text-sm text-gray-500">No events this month.</li>}
        {events.map((e) => (
          <li key={e.id} className="flex gap-3 rounded-lg border bg-white p-3 shadow-sm">
            <span className="mt-1 h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: e.color }} />
            <div className="min-w-0 flex-1">
              <p className="font-medium">{e.title}</p>
              <p className="text-sm text-gray-500">
                {new Date(e.startAt).toLocaleString()}
                {e.endAt && !e.allDay ? ` — ${new Date(e.endAt).toLocaleTimeString()}` : ''}
                {e.location ? ` · ${e.location}` : ''}
              </p>
              {e.description && <p className="mt-1 text-sm text-gray-600">{e.description}</p>}
              <p className="mt-1 text-xs uppercase tracking-wide text-gray-400">{e.source.replace('_', ' ')}</p>
            </div>
          </li>
        ))}
      </ul>
    </AppLayout>
  )
}

export default withAuth(CalendarPage, {
  roles: ['SuperAdmin', 'SchoolAdmin', 'Teacher', 'Student', 'Parent', 'Accountant'],
})
