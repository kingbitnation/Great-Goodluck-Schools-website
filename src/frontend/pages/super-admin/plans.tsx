import { useEffect, useState } from 'react'
import AppLayout from '../../components/layout/AppLayout'
import { withAuth } from '../../components/withAuth'
import { apiGet, apiPut } from '../../lib/api'
import type { AuthUser } from '../../lib/useAuth'

type Plan = {
  id: string
  name: string
  slug: string
  price: number
  quarterlyPrice?: number | null
  yearlyPrice?: number | null
  trialDays: number
  graceDays: number
  sortOrder: number
  isActive: boolean
  limits: Record<string, unknown>
}

function PlansPage({ user }: { user: AuthUser }) {
  const [plans, setPlans] = useState<Plan[]>([])
  const [editing, setEditing] = useState<Plan | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  function load() {
    apiGet<Plan[]>('/api/platform/plans').then(setPlans).catch((e) => setError(e.message))
  }

  useEffect(() => { load() }, [])

  async function save() {
    if (!editing) return
    setSaving(true)
    setError(null)
    try {
      await apiPut(`/api/platform/plans/${editing.id}`, {
        name: editing.name,
        price: editing.price,
        quarterlyPrice: editing.quarterlyPrice,
        yearlyPrice: editing.yearlyPrice,
        trialDays: editing.trialDays,
        graceDays: editing.graceDays,
        isActive: editing.isActive,
        limits: editing.limits,
      })
      setEditing(null)
      load()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <AppLayout user={user} title="Subscription Plans">
      <p className="mb-6 text-sm text-gray-600">
        Edit plan pricing and limits without redeploying. Changes apply to new subscriptions immediately.
      </p>
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <div className="grid gap-4 lg:grid-cols-2">
        {plans.map((plan) => (
          <article key={plan.id} className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="font-semibold text-gray-900">{plan.name}</h2>
                <p className="text-xs text-gray-500">{plan.slug}</p>
              </div>
              <span className={`rounded-full px-2 py-0.5 text-xs ${plan.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                {plan.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
              <div><dt className="text-gray-500">Monthly</dt><dd className="font-medium">₦{plan.price.toLocaleString()}</dd></div>
              <div><dt className="text-gray-500">Yearly</dt><dd className="font-medium">{plan.yearlyPrice ? `₦${plan.yearlyPrice.toLocaleString()}` : '—'}</dd></div>
              <div><dt className="text-gray-500">Max students</dt><dd>{plan.limits?.maxStudents != null ? String(plan.limits.maxStudents) : 'Unlimited'}</dd></div>
              <div><dt className="text-gray-500">AI credits/mo</dt><dd>{String(plan.limits?.aiCredits ?? 0)}</dd></div>
            </dl>
            <button
              type="button"
              onClick={() => setEditing({ ...plan })}
              className="mt-4 rounded-lg border border-gray-200 px-3 py-2 text-sm hover:bg-gray-50"
            >
              Edit plan
            </button>
          </article>
        ))}
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold">Edit {editing.name}</h3>
            <div className="mt-4 space-y-3">
              <label className="block text-sm">
                <span className="text-gray-600">Monthly price (NGN)</span>
                <input type="number" className="mt-1 w-full rounded border px-3 py-2" value={editing.price}
                  onChange={(e) => setEditing({ ...editing, price: Number(e.target.value) })} />
              </label>
              <label className="block text-sm">
                <span className="text-gray-600">Yearly price (NGN)</span>
                <input type="number" className="mt-1 w-full rounded border px-3 py-2" value={editing.yearlyPrice ?? ''}
                  onChange={(e) => setEditing({ ...editing, yearlyPrice: e.target.value ? Number(e.target.value) : null })} />
              </label>
              <label className="block text-sm">
                <span className="text-gray-600">Max students</span>
                <input type="number" className="mt-1 w-full rounded border px-3 py-2"
                  value={editing.limits?.maxStudents != null ? String(editing.limits.maxStudents) : ''}
                  onChange={(e) => setEditing({
                    ...editing,
                    limits: { ...editing.limits, maxStudents: e.target.value ? Number(e.target.value) : null },
                  })} />
              </label>
              <label className="block text-sm">
                <span className="text-gray-600">AI credits / month</span>
                <input type="number" className="mt-1 w-full rounded border px-3 py-2"
                  value={String(editing.limits?.aiCredits ?? 0)}
                  onChange={(e) => setEditing({
                    ...editing,
                    limits: { ...editing.limits, aiCredits: Number(e.target.value) },
                  })} />
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={editing.isActive}
                  onChange={(e) => setEditing({ ...editing, isActive: e.target.checked })} />
                Plan active
              </label>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={() => setEditing(null)} className="rounded-lg px-4 py-2 text-sm">Cancel</button>
              <button type="button" onClick={save} disabled={saving}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50">
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  )
}

export default withAuth(PlansPage, { roles: ['SuperAdmin'] })
