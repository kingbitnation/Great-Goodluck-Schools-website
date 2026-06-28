import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import AppLayout from '../../components/layout/AppLayout'
import { withAuth } from '../../components/withAuth'
import { apiGet, apiPut } from '../../lib/api'
import type { AuthUser } from '../../lib/useAuth'

type Submission = {
  id: string
  answerText?: string | null
  marksObtained?: number | null
  question: { content: string; mark: number }
  student: { user: { firstName: string; lastName: string } }
}

function AdminCbtGradingPage({ user }: { user: AuthUser }) {
  const router = useRouter()
  const examId = String(router.query.examId || '')
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [grades, setGrades] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)

  async function load() {
    if (!examId) return
    const data = await apiGet<Submission[]>(`/api/cbt/exams/${examId}/submissions`)
    setSubmissions(data)
    setLoading(false)
  }

  useEffect(() => { load() }, [examId])

  async function saveGrade(id: string, max: number) {
    const marks = Number(grades[id])
    if (Number.isNaN(marks) || marks < 0 || marks > max) return
    await apiPut(`/api/cbt/answers/${id}/grade`, { marks })
    load()
  }

  return (
    <AppLayout user={user} title="Manual Grading">
      <div className="mx-auto max-w-4xl space-y-4">
        <Link href="/admin/cbt-exams" className="text-sm text-slate-500 hover:text-school-navy">← CBT Exams</Link>
        {loading ? (
          <p className="text-slate-500">Loading...</p>
        ) : submissions.length === 0 ? (
          <p className="text-slate-600">No answers pending manual grading.</p>
        ) : (
          <div className="space-y-4">
            {submissions.map((s) => (
              <div key={s.id} className="content-card p-5">
                <p className="font-medium text-school-navy">
                  {s.student.user.firstName} {s.student.user.lastName}
                </p>
                <p className="mt-1 text-sm text-slate-600">{s.question.content}</p>
                <p className="mt-2 rounded bg-slate-50 p-3 text-sm">{s.answerText || '—'}</p>
                {s.marksObtained != null ? (
                  <p className="mt-2 text-sm text-green-700">Graded: {s.marksObtained}/{s.question.mark}</p>
                ) : (
                  <div className="mt-3 flex gap-2">
                    <input
                      type="number"
                      min={0}
                      max={s.question.mark}
                      placeholder={`0–${s.question.mark}`}
                      className="w-24"
                      value={grades[s.id] ?? ''}
                      onChange={(e) => setGrades({ ...grades, [s.id]: e.target.value })}
                    />
                    <button type="button" onClick={() => saveGrade(s.id, s.question.mark)} className="btn-gold text-sm">
                      Save
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  )
}

export default withAuth(AdminCbtGradingPage, { roles: ['SuperAdmin', 'SchoolAdmin', 'Teacher'] })
