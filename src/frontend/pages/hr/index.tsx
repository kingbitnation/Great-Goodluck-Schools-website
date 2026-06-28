import Link from 'next/link'
import { useEffect, useState } from 'react'
import AppLayout from '../../components/layout/AppLayout'
import { withAuth } from '../../components/withAuth'
import { apiGet } from '../../lib/api'
import type { AuthUser } from '../../lib/useAuth'

type Stats = {
  employees: number
  openJobs: number
  pendingApplications: number
  pendingLeave: number
}

function HrDashboard({ user }: { user: AuthUser }) {
  const [stats, setStats] = useState<Stats | null>(null)

  useEffect(() => {
    apiGet<Stats>('/api/hr/stats').then(setStats).catch(() => {})
  }, [])

  const cards = [
    { label: 'Active employees', value: stats?.employees ?? '—', href: '/hr/employees' },
    { label: 'Open positions', value: stats?.openJobs ?? '—', href: '/hr/jobs' },
    { label: 'Pending applications', value: stats?.pendingApplications ?? '—', href: '/hr/applications' },
    { label: 'Leave to review', value: stats?.pendingLeave ?? '—', href: '/hr/leave' },
  ]

  return (
    <AppLayout user={user} title="HR Dashboard">
      <div className="mx-auto max-w-5xl space-y-8 p-8">
        <h1 className="text-3xl font-bold">HR Dashboard</h1>
        <p className="text-slate-600">Recruitment, employee records, contracts, leave, and performance.</p>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((c) => (
            <Link key={c.href} href={c.href} className="content-card block p-6 hover:ring-2 hover:ring-school-gold/40">
              <p className="text-3xl font-bold text-school-navy">{c.value}</p>
              <p className="mt-1 text-sm text-slate-600">{c.label}</p>
            </Link>
          ))}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Link href="/hr/jobs" className="content-card p-6 hover:bg-slate-50">
            <h2 className="font-semibold">Job postings</h2>
            <p className="mt-1 text-sm text-slate-600">Create and manage career openings on the public site.</p>
          </Link>
          <Link href="/hr/applications" className="content-card p-6 hover:bg-slate-50">
            <h2 className="font-semibold">Recruitment pipeline</h2>
            <p className="mt-1 text-sm text-slate-600">Screen applicants, schedule interviews, send offers.</p>
          </Link>
        </div>
      </div>
    </AppLayout>
  )
}

export default withAuth(HrDashboard, { roles: ['SuperAdmin', 'SchoolAdmin', 'HRManager'] })
