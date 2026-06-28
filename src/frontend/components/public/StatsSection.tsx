import { useEffect, useState } from 'react'
import { useInView } from '../../hooks/useInView'
import { useCountUp } from '../../hooks/useCountUp'
import { fetchPublic } from '../../lib/publicApi'

type StatCounterProps = {
  value: string
  label: string
  delay?: number
}

function StatItem({ value, label, delay = 0 }: StatCounterProps) {
  const { ref, visible } = useInView()
  const display = useCountUp(value, visible)

  return (
    <div
      ref={ref}
      className="content-card p-6 text-center sm:p-8"
      style={{ transitionDelay: `${delay}ms` }}
    >
      <p className="font-display text-3xl font-bold text-school-royal sm:text-4xl">{display}</p>
      <p className="mt-2 text-sm font-medium text-school-muted">{label}</p>
    </div>
  )
}

const FALLBACK = [
  { value: '1000+', label: 'Students' },
  { value: '80+', label: 'Expert Teachers' },
  { value: '25+', label: 'Years of Excellence' },
  { value: '98%', label: 'WAEC Pass Rate' },
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
          <StatItem key={s.label} value={s.value} label={s.label} delay={i * 80} />
        ))}
      </div>
    </section>
  )
}
