import Link from 'next/link'
import { useEffect, useState } from 'react'
import PublicLayout from '../components/layout/PublicLayout'
import Reveal from '../components/public/Reveal'
import { fetchPublic, type PublicEvent } from '../lib/publicApi'

export default function EventsPage() {
  const [events, setEvents] = useState<PublicEvent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchPublic<PublicEvent[]>('/api/public/events')
      .then(setEvents)
      .finally(() => setLoading(false))
  }, [])

  return (
    <PublicLayout title="Events" subtitle="School calendar highlights">
      {loading ? (
        <p className="text-slate-500">Loading...</p>
      ) : events.length === 0 ? (
        <p className="text-slate-600">No events scheduled.</p>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2">
          {events.map((e, i) => (
            <Reveal key={e.id} delay={i * 80}>
              <article className="content-card flex gap-5 p-5 sm:p-6">
                <div className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-2xl bg-school-navy text-white">
                  <span className="text-xs font-bold uppercase text-school-gold">{e.monthShort}</span>
                  <span className="font-display text-xl font-bold leading-none">{e.dayNum}</span>
                </div>
                <div>
                  <span className="badge-gold">{e.badge}</span>
                  <h2 className="mt-2 font-display text-lg font-semibold text-school-navy">{e.title}</h2>
                  <p className="mt-1 text-sm text-slate-500">{e.venue}</p>
                  {e.description && <p className="mt-2 text-sm text-slate-600">{e.description}</p>}
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      )}
      <p className="mt-8 text-center">
        <Link href="/contact" className="text-sm font-semibold text-school-navy hover:text-school-gold">Contact us for event details →</Link>
      </p>
    </PublicLayout>
  )
}
