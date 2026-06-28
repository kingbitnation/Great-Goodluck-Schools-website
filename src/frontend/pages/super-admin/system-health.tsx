import { useEffect, useState } from 'react'
import AppLayout from '../../components/layout/AppLayout'
import { withAuth } from '../../components/withAuth'
import { apiGet } from '../../lib/api'
import type { AuthUser } from '../../lib/useAuth'

type HealthData = {
  status: string
  database?: { status: string; latencyMs?: number }
  uptime?: number
  memory?: { heapUsedMb: number; heapTotalMb: number }
  integrations?: Array<{ label: string; state: string; detail: string }>
  incidents?: Array<{ title: string; severity: string; status: string; startedAt: string }>
  queues?: { emailPending: number; smsPending: number }
  redis?: { status: string; note?: string }
}

function SystemHealthPage({ user }: { user: AuthUser }) {
  const [data, setData] = useState<HealthData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    apiGet<HealthData>('/api/platform/health').then(setData).catch((e) => setError(e.message))
  }, [])

  return (
    <AppLayout user={user} title="System Health">
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      {!data && !error && <p className="text-sm text-gray-500">Loading health data…</p>}

      {data && (
        <div className="space-y-6">
          <section className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-lg border bg-white p-4">
              <p className="text-sm text-gray-500">API</p>
              <p className="text-xl font-semibold capitalize">{data.status}</p>
            </div>
            <div className="rounded-lg border bg-white p-4">
              <p className="text-sm text-gray-500">Database</p>
              <p className="text-xl font-semibold capitalize">{data.database?.status || 'unknown'}</p>
              {data.database?.latencyMs != null && <p className="text-xs text-gray-400">{data.database.latencyMs}ms</p>}
            </div>
            <div className="rounded-lg border bg-white p-4">
              <p className="text-sm text-gray-500">Uptime</p>
              <p className="text-xl font-semibold">{data.uptime ? `${Math.floor(data.uptime / 3600)}h` : '—'}</p>
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase text-gray-500">Queues</h2>
            <p className="text-sm">Email pending: {data.queues?.emailPending ?? 0} · SMS pending: {data.queues?.smsPending ?? 0}</p>
            <p className="mt-1 text-sm text-gray-500">Redis: {data.redis?.status} — {data.redis?.note}</p>
          </section>

          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase text-gray-500">Integrations</h2>
            <ul className="grid gap-2 sm:grid-cols-2">
              {(data.integrations || []).map((i) => (
                <li key={i.label} className="rounded border bg-white p-3 text-sm">
                  <span className="font-medium">{i.label}</span>
                  <span className={`ml-2 rounded px-1.5 py-0.5 text-xs ${i.state === 'ready' ? 'bg-green-100 text-green-800' : 'bg-gray-100'}`}>
                    {i.state}
                  </span>
                  <p className="mt-1 text-gray-500">{i.detail}</p>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase text-gray-500">Incidents</h2>
            {(data.incidents || []).length === 0 ? (
              <p className="text-sm text-gray-500">No recorded incidents.</p>
            ) : (
              <ul className="space-y-2">
                {data.incidents!.map((inc, idx) => (
                  <li key={idx} className="rounded border bg-white p-3 text-sm">
                    <span className="font-medium">{inc.title}</span>
                    <span className="ml-2 text-xs capitalize text-gray-500">{inc.severity} · {inc.status}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </AppLayout>
  )
}

export default withAuth(SystemHealthPage, { roles: ['SuperAdmin'] })
