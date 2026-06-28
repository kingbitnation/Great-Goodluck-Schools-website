import Link from 'next/link'
import { useEffect, useState } from 'react'
import { withAuth } from '../../../components/withAuth'
import AppLayout from '../../../components/layout/AppLayout'
import { KpiGrid, BarChart, ForecastPanel } from '../../../components/analytics/AnalyticsPanels'
import { apiGet } from '../../../lib/api'
import type { AuthUser } from '../../../lib/useAuth'

type ProprietorData = {
  kpis: {
    totalStudents: number
    totalRevenue: number
    pendingCollection: number
    payrollSpend: number
    shopRevenue: number
    donationTotal: number
    netEstimate: number
  }
  revenueByMonth: { month: string; value: number }[]
  enrollmentByMonth: { month: string; value: number }[]
  admissionPipeline: Record<string, number>
  forecasts: { revenue: { label: string; value: number }[]; enrollment: { label: string; value: number }[] }
}

function ProprietorAnalyticsPage({ user }: { user: AuthUser }) {
  const [data, setData] = useState<ProprietorData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiGet<ProprietorData>('/api/analytics/proprietor')
      .then(setData)
      .finally(() => setLoading(false))
  }, [])

  return (
    <AppLayout user={user} title="Proprietor Analytics">
      <div className="p-8 max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold">Proprietor Dashboard</h1>
            <p className="text-gray-600">Financial overview and revenue forecasting.</p>
          </div>
          <Link href="/admin/analytics" className="text-sm text-blue-600 hover:underline">← Analytics hub</Link>
        </div>

        {loading || !data ? (
          <div className="text-gray-500">Loading...</div>
        ) : (
          <>
            <KpiGrid
              items={[
                { label: 'Total revenue', value: `₦${data.kpis.totalRevenue.toLocaleString()}` },
                { label: 'Pending collection', value: `₦${data.kpis.pendingCollection.toLocaleString()}` },
                { label: 'Payroll spend', value: `₦${data.kpis.payrollSpend.toLocaleString()}` },
                { label: 'Shop revenue', value: `₦${data.kpis.shopRevenue.toLocaleString()}` },
                { label: 'Net estimate', value: `₦${data.kpis.netEstimate.toLocaleString()}`, hint: 'Revenue + shop + donations − payroll' },
              ]}
            />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
              <BarChart
                title="Revenue by Month"
                items={data.revenueByMonth.map((m) => ({ label: m.month, value: m.value }))}
                valueSuffix=""
              />
              <BarChart
                title="New Enrollments"
                items={data.enrollmentByMonth.map((m) => ({ label: m.month, value: m.value }))}
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
              <BarChart
                title="Admission Pipeline"
                items={Object.entries(data.admissionPipeline).map(([label, value]) => ({ label, value }))}
              />
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-bold mb-4">Other Income</h2>
                <p className="text-sm text-gray-600">Alumni donations</p>
                <p className="text-3xl font-bold text-emerald-700 mt-2">₦{data.kpis.donationTotal.toLocaleString()}</p>
                <p className="text-sm text-gray-500 mt-4">Total students enrolled: {data.kpis.totalStudents}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <ForecastPanel title="Revenue Forecast (3 months)" items={data.forecasts.revenue} />
              <ForecastPanel title="Enrollment Forecast (3 months)" items={data.forecasts.enrollment} />
            </div>
          </>
        )}
      </div>
    </AppLayout>
  )
}

export default withAuth(ProprietorAnalyticsPage, { roles: ['SuperAdmin', 'SchoolAdmin'] })
