import Link from 'next/link'
import { useEffect, useState } from 'react'
import AppLayout from '../../components/layout/AppLayout'
import { withAuth } from '../../components/withAuth'
import { apiGet, apiPost } from '../../lib/api'
import type { AuthUser } from '../../lib/useAuth'

type Employee = {
  id: string
  employeeNo: string
  firstName: string
  lastName: string
  email: string
  jobTitle: string
  department?: string
  status: string
  _count?: { contracts: number; leaveRequests: number }
}

function HrEmployeesPage({ user }: { user: AuthUser }) {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [syncing, setSyncing] = useState(false)

  function load() {
    apiGet<Employee[]>('/api/hr/employees').then(setEmployees)
  }

  useEffect(() => { load() }, [])

  async function syncStaff() {
    setSyncing(true)
    try {
      await apiPost('/api/hr/employees/sync-staff', {})
      load()
    } finally {
      setSyncing(false)
    }
  }

  return (
    <AppLayout user={user} title="Employees">
      <div className="mx-auto max-w-6xl space-y-6 p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link href="/hr" className="text-sm text-slate-500 hover:text-school-navy">← HR</Link>
          <button type="button" onClick={syncStaff} disabled={syncing} className="rounded border px-4 py-2 text-sm">
            {syncing ? 'Syncing…' : 'Sync from teachers'}
          </button>
        </div>

        <div className="content-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left">Employee No</th>
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-left">Title</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {employees.map((e) => (
                <tr key={e.id}>
                  <td className="px-4 py-3 font-mono text-xs">{e.employeeNo}</td>
                  <td className="px-4 py-3">{e.firstName} {e.lastName}</td>
                  <td className="px-4 py-3">{e.jobTitle}</td>
                  <td className="px-4 py-3 capitalize">{e.status.replace(/_/g, ' ')}</td>
                  <td className="px-4 py-3">
                    <Link href={`/hr/employees/${e.id}`} className="text-school-navy hover:underline">Profile</Link>
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

export default withAuth(HrEmployeesPage, { roles: ['SuperAdmin', 'SchoolAdmin', 'HRManager'] })
