import { useEffect, useState } from 'react'
import AppLayout from '../../components/layout/AppLayout'
import { withAuth } from '../../components/withAuth'
import { apiGet, apiPatch, apiPost } from '../../lib/api'
import type { AuthUser } from '../../lib/useAuth'

type Conversion = {
  id: string
  status: string
  referredSchoolId: string
  referredSchool: { name: string; status?: string }
  createdAt: string
}

type ReferralCode = {
  id: string
  code: string
  school: { name: string }
  rewardDays: number
  rewardAiCredits: number
  rewardSmsCredits: number
  isActive: boolean
  conversions: Conversion[]
}

function SuperAdminReferralsPage({ user }: { user: AuthUser }) {
  const [codes, setCodes] = useState<ReferralCode[]>([])
  const [loading, setLoading] = useState(true)

  function load() {
    apiGet<ReferralCode[]>('/api/platform/referrals').then(setCodes).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  async function saveRewards(id: string, data: Partial<ReferralCode>) {
    await apiPatch(`/api/platform/referrals/${id}`, data)
    load()
  }

  async function rewardConversion(id: string) {
    await apiPost(`/api/platform/referrals/conversions/${id}/reward`, {})
    load()
  }

  return (
    <AppLayout user={user} title="Referral Program">
      <div className="space-y-6 p-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-school-navy">Referral program</h1>
          <p className="mt-1 text-sm text-school-muted">Manage referral codes, rewards, and conversion payouts.</p>
        </div>

        {loading ? (
          <p className="text-school-muted">Loading…</p>
        ) : codes.length === 0 ? (
          <p className="text-school-muted">No referral codes yet. School admins get codes from Referral Program.</p>
        ) : (
          codes.map((code) => (
            <div key={code.id} className="content-card space-y-4 p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="font-mono text-xl font-bold text-school-royal">{code.code}</p>
                  <p className="text-sm text-school-muted">{code.school?.name}</p>
                  <p className="mt-1 text-xs text-school-muted">{code.conversions.length} conversion(s)</p>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={code.isActive}
                    onChange={(e) => saveRewards(code.id, { isActive: e.target.checked })}
                  />
                  Active
                </label>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <label className="text-sm">
                  Reward days
                  <input
                    type="number"
                    min={0}
                    defaultValue={code.rewardDays}
                    className="mt-1 w-full"
                    onBlur={(e) => saveRewards(code.id, { rewardDays: Number(e.target.value) })}
                  />
                </label>
                <label className="text-sm">
                  AI credits
                  <input
                    type="number"
                    min={0}
                    defaultValue={code.rewardAiCredits}
                    className="mt-1 w-full"
                    onBlur={(e) => saveRewards(code.id, { rewardAiCredits: Number(e.target.value) })}
                  />
                </label>
                <label className="text-sm">
                  SMS credits
                  <input
                    type="number"
                    min={0}
                    defaultValue={code.rewardSmsCredits}
                    className="mt-1 w-full"
                    onBlur={(e) => saveRewards(code.id, { rewardSmsCredits: Number(e.target.value) })}
                  />
                </label>
              </div>

              {code.conversions.length > 0 && (
                <table className="min-w-full text-sm">
                  <thead className="text-left text-school-muted">
                    <tr><th className="pb-2">Referred school</th><th>Status</th><th>Date</th><th /></tr>
                  </thead>
                  <tbody>
                    {code.conversions.map((cv) => (
                      <tr key={cv.id} className="border-t border-school-border/50">
                        <td className="py-2">{cv.referredSchool?.name}</td>
                        <td className="capitalize">{cv.status}</td>
                        <td>{new Date(cv.createdAt).toLocaleDateString()}</td>
                        <td className="py-2 text-right">
                          {cv.status !== 'rewarded' && (
                            <button type="button" onClick={() => rewardConversion(cv.id)} className="text-school-royal hover:underline">
                              Apply reward
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ))
        )}
      </div>
    </AppLayout>
  )
}

export default withAuth(SuperAdminReferralsPage, { roles: ['SuperAdmin'] })
