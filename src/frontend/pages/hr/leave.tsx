import Link from 'next/link'
import { useEffect, useState } from 'react'
import AppLayout from '../../components/layout/AppLayout'
import { withAuth } from '../../components/withAuth'
import { apiGet, apiPost } from '../../lib/api'
import type { AuthUser } from '../../lib/useAuth'

type Leave = {
  id: string
  leaveType: string
  startDate: string
  endDate: string
  status: string
  reason?: string
  employee: { firstName: string; lastName: string; jobTitle: string }
}

function HrLeavePage({ user }: { user: AuthUser }) {
  const [requests, setRequests] = useState<Leave[]>([])

  function load() {
    apiGet<Leave[]>('/api/hr/leave?status=pending').then(setRequests)
  }

  useEffect(() => { load() }, [])

  async function review(id: string, status: 'approved' | 'rejected') {
    await apiPost(`/api/hr/leave/${id}/review`, { status })
    load()
  }

  return (
    <AppLayout user={user} title="Leave Management">
      <div className="mx-auto max-w-4xl space-y-6 p-8">
        <Link href="/hr" className="text-sm text-slate-500 hover:text-school-navy">← HR</Link>
        <h1 className="text-2xl font-bold">Pending leave requests</h1>

        {requests.length === 0 ? (
          <p className="text-slate-600">No pending requests.</p>
        ) : (
          <div className="space-y-4">
            {requests.map((r) => (
              <div key={r.id} className="content-card p-4">
                <p className="font-semibold">{r.employee.firstName} {r.employee.lastName} — {r.employee.jobTitle}</p>
                <p className="text-sm capitalize text-slate-600">{r.leaveType} · {new Date(r.startDate).toLocaleDateString()} – {new Date(r.endDate).toLocaleDateString()}</p>
                {r.reason && <p className="mt-2 text-sm">{r.reason}</p>}
                <div className="mt-3 flex gap-2">
                  <button type="button" onClick={() => review(r.id, 'approved')} className="rounded bg-green-600 px-3 py-1 text-sm text-white">Approve</button>
                  <button type="button" onClick={() => review(r.id, 'rejected')} className="rounded bg-red-600 px-3 py-1 text-sm text-white">Reject</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  )
}

export default withAuth(HrLeavePage, { roles: ['SuperAdmin', 'SchoolAdmin', 'HRManager'] })
