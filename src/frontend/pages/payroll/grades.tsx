import { useEffect, useState } from 'react'
import AppLayout from '../../components/layout/AppLayout'
import { withAuth } from '../../components/withAuth'
import { apiGet, apiPost } from '../../lib/api'
import type { AuthUser } from '../../lib/useAuth'

type Grade = {
  id: string
  name: string
  baseSalary: number
  allowances?: Array<{ name: string; amount: number }>
  isActive: boolean
}

function PayrollGradesPage({ user }: { user: AuthUser }) {
  const [grades, setGrades] = useState<Grade[]>([])
  const [name, setName] = useState('')
  const [baseSalary, setBaseSalary] = useState('')
  const [error, setError] = useState('')

  const load = async () => {
    try {
      setGrades(await apiGet<Grade[]>('/api/payroll/grades'))
      setError('')
    } catch (err) {
      setError((err as Error).message || 'Failed to load grades')
    }
  }

  useEffect(() => {
    load()
  }, [])

  const create = async () => {
    if (!name || !baseSalary) return
    try {
      await apiPost('/api/payroll/grades', {
        name,
        baseSalary: Number(baseSalary),
        allowances: [],
      })
      setName('')
      setBaseSalary('')
      await load()
    } catch (err) {
      setError((err as Error).message || 'Failed to create grade')
    }
  }

  return (
    <AppLayout user={user} title="Salary Grades">
      <div className="mx-auto max-w-5xl space-y-6 p-8">
        <h1 className="text-3xl font-bold">Salary Grades</h1>
        {error && <div className="rounded border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>}

        <div className="content-card grid gap-3 p-4 sm:grid-cols-3">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Grade name" className="rounded border p-2" />
          <input value={baseSalary} onChange={(e) => setBaseSalary(e.target.value)} type="number" placeholder="Base salary" className="rounded border p-2" />
          <button type="button" onClick={create} className="rounded bg-school-navy px-4 py-2 font-medium text-white">
            Add Grade
          </button>
        </div>

        <div className="overflow-x-auto rounded-xl border bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Base Salary</th>
                <th className="px-4 py-3">Allowances</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {grades.map((g) => (
                <tr key={g.id} className="border-t">
                  <td className="px-4 py-3">{g.name}</td>
                  <td className="px-4 py-3">NGN {g.baseSalary.toLocaleString()}</td>
                  <td className="px-4 py-3">{g.allowances?.length || 0}</td>
                  <td className="px-4 py-3">{g.isActive ? 'Active' : 'Inactive'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppLayout>
  )
}

export default withAuth(PayrollGradesPage, { roles: ['SuperAdmin', 'SchoolAdmin', 'HRManager', 'Accountant'] })
