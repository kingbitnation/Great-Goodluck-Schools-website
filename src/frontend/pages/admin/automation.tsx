import { useEffect, useState } from 'react'
import AppLayout from '../../components/layout/AppLayout'
import { withAuth } from '../../components/withAuth'
import { apiDelete, apiGet, apiPatch, apiPost } from '../../lib/api'
import type { AuthUser } from '../../lib/useAuth'

type Trigger = { key: string; label: string; description: string }
type WorkflowRule = {
  id: string
  name: string
  description: string | null
  trigger: string
  conditions: { minAbsentDays?: number } | null
  actions: unknown
  isActive: boolean
  runCount: number
  lastRunAt: string | null
}

function AutomationPage({ user }: { user: AuthUser }) {
  const [rules, setRules] = useState<WorkflowRule[]>([])
  const [triggers, setTriggers] = useState<Trigger[]>([])
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [trigger, setTrigger] = useState('attendance.absent_streak')
  const [minAbsentDays, setMinAbsentDays] = useState(3)

  const load = () => {
    Promise.all([
      apiGet<{ rules: WorkflowRule[] }>('/api/developer/workflows'),
      apiGet<{ triggers: Trigger[] }>('/api/developer/workflows/triggers'),
    ])
      .then(([w, t]) => {
        setRules(w.rules)
        setTriggers(t.triggers)
        if (t.triggers[0]) setTrigger(t.triggers[0].key)
      })
      .catch((e) => setError(e.message))
  }

  useEffect(() => { load() }, [])

  async function createRule(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      await apiPost('/api/developer/workflows', {
        name: name || 'New workflow',
        trigger,
        conditions: trigger === 'attendance.absent_streak' ? { minAbsentDays } : null,
        actions: [
          {
            type: 'notify',
            title: 'School update',
            body: 'An automated attendance workflow was triggered for your child.',
            channels: ['in_app', 'email'],
          },
        ],
        isActive: true,
      })
      setName('')
      load()
    } catch (err: any) {
      setError(err.message)
    }
  }

  async function toggleActive(rule: WorkflowRule) {
    await apiPatch(`/api/developer/workflows/${rule.id}`, { isActive: !rule.isActive })
    load()
  }

  async function remove(id: string) {
    if (!confirm('Delete this workflow?')) return
    await apiDelete(`/api/developer/workflows/${id}`)
    load()
  }

  return (
    <AppLayout user={user} title="Workflow Automation">
      <p className="mb-6 text-sm text-gray-600">
        Automate follow-ups when attendance, fees, or payments change. Rules run in the background and log every execution.
      </p>
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <form onSubmit={createRule} className="mb-8 max-w-xl rounded-lg border bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold uppercase text-gray-500">Create rule</h2>
        <label className="mt-3 block text-sm">
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded border px-3 py-2" placeholder="e.g. Absence alert to parent" />
        </label>
        <label className="mt-3 block text-sm">
          Trigger
          <select value={trigger} onChange={(e) => setTrigger(e.target.value)} className="mt-1 w-full rounded border px-3 py-2">
            {triggers.map((t) => (
              <option key={t.key} value={t.key}>{t.label}</option>
            ))}
          </select>
        </label>
        {trigger === 'attendance.absent_streak' && (
          <label className="mt-3 block text-sm">
            Minimum consecutive absent days
            <input type="number" min={1} max={30} value={minAbsentDays} onChange={(e) => setMinAbsentDays(Number(e.target.value))} className="mt-1 w-full rounded border px-3 py-2" />
          </label>
        )}
        <button type="submit" className="mt-4 rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700">
          Save workflow
        </button>
      </form>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase text-gray-500">Active rules</h2>
        {rules.length === 0 && <p className="text-sm text-gray-500">No workflows yet. The seed includes a sample 3-day absence rule on demo schools.</p>}
        {rules.map((rule) => (
          <div key={rule.id} className="flex flex-wrap items-start justify-between gap-3 rounded-lg border bg-white p-4">
            <div>
              <p className="font-medium">{rule.name}</p>
              <p className="text-sm text-gray-500">{rule.trigger} · {rule.runCount} runs</p>
              {rule.conditions?.minAbsentDays != null && (
                <p className="text-xs text-gray-400">When absent ≥ {rule.conditions.minAbsentDays} days</p>
              )}
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => toggleActive(rule)} className="rounded border px-3 py-1 text-sm">
                {rule.isActive ? 'Pause' : 'Enable'}
              </button>
              <button type="button" onClick={() => remove(rule.id)} className="rounded border border-red-200 px-3 py-1 text-sm text-red-700">
                Delete
              </button>
            </div>
          </div>
        ))}
      </section>
    </AppLayout>
  )
}

export default withAuth(AutomationPage, { roles: ['SchoolAdmin'] })
