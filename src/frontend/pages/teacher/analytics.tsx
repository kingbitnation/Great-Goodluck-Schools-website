import Link from 'next/link'
import { useEffect, useState } from 'react'
import { withAuth } from '../../components/withAuth'
import AppLayout from '../../components/layout/AppLayout'
import { KpiGrid, BarChart, ForecastPanel } from '../../components/analytics/AnalyticsPanels'
import { apiGet } from '../../lib/api'
import type { AuthUser } from '../../lib/useAuth'

type TeacherData = {
  kpis: {
    subjects: number
    classes: number
    pendingSubmissions: number
    averageScore: number
    attendanceRate: number
    upcomingLiveClasses: number
  }
  subjects: { name: string; className: string; code: string }[]
  classPerformance: { subjectName: string; averageScore: number }[]
  upcomingClasses: { id: string; title: string; scheduledAt: string | null; status: string }[]
  pendingGrading: { id: string; assignmentTitle: string; studentName: string; submittedAt: string }[]
  forecasts: { classAverage: { label: string; value: number }[] }
}

function TeacherAnalyticsPage({ user }: { user: AuthUser }) {
  const [data, setData] = useState<TeacherData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiGet<TeacherData>('/api/analytics/teacher')
      .then(setData)
      .finally(() => setLoading(false))
  }, [])

  return (
    <AppLayout user={user} title="My Analytics">
      <div className="p-8 max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Teacher Analytics</h1>
        <p className="text-gray-600 mb-8">Your classes, grading workload, and student performance.</p>

        {loading || !data ? (
          <div className="text-gray-500">Loading...</div>
        ) : (
          <>
            <KpiGrid
              items={[
                { label: 'Subjects', value: data.kpis.subjects },
                { label: 'Classes', value: data.kpis.classes },
                { label: 'Pending grading', value: data.kpis.pendingSubmissions },
                { label: 'Class avg score', value: `${data.kpis.averageScore}%` },
                { label: 'Attendance rate', value: `${data.kpis.attendanceRate}%` },
                { label: 'Upcoming live classes', value: data.kpis.upcomingLiveClasses },
              ]}
            />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
              <BarChart
                title="Performance by Subject"
                items={data.classPerformance.map((s) => ({
                  label: s.subjectName,
                  value: s.averageScore,
                  max: 100,
                }))}
                valueSuffix="%"
              />
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-bold mb-4">My Subjects</h2>
                <ul className="space-y-2">
                  {data.subjects.map((s) => (
                    <li key={`${s.code}-${s.className}`} className="flex justify-between text-sm border-b border-gray-100 pb-2">
                      <span className="font-medium">{s.name}</span>
                      <span className="text-gray-500">{s.className}</span>
                    </li>
                  ))}
                  {data.subjects.length === 0 && <p className="text-gray-500 text-sm">No subjects assigned.</p>}
                </ul>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-bold mb-4">Pending Grading</h2>
                {data.pendingGrading.length === 0 ? (
                  <p className="text-sm text-gray-500">All caught up!</p>
                ) : (
                  <ul className="space-y-3">
                    {data.pendingGrading.map((p) => (
                      <li key={p.id} className="text-sm">
                        <p className="font-medium">{p.assignmentTitle}</p>
                        <p className="text-gray-600">{p.studentName} · {new Date(p.submittedAt).toLocaleDateString()}</p>
                      </li>
                    ))}
                  </ul>
                )}
                <Link href="/teacher/submissions" className="text-sm text-blue-600 hover:underline mt-4 inline-block">Grade submissions →</Link>
              </div>
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-bold mb-4">Upcoming Live Classes</h2>
                {data.upcomingClasses.length === 0 ? (
                  <p className="text-sm text-gray-500">No upcoming sessions.</p>
                ) : (
                  <ul className="space-y-3">
                    {data.upcomingClasses.map((c) => (
                      <li key={c.id} className="text-sm">
                        <Link href={`/live-class/${c.id}`} className="font-medium text-blue-700 hover:underline">{c.title}</Link>
                        <p className="text-gray-600">{c.scheduledAt ? new Date(c.scheduledAt).toLocaleString() : 'TBD'} · {c.status}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <ForecastPanel title="Class Average Forecast" items={data.forecasts.classAverage} />
          </>
        )}
      </div>
    </AppLayout>
  )
}

export default withAuth(TeacherAnalyticsPage, { roles: ['Teacher'] })
