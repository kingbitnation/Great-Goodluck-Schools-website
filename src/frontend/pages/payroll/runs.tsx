import Link from 'next/link'
import { useEffect, useState } from 'react'
import AppLayout from '../../components/layout/AppLayout'
import { withAuth } from '../../components/withAuth'
import { apiGet, apiPost } from '../../lib/api'
import type { AuthUser } from '../../lib/useAuth'

type PayrollRun = {
  id: string
  periodLabel: string
  month: number
  year: number
  status: string
  totalGross: number
  totalNet: number
  totalDeductions: number
  payslipCount: number
}

function PayrollRunsPage({ user }: { user: AuthUser }) {
  const [runs, setRuns] = useState<PayrollRun[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [month, setMonth] = useState(new Date().getMonth() + 1)
  const [year, setYear] = useState(new Date().getFullYear())
  const [creating, setCreating] = useState(false)

  const loadRuns = async () => {
    try {
      setLoading(true)
      setRuns(await apiGet<PayrollRun[]>('/api/payroll/runs'))
      setError('')
    } catch (err) {
      setError((err as Error).message || 'Failed to load payroll runs')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadRuns()
  }, [])

  const createRun = async () => {
    try {
      setCreating(true)
      await apiPost('/api/payroll/runs', { month, year })
      await loadRuns()
    } catch (err) {
      setError((err as Error).message || 'Could not create payroll run')
    } finally {
      setCreating(false)
    }
  }

  const runAction = async (runId: string, action: 'approve' | 'pay') => {
    try {
      await apiPost(`/api/payroll/runs/${runId}/${action}`, {})
      await loadRuns()
    } catch (err) {
      setError((err as Error).message || `Could not ${action} run`)
    }
  }

  return (
    <AppLayout user={user} title="Payroll Runs">
      <div className="mx-auto max-w-6xl space-y-6 p-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Payroll Runs</h1>
            <p className="text-slate-600">Generate monthly payroll, approve it, and mark as paid.</p>
          </div>
          <div className="flex items-end gap-2 rounded-xl border bg-white p-3">
            <div>
              <label className="text-xs text-slate-500">Month</label>
              <input type="number" min={1} max={12} value={month} onChange={(e) => setMonth(Number(e.target.value || 1))} className="w-20 rounded border p-2 text-sm" />
            </div>
            <div>
              <label className="text-xs text-slate-500">Year</label>
              <input type="number" value={year} onChange={(e) => setYear(Number(e.target.value || new Date().getFullYear()))} className="w-24 rounded border p-2 text-sm" />
            </div>
            <button type="button" onClick={createRun} disabled={creating} className="rounded bg-school-navy px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
              {creating ? 'Creating...' : 'Create Run'}
            </button>
          </div>
        </div>

        {error && <div className="rounded border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>}

        {loading ? (
          <div className="content-card p-6">Loading payroll runs...</div>
        ) : runs.length === 0 ? (
          <div className="content-card p-6 text-slate-600">No payroll runs yet.</div>
        ) : (
          <div className="overflow-x-auto rounded-xl border bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left">
                <tr>
                  <th className="px-4 py-3">Period</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Payslips</th>
                  <th className="px-4 py-3">Net</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="px-4 py-3">
                      <Link href={`/payroll/runs/${r.id}`} className="font-medium text-school-navy hover:underline">
                        {r.periodLabel}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{r.status}</td>
                    <td className="px-4 py-3">{r.payslipCount}</td>
                    <td className="px-4 py-3">NGN {r.totalNet.toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        {r.status === 'draft' && (
                          <button type="button" onClick={() => runAction(r.id, 'approve')} className="rounded border px-2 py-1 text-xs">
                            Approve
                          </button>
                        )}
                        {r.status === 'approved' && (
                          <button type="button" onClick={() => runAction(r.id, 'pay')} className="rounded border px-2 py-1 text-xs">
                            Mark Paid
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppLayout>
  )
}

export default withAuth(PayrollRunsPage, { roles: ['SuperAdmin', 'SchoolAdmin', 'HRManager', 'Accountant'] })
