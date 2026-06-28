import { useEffect, useState } from 'react'
import AppLayout from '../../components/layout/AppLayout'
import StatCard from '../../components/ui/StatCard'
import { withAuth } from '../../components/withAuth'
import { apiGet } from '../../lib/api'
import type { AuthUser } from '../../lib/useAuth'

type UsageReport = {
  totals: {
    apiRequests: number
    aiRequests: number
    smsSent: number
    emailsSent: number
    logins: number
    storageBytes: number
  }
  aiCredits?: { balance: number; monthlyGrant: number; usedThisMonth: number }
  limits: Record<string, unknown>
}

function UsagePage({ user }: { user: AuthUser }) {
  const [data, setData] = useState<UsageReport | null>(null)
  const schoolId = user.schoolId

  useEffect(() => {
    if (!schoolId) return
    apiGet<UsageReport>(`/api/schools/${schoolId}/usage?days=30`).then(setData)
  }, [schoolId])

  const storageMb = data ? Math.round(data.totals.storageBytes / (1024 * 1024)) : 0

  return (
    <AppLayout user={user} title="Usage Analytics">
      <p className="mb-6 text-sm text-gray-600">Resource usage for the last 30 days.</p>
      {!data && <p className="text-sm text-gray-500">Loading…</p>}
      {data && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard label="API requests" value={data.totals.apiRequests} />
          <StatCard label="AI requests" value={data.totals.aiRequests} />
          <StatCard label="SMS sent" value={data.totals.smsSent} />
          <StatCard label="Emails sent" value={data.totals.emailsSent} />
          <StatCard label="Logins" value={data.totals.logins} />
          <StatCard label="Storage (MB)" value={storageMb} hint={`Limit: ${data.limits.storageGb ?? '—'} GB`} />
          {data.aiCredits && (
            <StatCard label="AI credits remaining" value={data.aiCredits.balance}
              hint={`${data.aiCredits.usedThisMonth} used of ${data.aiCredits.monthlyGrant} this month`} />
          )}
        </div>
      )}
    </AppLayout>
  )
}

export default withAuth(UsagePage, { roles: ['SchoolAdmin', 'SuperAdmin'] })
