import Link from 'next/link'
import { useEffect, useState } from 'react'
import AppLayout from '../../components/layout/AppLayout'
import { withAuth } from '../../components/withAuth'
import { apiGet } from '../../lib/api'
import type { AuthUser } from '../../lib/useAuth'

type PayrollStats = {
  configuredEmployees: number
  salaryGrades: number
  payrollRuns: number
  lastRun: null | {
    id: string
    periodLabel: string
    status: string
    totalNet: number
  }
}

function PayrollDashboard({ user }: { user: AuthUser }) {
  const [stats, setStats] = useState<PayrollStats | null>(null)

  useEffect(() => {
    apiGet<PayrollStats>('/api/payroll/stats').then(setStats).catch(() => {})
  }, [])

  const cards = [
    { label: 'Configured employees', value: stats?.configuredEmployees ?? '—', href: '/payroll/profiles' },
    { label: 'Salary grades', value: stats?.salaryGrades ?? '—', href: '/payroll/grades' },
    { label: 'Payroll runs', value: stats?.payrollRuns ?? '—', href: '/payroll/runs' },
    { label: 'Last run status', value: stats?.lastRun?.status ?? '—', href: '/payroll/runs' },
  ]

  return (
    <AppLayout user={user} title="Payroll Dashboard">
      <div className="mx-auto max-w-6xl space-y-8 p-8">
        <h1 className="text-3xl font-bold">Payroll</h1>
        <p className="text-slate-600">Manage salary grades, employee payroll profiles, monthly runs, and payslips.</p>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((c) => (
            <Link key={c.label} href={c.href} className="content-card block p-6 hover:ring-2 hover:ring-school-gold/40">
              <p className="text-3xl font-bold text-school-navy">{c.value}</p>
              <p className="mt-1 text-sm text-slate-600">{c.label}</p>
            </Link>
          ))}
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Link href="/payroll/runs" className="content-card p-5 hover:bg-slate-50">
            <h2 className="font-semibold">Payroll runs</h2>
            <p className="mt-1 text-sm text-slate-600">Generate, approve, and mark payroll as paid.</p>
          </Link>
          <Link href="/payroll/profiles" className="content-card p-5 hover:bg-slate-50">
            <h2 className="font-semibold">Salary profiles</h2>
            <p className="mt-1 text-sm text-slate-600">Assign base salary, allowances, and deductions per employee.</p>
          </Link>
          <Link href="/payroll/grades" className="content-card p-5 hover:bg-slate-50">
            <h2 className="font-semibold">Salary grades</h2>
            <p className="mt-1 text-sm text-slate-600">Maintain reusable grade templates for compensation.</p>
          </Link>
        </div>
      </div>
    </AppLayout>
  )
}

export default withAuth(PayrollDashboard, { roles: ['SuperAdmin', 'SchoolAdmin', 'HRManager', 'Accountant'] })
