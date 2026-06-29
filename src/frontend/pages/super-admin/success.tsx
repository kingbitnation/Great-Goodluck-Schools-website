import { useEffect, useState } from 'react'
import AppLayout from '../../components/layout/AppLayout'
import { withAuth } from '../../components/withAuth'
import { apiGet } from '../../lib/api'
import type { AuthUser } from '../../lib/useAuth'

type SuccessData = {
  trials: { started30d: number; converted30d: number; conversionRate: number; expired: number }
  churn: { rate90d: number; cancelledTotal: number; cancelled90d: number }
  retention: { activeSubscriptions: number; estimatedLtv: number; avgMrrPerSchool: number }
  featureAdoption: Array<{ feature: string; usage: number }>
  monthlyLogins30d: number
  recommendations: string[]
}

function SuccessDashboardPage({ user }: { user: AuthUser }) {
  const [data, setData] = useState<SuccessData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    apiGet<SuccessData>('/api/platform/success-metrics').then(setData).catch((e) => setError(e.message))
  }, [])

  return (
    <AppLayout user={user} title="School Success">
      <p className="mb-6 text-sm text-gray-600">Growth KPIs — trial conversion, churn, retention, and feature adoption.</p>
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      {!data && !error && <p className="text-sm text-gray-500">Loading…</p>}

      {data && (
        <div className="space-y-8">
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Trial conversion (30d)" value={`${data.trials.conversionRate}%`} sub={`${data.trials.converted30d} / ${data.trials.started30d} trials`} />
            <Stat label="Churn rate (90d)" value={`${data.churn.rate90d}%`} sub={`${data.churn.cancelled90d} cancellations`} />
            <Stat label="Est. LTV / school" value={`₦${data.retention.estimatedLtv.toLocaleString()}`} sub={`MRR ₦${data.retention.avgMrrPerSchool.toLocaleString()}`} />
            <Stat label="Logins (30d)" value={String(data.monthlyLogins30d)} sub={`${data.retention.activeSubscriptions} active subs`} />
          </section>

          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase text-gray-500">Feature adoption (30d)</h2>
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {data.featureAdoption.map((f) => (
                <li key={f.feature} className="rounded border bg-white p-3 text-sm">
                  <span className="font-medium">{f.feature}</span>
                  <span className="ml-2 text-gray-500">{f.usage} uses</span>
                </li>
              ))}
              {data.featureAdoption.length === 0 && <li className="text-sm text-gray-500">No usage logged yet.</li>}
            </ul>
          </section>

          {data.recommendations.length > 0 && (
            <section className="rounded-lg border border-amber-200 bg-amber-50 p-4">
              <h2 className="text-sm font-semibold text-amber-900">Recommendations</h2>
              <ul className="mt-2 list-disc pl-5 text-sm text-amber-800">
                {data.recommendations.map((r) => <li key={r}>{r}</li>)}
              </ul>
            </section>
          )}
        </div>
      )}
    </AppLayout>
  )
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-lg border bg-white p-4 shadow-sm">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-2xl font-semibold">{value}</p>
      <p className="text-xs text-gray-400">{sub}</p>
    </div>
  )
}

export default withAuth(SuccessDashboardPage, { roles: ['SuperAdmin'] })
