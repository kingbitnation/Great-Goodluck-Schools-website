import { useEffect, useState } from 'react'
import { useInView } from '../../hooks/useInView'
import { useCountUp } from '../../hooks/useCountUp'
import { fetchPublic } from '../../lib/publicApi'

const STAT_ACCENTS = [
  'border-school-royal/30 bg-school-royal/5',
  'border-school-gold/30 bg-school-gold/5',
  'border-school-green/30 bg-school-green/5',
  'border-violet-500/30 bg-violet-500/5',
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
      className={`stat-pop card-luxury rounded-2xl border p-6 text-center backdrop-blur-md sm:p-8 ${accent}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      <p className="font-display text-3xl font-black text-white sm:text-4xl">
        <span className="text-shimmer">{display}</span>
      </p>
      <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">{label}</p>
    </div>
  )
}

const FALLBACK = [
  { value: '500+', label: 'Schools onboarded' },
  { value: '50K+', label: 'Active users' },
  { value: '40+', label: 'Modules' },
  { value: '99.9%', label: 'Uptime' },
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
    <section className="container-school -mt-20 relative z-10 pb-4 sm:-mt-24">
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
