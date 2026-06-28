import Link from 'next/link'
import { useEffect, useState } from 'react'
import { apiGet } from '../../lib/api'

export type IntegrationStatus = {
  id: string
  label: string
  state: 'ready' | 'optional' | 'missing' | 'demo'
  detail: string
  href: string | null
  envKey?: string
  required?: boolean
}

type SystemStatusResponse = {
  schoolId: string | null
  checkedAt: string
  integrations: IntegrationStatus[]
}

const STATE_STYLES: Record<IntegrationStatus['state'], { dot: string; badge: string; label: string }> = {
  ready: {
    dot: 'bg-emerald-500',
    badge: 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300',
    label: 'Ready',
  },
  optional: {
    dot: 'bg-amber-400',
    badge: 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300',
    label: 'Optional',
  },
  missing: {
    dot: 'bg-red-500',
    badge: 'bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-300',
    label: 'Not set up',
  },
  demo: {
    dot: 'bg-sky-400',
    badge: 'bg-sky-50 text-sky-800 dark:bg-sky-950/40 dark:text-sky-300',
    label: 'Demo mode',
  },
}

export default function SystemStatusPanel() {
  const [data, setData] = useState<SystemStatusResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    apiGet<SystemStatusResponse>('/api/system/status')
      .then(setData)
      .catch(() => setError('Could not load system status'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <section className="mb-8 rounded-card border border-school-border bg-school-surface p-6 shadow-soft">
        <p className="text-sm text-school-muted">Loading system status…</p>
      </section>
    )
  }

  if (error || !data) {
    return null
  }

  const readyCount = data.integrations.filter((i) => i.state === 'ready').length

  return (
    <section className="mb-8 rounded-card border border-school-border bg-school-surface p-6 shadow-soft" aria-labelledby="system-status-heading">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="system-status-heading" className="font-display text-lg font-semibold text-school-text">
            System status
          </h2>
          <p className="mt-1 text-sm text-school-muted">
            {readyCount} of {data.integrations.length} integrations ready — no secrets shown here
          </p>
        </div>
        <span className="text-xs text-school-muted">
          Updated {new Date(data.checkedAt).toLocaleTimeString()}
        </span>
      </div>

      <ul className="grid gap-3 sm:grid-cols-2">
        {data.integrations.map((item) => {
          const style = STATE_STYLES[item.state]
          const content = (
            <>
              <div className="flex items-start gap-3">
                <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${style.dot}`} aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-school-text">{item.label}</p>
                    <span className={`rounded-pill px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${style.badge}`}>
                      {style.label}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-school-muted">{item.detail}</p>
                  {item.envKey && item.state !== 'ready' && (
                    <p className="mt-1 font-mono text-xs text-school-muted">.env → {item.envKey}</p>
                  )}
                </div>
              </div>
            </>
          )

          return (
            <li key={item.id}>
              {item.href ? (
                <Link
                  href={item.href}
                  className="block rounded-xl border border-school-border p-4 transition hover:border-school-gold/40 hover:bg-school-muted/5"
                >
                  {content}
                </Link>
              ) : (
                <div className="rounded-xl border border-school-border p-4">{content}</div>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
