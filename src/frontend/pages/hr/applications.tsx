import Link from 'next/link'
import { useEffect, useState } from 'react'
import AppLayout from '../../components/layout/AppLayout'
import { withAuth } from '../../components/withAuth'
import { apiGet } from '../../lib/api'
import type { AuthUser } from '../../lib/useAuth'

type Application = {
  id: string
  referenceNo: string
  fullName: string
  email: string
  status: string
  createdAt: string
  posting: { title: string; department?: string }
}

function HrApplicationsPage({ user }: { user: AuthUser }) {
  const [apps, setApps] = useState<Application[]>([])

  useEffect(() => {
    apiGet<Application[]>('/api/hr/applications').then(setApps)
  }, [])

  return (
    <AppLayout user={user} title="Recruitment">
      <div className="mx-auto max-w-6xl space-y-6 p-8">
        <Link href="/hr" className="text-sm text-slate-500 hover:text-school-navy">← HR</Link>
        <h1 className="text-2xl font-bold">Job Applications</h1>

        <div className="content-card overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left">Reference</th>
                <th className="px-4 py-3 text-left">Candidate</th>
                <th className="px-4 py-3 text-left">Position</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {apps.map((a) => (
                <tr key={a.id}>
                  <td className="px-4 py-3 font-mono text-xs">{a.referenceNo}</td>
                  <td className="px-4 py-3">
                    <div>{a.fullName}</div>
                    <div className="text-xs text-slate-500">{a.email}</div>
                  </td>
                  <td className="px-4 py-3">{a.posting.title}</td>
                  <td className="px-4 py-3 capitalize">{a.status}</td>
                  <td className="px-4 py-3">
                    <Link href={`/hr/applications/${a.id}`} className="text-school-navy hover:underline">Review</Link>
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

export default withAuth(HrApplicationsPage, { roles: ['SuperAdmin', 'SchoolAdmin', 'HRManager'] })
