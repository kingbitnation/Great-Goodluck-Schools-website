import { useEffect, useState } from 'react'
import AppLayout from '../../components/layout/AppLayout'
import StatCard from '../../components/ui/StatCard'
import { withAuth } from '../../components/withAuth'
import { apiGet, apiPost } from '../../lib/api'
import type { AuthUser } from '../../lib/useAuth'
import Link from 'next/link'

type PlatformMetrics = {
  checkedAt: string
  schools: {
    total: number
    active: number
    trial: number
    suspended: number
    pending: number
    paymentsAwaitingReview?: number
    expiredTrials: number
    expiredSubscriptions: number
  }
  revenue: {
    monthly: number
    annual: number
    mrr: number
    arr: number
    marketplaceMonthly: number
    alumniDonationsMonthly: number
  }
  usage: {
    activeUsers: number
    newRegistrations30d: number
    dailyLogins: number
    aiSessionsMonthly: number
    emailsSentMonthly: number
    smsSentMonthly: number
  }
  subscriptions: { planBreakdown: Array<{ plan: string; status: string; count: number }> }
}

function formatNgn(n: number) {
  return `₦${Math.round(n).toLocaleString()}`
}

function PlatformDashboard({ user }: { user: AuthUser }) {
  const [data, setData] = useState<PlatformMetrics | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [resetting, setResetting] = useState(false)

  function load() {
    setLoading(true)
    apiGet<PlatformMetrics>('/api/platform/metrics')
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  async function resetPlatform() {
    if (!confirm('Delete ALL schools and billing data? Super Admin account and plans are kept. Type OK to continue.')) return
    setResetting(true)
    setError(null)
    try {
      await apiPost('/api/platform/reset-data', { confirm: 'RESET' })
      load()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Reset failed')
    } finally {
      setResetting(false)
    }
  }

  return (
    <AppLayout user={user} title="Platform Dashboard">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">SchoolPilot Platform</h1>
          <p className="text-sm text-gray-500">Business metrics and SaaS health at a glance</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/super-admin/schools" className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900 hover:bg-amber-100">Verify schools</Link>
          <Link href="/super-admin/plans" className="rounded-lg border border-gray-200 px-3 py-2 text-sm hover:bg-gray-50">Plans</Link>
          <Link href="/super-admin/billing" className="rounded-lg border border-gray-200 px-3 py-2 text-sm hover:bg-gray-50">Billing</Link>
          <Link href="/super-admin/support" className="rounded-lg border border-gray-200 px-3 py-2 text-sm hover:bg-gray-50">Support</Link>
          <Link href="/super-admin/system-health" className="rounded-lg border border-gray-200 px-3 py-2 text-sm hover:bg-gray-50">System Health</Link>
          <button type="button" onClick={resetPlatform} disabled={resetting} className="rounded-lg border border-red-200 px-3 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50">
            {resetting ? 'Resetting…' : 'Reset platform data'}
          </button>
        </div>
      </div>

      {data && (data.schools.pending > 0 || (data.schools.paymentsAwaitingReview ?? 0) > 0) && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm">
          <p className="font-semibold text-amber-900">
            {data.schools.pending} school registration{data.schools.pending === 1 ? '' : 's'} pending
            {(data.schools.paymentsAwaitingReview ?? 0) > 0 && ` · ${data.schools.paymentsAwaitingReview} payment${data.schools.paymentsAwaitingReview === 1 ? '' : 's'} awaiting review`}
          </p>
          <Link href="/super-admin/schools" className="mt-2 inline-block font-medium text-school-royal hover:underline">
            Go to Schools → Pending verification
          </Link>
        </div>
      )}

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      {loading && <p className="text-sm text-gray-500">Loading platform metrics…</p>}

      {data && (
        <>
          <section className="mb-8">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Schools</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Total schools" value={data.schools.total} />
              <StatCard label="Active" value={data.schools.active} hint="Paying or operational" />
              <StatCard label="On trial" value={data.schools.trial} />
              <StatCard label="Suspended" value={data.schools.suspended} />
              <StatCard label="Pending approval" value={data.schools.pending} hint={data.schools.paymentsAwaitingReview ? `${data.schools.paymentsAwaitingReview} payments to review` : undefined} />
              <StatCard label="Expired trials" value={data.schools.expiredTrials} />
              <StatCard label="Expired subscriptions" value={data.schools.expiredSubscriptions} />
            </div>
          </section>

          <section className="mb-8">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Revenue</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="MRR" value={formatNgn(data.revenue.mrr)} hint="Monthly recurring revenue" />
              <StatCard label="ARR" value={formatNgn(data.revenue.arr)} />
              <StatCard label="Revenue this month" value={formatNgn(data.revenue.monthly)} />
              <StatCard label="Revenue YTD" value={formatNgn(data.revenue.annual)} />
              <StatCard label="Marketplace (month)" value={formatNgn(data.revenue.marketplaceMonthly)} />
              <StatCard label="Alumni donations (month)" value={formatNgn(data.revenue.alumniDonationsMonthly)} />
            </div>
          </section>

          <section className="mb-8">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Usage</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <StatCard label="Active users" value={data.usage.activeUsers} />
              <StatCard label="New registrations (30d)" value={data.usage.newRegistrations30d} />
              <StatCard label="Logins today" value={data.usage.dailyLogins} />
              <StatCard label="AI sessions (month)" value={data.usage.aiSessionsMonthly} />
              <StatCard label="Emails sent (month)" value={data.usage.emailsSentMonthly} />
              <StatCard label="SMS sent (month)" value={data.usage.smsSentMonthly} />
            </div>
          </section>

          <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold text-gray-900">Subscriptions by plan</h2>
            {data.subscriptions.planBreakdown.length === 0 ? (
              <p className="text-sm text-gray-500">No subscription data yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-gray-500">
                      <th className="pb-2 pr-4">Plan</th>
                      <th className="pb-2 pr-4">Status</th>
                      <th className="pb-2">Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.subscriptions.planBreakdown.map((row, i) => (
                      <tr key={i} className="border-b border-gray-100">
                        <td className="py-2 pr-4 font-medium">{row.plan}</td>
                        <td className="py-2 pr-4 capitalize">{row.status}</td>
                        <td className="py-2">{row.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="mt-3 text-xs text-gray-400">
              Updated {new Date(data.checkedAt).toLocaleString()}
            </p>
          </section>
        </>
      )}
    </AppLayout>
  )
}

export default withAuth(PlatformDashboard, { roles: ['SuperAdmin'] })
