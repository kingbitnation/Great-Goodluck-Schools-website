import { useEffect, useState } from 'react'
import AppLayout from '../../components/layout/AppLayout'
import { withAuth } from '../../components/withAuth'
import { apiGet, apiPost } from '../../lib/api'
import type { AuthUser } from '../../lib/useAuth'

type Analytics = {
  summary: {
    mrr: number
    arr: number
    monthlyRevenue: number
    annualRevenue: number
    activeSchools: number
    trialSchools: number
    expiredSchools: number
    newSchools: number
    churnRate: number
    trialConversionRate: number
    pendingApprovals: number
    paymentFailures: number
    avgRevenuePerSchool: number
    customerLifetimeValue: number
  }
  revenue: { trend: Array<{ month: string; revenue: number }> }
  planDistribution: Array<{ plan: string; count: number; revenue: number }>
  topSchools: Array<{ school: string; plan: string; mrr: number }>
  pendingPayments: Array<{
    id: string
    reference: string
    amount: number
    status: string
    proofUrl?: string | null
    school?: { name: string }
    invoice?: { plan?: { name: string } }
  }>
  schools: Array<{ id: string; name: string; status: string; subscription?: { status: string; plan?: string } }>
  recentTransactions: Array<{ id: string; type: string; description: string; createdAt: string; school?: { name: string } }>
}

function StatCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="rounded-xl border border-school-border bg-white p-5 shadow-soft dark:bg-school-surface">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-2 text-2xl font-bold ${accent || 'text-school-navy dark:text-white'}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
    </div>
  )
}

