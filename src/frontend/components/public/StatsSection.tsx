import { useEffect, useState } from 'react'
import { useInView } from '../../hooks/useInView'
import { useCountUp } from '../../hooks/useCountUp'
import { fetchPublic } from '../../lib/publicApi'

const STAT_ACCENTS = [
  'from-blue-500/15 to-indigo-600/5 border-blue-500/20',
  'from-amber-500/15 to-orange-600/5 border-amber-500/20',
  'from-emerald-500/15 to-teal-600/5 border-emerald-500/20',
  'from-violet-500/15 to-purple-600/5 border-violet-500/20',
]

type StatCounterProps = {
  value: string
  label: string
  delay?: number
  accent?: string
}

function StatItem({ value, label, delay = 0, accent }: StatCounterProps) {
  const { ref, visible } = useInView()
  const display = useCountUp(value, visible)

  return (
    <div
      ref={ref}
      className={`stat-pop rounded-card border bg-gradient-to-br p-6 text-center shadow-soft transition hover:-translate-y-1 hover:shadow-royal sm:p-8 ${accent}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      <p className="font-display text-3xl font-black text-school-navy dark:text-school-text sm:text-4xl">
        <span className="text-school-royal">{display}</span>
      </p>
      <p className="mt-2 text-sm font-semibold text-school-muted">{label}</p>
    </div>
  )
}

const FALLBACK = [
  { value: '500+', label: 'Schools onboarded' },
  { value: '50K+', label: 'Active users' },
  { value: '15+', label: 'Modules included' },
  { value: '99.9%', label: 'Platform uptime' },
]

type StatsSectionProps = {
  stats?: { label: string; value: string }[]
}

export default function StatsSection({ stats: propStats }: StatsSectionProps) {
  const [stats, setStats] = useState(propStats || FALLBACK)

  useEffect(() => {
    if (propStats?.length) {
      setStats(propStats)
      return
    }
    fetchPublic<{ label: string; value: string }[]>('/api/public/stats')
      .then((data) => { if (data.length) setStats(data) })
      .catch(() => {})
  }, [propStats])

  return (
    <section className="container-school -mt-10 relative z-10 sm:-mt-14">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s, i) => (
          <StatItem
            key={s.label}
            value={s.value}
            label={s.label}
            delay={i * 80}
            accent={STAT_ACCENTS[i % STAT_ACCENTS.length]}
          />
        ))}
      </div>
    </section>
  )
}
