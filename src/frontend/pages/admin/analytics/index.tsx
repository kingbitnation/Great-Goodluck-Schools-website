import Link from 'next/link'
import { useEffect, useState } from 'react'
import { withAuth } from '../../../components/withAuth'
import AppLayout from '../../../components/layout/AppLayout'
import { apiGet } from '../../../lib/api'
import type { AuthUser } from '../../../lib/useAuth'

function AnalyticsHubPage({ user }: { user: AuthUser }) {
  const [summary, setSummary] = useState<{ students?: number; revenue?: number; attendance?: number } | null>(null)

  useEffect(() => {
    Promise.all([
      apiGet<{ kpis: { totalStudents: number; averageAttendance: number } }>('/api/analytics/principal').catch(() => null),
      apiGet<{ kpis: { totalRevenue: number } }>('/api/analytics/proprietor').catch(() => null),
    ]).then(([principal, proprietor]) => {
      setSummary({
        students: principal?.kpis?.totalStudents,
        attendance: principal?.kpis?.averageAttendance,
        revenue: proprietor?.kpis?.totalRevenue,
      })
    })
  }, [])

  const dashboards = [
    {
      href: '/admin/analytics/principal',
      title: 'Principal Dashboard',
      desc: 'Academic KPIs — attendance, results, class performance, and forecasts.',
      color: 'border-blue-200 hover:bg-blue-50',
    },
    {
      href: '/admin/analytics/proprietor',
      title: 'Proprietor Dashboard',
      desc: 'Financial KPIs — revenue, payroll, shop sales, donations, and forecasts.',
      color: 'border-emerald-200 hover:bg-emerald-50',
    },
  ]

  return (
    <AppLayout user={user} title="Analytics">
      <div className="p-8 max-w-5xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Analytics Hub</h1>
        <p className="text-gray-600 mb-8">Role-based dashboards with KPIs, charts, and forecasting.</p>

        {summary && (
          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-sm text-gray-500">Students</p>
              <p className="text-2xl font-bold">{summary.students ?? '—'}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-sm text-gray-500">Avg attendance</p>
              <p className="text-2xl font-bold">{summary.attendance != null ? `${summary.attendance}%` : '—'}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-sm text-gray-500">Total revenue</p>
              <p className="text-2xl font-bold">{summary.revenue != null ? `₦${summary.revenue.toLocaleString()}` : '—'}</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {dashboards.map((d) => (
            <Link key={d.href} href={d.href} className={`bg-white rounded-lg shadow p-6 border-2 transition ${d.color}`}>
              <h2 className="text-lg font-bold text-gray-900">{d.title}</h2>
              <p className="text-sm text-gray-600 mt-2">{d.desc}</p>
              <span className="inline-block mt-4 text-sm font-medium text-blue-700">Open dashboard →</span>
            </Link>
          ))}
        </div>
      </div>
    </AppLayout>
  )
}

export default withAuth(AnalyticsHubPage, { roles: ['SuperAdmin', 'SchoolAdmin'] })
