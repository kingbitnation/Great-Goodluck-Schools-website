import { useEffect, useState } from 'react'
import AppLayout from '../../components/layout/AppLayout'
import { withAuth } from '../../components/withAuth'
import { apiGet } from '../../lib/api'
import type { AuthUser } from '../../lib/useAuth'

type DevOverview = {
  totals: {
    apiKeys: number
    webhooks: number
    activeWorkflows: number
    connectedIntegrations: number
  }
  recentDeliveries: Array<{
    id: string
    event: string
    status: string
    responseCode: number | null
    createdAt: string
    endpoint?: { schoolId: string; url: string }
  }>
}

function SuperAdminDeveloperPage({ user }: { user: AuthUser }) {
  const [data, setData] = useState<DevOverview | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    apiGet<DevOverview>('/api/platform/developer').then(setData).catch((e) => setError(e.message))
  }, [])

  return (
    <AppLayout user={user} title="Developer Platform">
      <p className="mb-6 text-sm text-gray-600">
        Cross-tenant view of API keys, webhooks, automations, and integration connections across all schools.
      </p>
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      {!data && !error && <p className="text-sm text-gray-500">Loading…</p>}

      {data && (
        <div className="space-y-8">
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ['API keys', data.totals.apiKeys],
              ['Webhooks', data.totals.webhooks],
              ['Active workflows', data.totals.activeWorkflows],
              ['Connected integrations', data.totals.connectedIntegrations],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-lg border bg-white p-4 shadow-sm">
                <p className="text-sm text-gray-500">{label}</p>
                <p className="text-2xl font-semibold">{value}</p>
              </div>
            ))}
          </section>

          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase text-gray-500">Recent webhook deliveries</h2>
            {data.recentDeliveries.length === 0 ? (
              <p className="text-sm text-gray-500">No deliveries yet.</p>
            ) : (
              <ul className="space-y-2">
                {data.recentDeliveries.map((d) => (
                  <li key={d.id} className="rounded border bg-white p-3 text-sm">
                    <span className="font-medium">{d.event}</span>
                    <span className={`ml-2 rounded px-1.5 py-0.5 text-xs ${d.status === 'delivered' ? 'bg-green-100 text-green-800' : 'bg-gray-100'}`}>
                      {d.status}
                    </span>
                    <p className="mt-1 text-gray-500 truncate">{d.endpoint?.url}</p>
                    <p className="text-xs text-gray-400">{new Date(d.createdAt).toLocaleString()} · HTTP {d.responseCode ?? '—'}</p>
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

export default withAuth(SuperAdminDeveloperPage, { roles: ['SuperAdmin'] })
