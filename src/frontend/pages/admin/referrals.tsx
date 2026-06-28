import { useEffect, useState } from 'react'
import AppLayout from '../../components/layout/AppLayout'
import { withAuth } from '../../components/withAuth'
import { apiGet } from '../../lib/api'
import type { AuthUser } from '../../lib/useAuth'

type ReferralData = {
  code: string
  link: string
  conversions: number
  rewards: { days: number; aiCredits: number; smsCredits: number }
}

function ReferralsPage({ user }: { user: AuthUser }) {
  const [data, setData] = useState<ReferralData | null>(null)

  useEffect(() => {
    apiGet<ReferralData>('/api/referrals/me').then(setData)
  }, [])

  return (
    <AppLayout user={user} title="Referral Program">
      <p className="mb-6 text-sm text-gray-600">Invite other schools and earn subscription days and AI credits.</p>
      {data && (
        <div className="max-w-lg space-y-4 rounded-lg border bg-white p-6 shadow-sm">
          <div>
            <p className="text-sm text-gray-500">Your referral code</p>
            <p className="text-2xl font-bold tracking-wide">{data.code}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Share link</p>
            <input readOnly value={data.link} className="mt-1 w-full rounded border px-3 py-2 text-sm" onFocus={(e) => e.target.select()} />
          </div>
          <p className="text-sm text-gray-600">{data.conversions} schools referred</p>
          <ul className="text-sm text-gray-600">
            <li>+{data.rewards.days} days subscription per approved school</li>
            <li>+{data.rewards.aiCredits} AI credits</li>
            <li>+{data.rewards.smsCredits} SMS credits</li>
          </ul>
        </div>
      )}
    </AppLayout>
  )
}

export default withAuth(ReferralsPage, { roles: ['SchoolAdmin'] })
