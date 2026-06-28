import { useEffect, useState } from 'react'
import AppLayout from '../../components/layout/AppLayout'
import { withAuth } from '../../components/withAuth'
import { apiGet, apiPut } from '../../lib/api'
import type { AuthUser } from '../../lib/useAuth'

type Grade = { id: string; name: string; baseSalary: number }
type ProfileRow = {
  id: string
  employeeNo: string
  name: string
  department?: string
  jobTitle: string
  profile?: {
    gradeId?: string | null
    baseSalary: number
  } | null
}

function PayrollProfilesPage({ user }: { user: AuthUser }) {
  const [rows, setRows] = useState<ProfileRow[]>([])
  const [grades, setGrades] = useState<Grade[]>([])
  const [error, setError] = useState('')
  const [savingId, setSavingId] = useState('')

  const load = async () => {
    try {
      const [profiles, gradeRows] = await Promise.all([
        apiGet<ProfileRow[]>('/api/payroll/profiles'),
        apiGet<Grade[]>('/api/payroll/grades'),
      ])
      setRows(profiles)
      setGrades(gradeRows)
      setError('')
    } catch (err) {
      setError((err as Error).message || 'Failed to load profiles')
    }
  }

  useEffect(() => {
    load()
  }, [])

  const assignGrade = async (employeeId: string, gradeId: string) => {
    try {
      setSavingId(employeeId)
      await apiPut(`/api/payroll/profiles/${employeeId}`, { gradeId })
      await load()
    } catch (err) {
      setError((err as Error).message || 'Failed to update profile')
    } finally {
      setSavingId('')
    }
  }

  return (
    <AppLayout user={user} title="Payroll Profiles">
      <div className="mx-auto max-w-6xl space-y-6 p-8">
        <h1 className="text-3xl font-bold">Salary Profiles</h1>
        <p className="text-slate-600">Assign each employee a salary grade to include them in payroll runs.</p>
        {error && <div className="rounded border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>}

        <div className="overflow-x-auto rounded-xl border bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left">
              <tr>
                <th className="px-4 py-3">Employee</th>
                <th className="px-4 py-3">Department</th>
                <th className="px-4 py-3">Current Base</th>
                <th className="px-4 py-3">Assign Grade</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="px-4 py-3">{r.name} ({r.employeeNo})</td>
                  <td className="px-4 py-3">{r.department || '—'}</td>
                  <td className="px-4 py-3">NGN {(r.profile?.baseSalary || 0).toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <select
                      className="rounded border p-2"
                      defaultValue={r.profile?.gradeId || ''}
                      onChange={(e) => assignGrade(r.id, e.target.value)}
                      disabled={savingId === r.id}
                    >
                      <option value="">Select grade</option>
                      {grades.map((g) => (
                        <option key={g.id} value={g.id}>{g.name} (NGN {g.baseSalary.toLocaleString()})</option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppLayout>
  )
}

export default withAuth(PayrollProfilesPage, { roles: ['SuperAdmin', 'SchoolAdmin', 'HRManager', 'Accountant'] })