function SuperAdminBillingPage({ user }: { user: AuthUser }) {
  const [data, setData] = useState<Analytics | null>(null)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<'overview' | 'payments' | 'coupons' | 'schools' | 'transactions'>('overview')
  const [couponForm, setCouponForm] = useState({
    code: '',
    description: '',
    discountType: 'percent',
    discountValue: '10',
    maxUses: '',
    validUntil: '',
  })
  const [coupons, setCoupons] = useState<Array<{ id: string; code: string; discountValue: number; discountType: string; usedCount: number; maxUses: number | null }>>([])

  function load() {
    apiGet<Analytics>('/api/platform/billing/dashboard').then((d) => {
      setData(d)
      if (d.summary.pendingApprovals > 0) setTab('payments')
    }).catch((e) => setError(e.message))
    apiGet<typeof coupons>('/api/platform/coupons').then(setCoupons).catch(() => {})
  }

  useEffect(() => { load() }, [])

  async function createCoupon(e: React.FormEvent) {
    e.preventDefault()
    await apiPost('/api/platform/coupons', {
      code: couponForm.code,
      description: couponForm.description || undefined,
      discountType: couponForm.discountType,
      discountValue: Number(couponForm.discountValue),
      maxUses: couponForm.maxUses ? Number(couponForm.maxUses) : null,
      validUntil: couponForm.validUntil || null,
    })
    setCouponForm({ code: '', description: '', discountType: 'percent', discountValue: '10', maxUses: '', validUntil: '' })
    load()
  }

  async function approvePayment(id: string) {
    await apiPost(`/api/platform/billing/payments/${id}/approve`, {})
    load()
  }

  async function rejectPayment(id: string) {
    const note = prompt('Rejection reason:')
    if (!note) return
    await apiPost(`/api/platform/billing/payments/${id}/reject`, { note })
    load()
  }

  async function reactivateSchool(schoolId: string) {
    await apiPost(`/api/platform/schools/${schoolId}/reactivate`, { extendDays: 14 })
    load()
  }

  async function suspendSchool(schoolId: string) {
    if (!confirm('Suspend this school?')) return
    await apiPost(`/api/platform/schools/${schoolId}/suspend`, { reason: 'Manual suspension' })
    load()
  }

  const s = data?.summary

  return (
    <AppLayout user={user} title="Billing Dashboard">
      <div className="space-y-8 p-6">
        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex flex-wrap gap-2 border-b border-school-border pb-4">
          {(['overview', 'payments', 'coupons', 'schools', 'transactions'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`rounded-lg px-4 py-2 text-sm font-medium capitalize ${tab === t ? 'bg-school-royal text-white' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              {t}
              {t === 'payments' && s?.pendingApprovals ? ` (${s.pendingApprovals})` : ''}
            </button>
          ))}
        </div>

        {!data && !error && <p className="text-slate-500">Loading billing analytics…</p>}

        {data && tab === 'overview' && s && (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="MRR" value={`₦${s.mrr.toLocaleString()}`} sub={`ARR ₦${s.arr.toLocaleString()}`} accent="text-school-royal" />
              <StatCard label="Monthly Revenue" value={`₦${s.monthlyRevenue.toLocaleString()}`} />
              <StatCard label="Active Schools" value={String(s.activeSchools)} sub={`${s.trialSchools} on trial`} />
              <StatCard label="Trial Conversion" value={`${s.trialConversionRate}%`} sub={`Churn ${s.churnRate}%`} />
              <StatCard label="Pending Approvals" value={String(s.pendingApprovals)} accent={s.pendingApprovals > 0 ? 'text-amber-600' : undefined} />
              <StatCard label="Avg Revenue / School" value={`₦${s.avgRevenuePerSchool.toLocaleString()}`} />
              <StatCard label="Customer LTV" value={`₦${s.customerLifetimeValue.toLocaleString()}`} />
              <StatCard label="New Schools (30d)" value={String(s.newSchools)} />
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-xl border bg-white p-6 shadow-soft dark:bg-school-surface">
                <h3 className="font-semibold text-school-navy dark:text-white">Revenue Trend (6 months)</h3>
                <div className="mt-4 flex h-40 items-end gap-2">
                  {data.revenue.trend.map((m) => {
                    const max = Math.max(...data.revenue.trend.map((x) => x.revenue), 1)
                    const h = Math.max(4, (m.revenue / max) * 100)
                    return (
                      <div key={m.month} className="flex flex-1 flex-col items-center gap-1">
                        <div className="w-full rounded-t bg-school-royal transition-all" style={{ height: `${h}%` }} title={`₦${m.revenue.toLocaleString()}`} />
                        <span className="text-[10px] text-slate-500">{m.month}</span>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="rounded-xl border bg-white p-6 shadow-soft dark:bg-school-surface">
                <h3 className="font-semibold text-school-navy dark:text-white">Plan Distribution</h3>
                <ul className="mt-4 space-y-2">
                  {data.planDistribution.map((p) => (
                    <li key={p.plan} className="flex justify-between text-sm">
                      <span>{p.plan} <span className="text-slate-400">({p.count})</span></span>
                      <span className="font-medium">₦{p.revenue.toLocaleString()}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="rounded-xl border bg-white p-6 shadow-soft dark:bg-school-surface">
              <h3 className="font-semibold">Top Schools by MRR</h3>
              <table className="mt-4 min-w-full text-sm">
                <thead><tr className="text-left text-slate-500"><th className="pb-2">School</th><th>Plan</th><th>MRR</th></tr></thead>
                <tbody>
                  {data.topSchools.map((t, i) => (
                    <tr key={i} className="border-t border-school-border/50">
                      <td className="py-2">{t.school}</td>
                      <td>{t.plan}</td>
                      <td className="font-medium">₦{t.mrr.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {data && tab === 'coupons' && (
          <div className="grid gap-8 lg:grid-cols-2">
            <form onSubmit={createCoupon} className="content-card space-y-4 p-6">
              <h3 className="font-semibold text-school-navy">Create coupon</h3>
              <input required placeholder="Code" value={couponForm.code} onChange={(e) => setCouponForm({ ...couponForm, code: e.target.value.toUpperCase() })} className="w-full" />
              <input placeholder="Description" value={couponForm.description} onChange={(e) => setCouponForm({ ...couponForm, description: e.target.value })} className="w-full" />
              <div className="grid grid-cols-2 gap-3">
                <select value={couponForm.discountType} onChange={(e) => setCouponForm({ ...couponForm, discountType: e.target.value })} className="w-full">
                  <option value="percent">Percent off</option>
                  <option value="fixed">Fixed amount (NGN)</option>
                </select>
                <input required type="number" min={1} placeholder="Value" value={couponForm.discountValue} onChange={(e) => setCouponForm({ ...couponForm, discountValue: e.target.value })} className="w-full" />
              </div>
              <input type="number" min={1} placeholder="Max uses (optional)" value={couponForm.maxUses} onChange={(e) => setCouponForm({ ...couponForm, maxUses: e.target.value })} className="w-full" />
              <input type="date" value={couponForm.validUntil} onChange={(e) => setCouponForm({ ...couponForm, validUntil: e.target.value })} className="w-full" />
              <button type="submit" className="btn-royal text-sm">Create coupon</button>
            </form>
            <div className="content-card p-6">
              <h3 className="font-semibold text-school-navy">Active coupons</h3>
              <ul className="mt-4 space-y-2 text-sm">
                {coupons.length === 0 ? (
                  <li className="text-school-muted">No coupons yet.</li>
                ) : (
                  coupons.map((c) => (
                    <li key={c.id} className="flex justify-between border-b border-school-border/50 py-2">
                      <span className="font-mono font-semibold">{c.code}</span>
                      <span className="text-school-muted">
                        {c.discountType === 'percent' ? `${c.discountValue}%` : `₦${c.discountValue}`}
                        {' · '}{c.usedCount}{c.maxUses != null ? `/${c.maxUses}` : ''} used
                      </span>
                    </li>
                  ))
                )}
              </ul>
            </div>
          </div>
        )}

        {data && tab === 'payments' && (
          <div className="space-y-3">
            <p className="text-sm text-school-muted">
              Approve bank transfers from school registrations and subscription renewals.{' '}
              <a href="/super-admin/schools" className="text-school-royal hover:underline">Schools → Pending verification</a> for full application review.
            </p>
            {data.pendingPayments.length === 0 ? (
              <p className="text-slate-500">No pending payments.</p>
            ) : (
              data.pendingPayments.map((p) => (
                <div key={p.id} className="flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-white p-4 shadow-soft">
                  <div>
                    <p className="font-medium">{p.school?.name}</p>
                    <p className="text-sm text-slate-500">{p.invoice?.plan?.name} — {p.reference}</p>
                    <p className="text-lg font-bold text-school-navy">₦{p.amount.toLocaleString()}</p>
                    {p.proofUrl && (
                      <a href={p.proofUrl} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-sm text-school-royal hover:underline">
                        View payment receipt
                      </a>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => approvePayment(p.id)} className="btn-royal text-sm py-2 px-4">Approve</button>
                    <button type="button" onClick={() => rejectPayment(p.id)} className="rounded-lg border border-red-200 px-4 py-2 text-sm text-red-600">Reject</button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {data && tab === 'schools' && (
          <div className="overflow-x-auto rounded-xl border bg-white shadow-soft">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-500">
                <tr><th className="p-3">School</th><th className="p-3">Status</th><th className="p-3">Plan</th><th className="p-3">Sub Status</th><th className="p-3">Actions</th></tr>
              </thead>
              <tbody>
                {data.schools.map((school) => (
                  <tr key={school.id} className="border-t">
                    <td className="p-3 font-medium">{school.name}</td>
                    <td className="p-3 capitalize">{school.status}</td>
                    <td className="p-3">{school.subscription?.plan || '—'}</td>
                    <td className="p-3 capitalize">{school.subscription?.status || '—'}</td>
                    <td className="p-3">
                      {school.status === 'suspended' ? (
                        <button type="button" onClick={() => reactivateSchool(school.id)} className="text-school-royal hover:underline">Reactivate</button>
                      ) : (
                        <button type="button" onClick={() => suspendSchool(school.id)} className="text-red-600 hover:underline">Suspend</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {data && tab === 'transactions' && (
          <ul className="space-y-2">
            {data.recentTransactions.map((t) => (
              <li key={t.id} className="rounded-lg border bg-white p-3 text-sm">
                <span className="font-medium capitalize">{t.type.replace(/_/g, ' ')}</span>
                <span className="text-slate-500"> — {t.school?.name}</span>
                <p className="text-slate-600">{t.description}</p>
                <p className="text-xs text-slate-400">{new Date(t.createdAt).toLocaleString()}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppLayout>
  )
}

export default withAuth(SuperAdminBillingPage, { roles: ['SuperAdmin'] })
