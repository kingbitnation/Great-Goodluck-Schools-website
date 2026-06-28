import Link from 'next/link'
import { useEffect, useState } from 'react'
import AppLayout from '../../components/layout/AppLayout'
import { withAuth } from '../../components/withAuth'
import { apiGet } from '../../lib/api'
import type { AuthUser } from '../../lib/useAuth'

type LiveClass = {
  id: string
  title: string
  description?: string | null
  status: string
  scheduledAt?: string | null
  teacherName?: string | null
  recordingUrl?: string | null
}

export default withAuth(function StudentLiveClassesPage({ user }: { user: AuthUser }) {
  const [classes, setClasses] = useState<LiveClass[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiGet<LiveClass[]>('/api/live-classes')
      .then(setClasses)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const live = classes.filter((c) => c.status === 'live')
  const upcoming = classes.filter((c) => c.status === 'scheduled')
  const past = classes.filter((c) => c.status === 'ended')

  function Section({ title, items }: { title: string; items: LiveClass[] }) {
    if (items.length === 0) return null
    return (
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">{title}</h2>
        <div className="space-y-3">
          {items.map((c) => (
            <div key={c.id} className="content-card flex flex-wrap items-center justify-between gap-3 p-5">
              <div>
                <p className="font-semibold text-school-navy">{c.title}</p>
                <p className="text-sm text-slate-500">
                  {c.teacherName || 'Teacher'} · {c.status}
                  {c.scheduledAt && ` · ${new Date(c.scheduledAt).toLocaleString()}`}
                </p>
              </div>
              <Link
                href={`/live-class/${c.id}`}
                className={`text-sm font-medium ${c.status === 'live' ? 'btn-gold' : 'text-school-navy underline'}`}
              >
                {c.status === 'live' ? 'Join class' : c.recordingUrl ? 'Watch recording' : 'Open'}
              </Link>
            </div>
          ))}
        </div>
      </section>
    )
  }

  return (
    <AppLayout user={user} title="Live Classes">
      <div className="mx-auto max-w-5xl space-y-8">
        <h1 className="font-display text-2xl font-bold text-school-navy">Live Classes</h1>
        {loading ? (
          <p className="text-slate-500">Loading...</p>
        ) : classes.length === 0 ? (
          <p className="text-slate-600">No live classes available for your class yet.</p>
        ) : (
          <>
            <Section title="Live now" items={live} />
            <Section title="Upcoming" items={upcoming} />
            <Section title="Past sessions" items={past} />
          </>
        )}
      </div>
    </AppLayout>
  )
}, { roles: ['Student'] })
