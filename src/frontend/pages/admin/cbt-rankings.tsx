import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import AppLayout from '../../components/layout/AppLayout'
import { withAuth } from '../../components/withAuth'
import { apiGet } from '../../lib/api'
import type { AuthUser } from '../../lib/useAuth'

type Ranking = {
  rank: number
  studentName: string
  score: number
  grade: string
  tabSwitchCount: number
  submittedAt: string
}

function AdminCbtRankingsPage({ user }: { user: AuthUser }) {
  const router = useRouter()
  const examId = String(router.query.examId || '')
  const [rankings, setRankings] = useState<Ranking[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!examId) return
    apiGet<Ranking[]>(`/api/cbt/exams/${examId}/rankings`)
      .then(setRankings)
      .finally(() => setLoading(false))
  }, [examId])

  return (
    <AppLayout user={user} title="Exam Rankings">
      <div className="mx-auto max-w-4xl space-y-4">
        <Link href="/admin/cbt-exams" className="text-sm text-slate-500 hover:text-school-navy">← CBT Exams</Link>
        {loading ? (
          <p className="text-slate-500">Loading...</p>
        ) : rankings.length === 0 ? (
          <p className="text-slate-600">No published results yet.</p>
        ) : (
          <div className="content-card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left">Rank</th>
                  <th className="px-4 py-3 text-left">Student</th>
                  <th className="px-4 py-3 text-center">Score %</th>
                  <th className="px-4 py-3 text-center">Grade</th>
                  <th className="px-4 py-3 text-center">Tab switches</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rankings.map((r) => (
                  <tr key={r.rank}>
                    <td className="px-4 py-3 font-bold">{r.rank}</td>
                    <td className="px-4 py-3">{r.studentName}</td>
                    <td className="px-4 py-3 text-center">{r.score}%</td>
                    <td className="px-4 py-3 text-center">{r.grade}</td>
                    <td className="px-4 py-3 text-center">{r.tabSwitchCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppLayout>
  )
}

export default withAuth(AdminCbtRankingsPage, { roles: ['SuperAdmin', 'SchoolAdmin', 'Teacher'] })
