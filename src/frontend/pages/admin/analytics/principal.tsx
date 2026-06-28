import Link from 'next/link'
import { useEffect, useState } from 'react'
import { withAuth } from '../../../components/withAuth'
import AppLayout from '../../../components/layout/AppLayout'
import { KpiGrid, BarChart, ForecastPanel, GradeDistribution } from '../../../components/analytics/AnalyticsPanels'
import { apiGet } from '../../../lib/api'
import type { AuthUser } from '../../../lib/useAuth'

type PrincipalData = {
  kpis: {
    totalStudents: number
    totalTeachers: number
    totalClasses: number
    averageAttendance: number
    averageScore: number
    cbtAttempts: number
    activeLibraryLoans: number
  }
  studentsByClass: { className: string; count: number }[]
  resultsByGrade: Record<string, number>
  subjectPerformance: { subjectName: string; averageScore: number }[]
  attendanceByClass: { className: string; percentage: number }[]
  attendanceTrend: { month: string; value: number }[]
  forecasts: { attendance: { label: string; value: number }[]; performance: { label: string; value: number }[] }
}

function PrincipalAnalyticsPage({ user }: { user: AuthUser }) {
  const [data, setData] = useState<PrincipalData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiGet<PrincipalData>('/api/analytics/principal')
      .then(setData)
      .finally(() => setLoading(false))
  }, [])

  return (
    <AppLayout user={user} title="Principal Analytics">
      <div className="p-8 max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold">Principal Dashboard</h1>
            <p className="text-gray-600">Academic performance, attendance, and operational KPIs.</p>
          </div>
          <Link href="/admin/analytics" className="text-sm text-blue-600 hover:underline">← Analytics hub</Link>
        </div>

        {loading || !data ? (
          <div className="text-gray-500">Loading...</div>
        ) : (
          <>
            <KpiGrid
              items={[
                { label: 'Students', value: data.kpis.totalStudents },
                { label: 'Teachers', value: data.kpis.totalTeachers },
                { label: 'Classes', value: data.kpis.totalClasses },
                { label: 'Avg attendance', value: `${data.kpis.averageAttendance}%` },
                { label: 'Avg score', value: `${data.kpis.averageScore}%` },
                { label: 'CBT attempts', value: data.kpis.cbtAttempts },
                { label: 'Library loans', value: data.kpis.activeLibraryLoans },
              ]}
            />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
              <BarChart
                title="Students by Class"
                items={data.studentsByClass.map((c) => ({ label: c.className, value: c.count }))}
              />
              <BarChart
                title="Subject Performance"
                items={data.subjectPerformance.map((s) => ({
                  label: s.subjectName,
                  value: s.averageScore,
                  max: 100,
                }))}
                valueSuffix="%"
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
              <GradeDistribution grades={data.resultsByGrade} />
              <BarChart
                title="Attendance by Class"
                items={data.attendanceByClass.map((c) => ({
                  label: c.className,
                  value: c.percentage,
                  max: 100,
                }))}
                valueSuffix="%"
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
              <BarChart
                title="Attendance Trend"
                items={data.attendanceTrend.map((m) => ({
                  label: m.month,
                  value: m.value,
                  max: 100,
                }))}
                valueSuffix="%"
              />
              <ForecastPanel title="Attendance Forecast" items={data.forecasts.attendance} />
            </div>
          </>
        )}
      </div>
    </AppLayout>
  )
}

export default withAuth(PrincipalAnalyticsPage, { roles: ['SuperAdmin', 'SchoolAdmin'] })
