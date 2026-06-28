import Link from 'next/link'
import { useEffect, useState } from 'react'
import AppLayout from '../../components/layout/AppLayout'
import { AiPlanBanner, AiProviderBadge } from '../../components/AiPlanBanner'
import { withAuth } from '../../components/withAuth'
import { apiDelete, apiGet, apiPost } from '../../lib/api'
import type { AuthUser } from '../../lib/useAuth'

type Subject = { id: string; name: string }
type ClassRow = { id: string; name: string }
type GeneratedExam = {
  id: string
  title: string
  topic: string | null
  status: string
  examId: string | null
  questions: Array<{ questionText: string; marks: number }>
  subject?: { name: string }
  class?: { name: string }
  createdAt: string
}

function AiExamsPage({ user }: { user: AuthUser }) {
  const [exams, setExams] = useState<GeneratedExam[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [classes, setClasses] = useState<ClassRow[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const [lastProvider, setLastProvider] = useState('')
  const [form, setForm] = useState({
    topic: '',
    title: '',
    subjectId: '',
    classId: '',
    questionCount: '5',
    difficulty: 'medium',
  })

  useEffect(() => {
    Promise.all([
      apiGet<GeneratedExam[]>('/api/ai/exams'),
      apiGet<Subject[]>('/api/subjects'),
      apiGet<ClassRow[]>('/api/classes'),
    ])
      .then(([e, s, c]) => {
        setExams(e)
        setSubjects(s)
        setClasses(c)
        if (s.length) setForm((f) => ({ ...f, subjectId: s[0].id }))
        if (c.length) setForm((f) => ({ ...f, classId: c[0].id }))
      })
      .catch((err) => setError(err.message || 'Failed to load'))
      .finally(() => setLoading(false))
  }, [])

  async function handleGenerate() {
    if (!form.topic.trim()) {
      setError('Topic required')
      return
    }
    setGenerating(true)
    setError('')
    try {
      const res = await apiPost<{ exam: GeneratedExam; provider: string }>('/api/ai/exams/generate', {
        ...form,
        questionCount: Number(form.questionCount),
      })
      setExams([res.exam, ...exams])
      setLastProvider(res.provider)
      setForm((f) => ({ ...f, topic: '', title: '' }))
    } catch (e: any) {
      setError(e.message || 'Generation failed')
    } finally {
      setGenerating(false)
    }
  }

  async function handlePublish(id: string) {
    try {
      const res = await apiPost<{ examId: string }>(`/api/ai/exams/${id}/publish-to-cbt`, {})
      setExams(exams.map((e) => (e.id === id ? { ...e, status: 'published', examId: res.examId } : e)))
      alert(`Published to CBT. Exam ID: ${res.examId}`)
    } catch (e: any) {
      setError(e.message || 'Publish failed')
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this draft?')) return
    await apiDelete(`/api/ai/exams/${id}`)
    setExams(exams.filter((e) => e.id !== id))
  }

  return (
    <AppLayout user={user} title="AI Exam Generator">
      <div className="mx-auto max-w-5xl space-y-6 p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">AI Exam Generator</h1>
            <AiProviderBadge provider={lastProvider} />
          </div>
          <Link href="/admin/cbt-exams" className="text-sm text-school-navy hover:underline">
            CBT Exams →
          </Link>
        </div>
        <AiPlanBanner />

        <div className="content-card space-y-4 p-6">
          <h2 className="text-lg font-semibold">Generate MCQ exam draft</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">Topic</label>
              <input
                value={form.topic}
                onChange={(e) => setForm({ ...form, topic: e.target.value })}
                className="w-full rounded border p-2"
                placeholder="Quadratic equations"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Title (optional)</label>
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="w-full rounded border p-2"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Subject</label>
              <select
                value={form.subjectId}
                onChange={(e) => setForm({ ...form, subjectId: e.target.value })}
                className="w-full rounded border p-2"
              >
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Class</label>
              <select
                value={form.classId}
                onChange={(e) => setForm({ ...form, classId: e.target.value })}
                className="w-full rounded border p-2"
              >
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Questions</label>
              <input
                type="number"
                min={3}
                max={20}
                value={form.questionCount}
                onChange={(e) => setForm({ ...form, questionCount: e.target.value })}
                className="w-full rounded border p-2"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Difficulty</label>
              <select
                value={form.difficulty}
                onChange={(e) => setForm({ ...form, difficulty: e.target.value })}
                className="w-full rounded border p-2"
              >
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>
          </div>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating}
            className="rounded bg-school-navy px-4 py-2 text-white disabled:opacity-50"
          >
            {generating ? 'Generating…' : 'Generate exam'}
          </button>
        </div>

        {error && <div className="rounded bg-red-50 p-4 text-red-700">{error}</div>}

        {loading ? (
          <p className="text-slate-500">Loading…</p>
        ) : (
          <div className="space-y-4">
            {exams.map((exam) => (
              <div key={exam.id} className="content-card p-6">
                <div className="mb-3 flex flex-wrap justify-between gap-2">
                  <div>
                    <h3 className="font-semibold">{exam.title}</h3>
                    <p className="text-sm text-slate-500">
                      {exam.subject?.name} · {exam.class?.name} · {Array.isArray(exam.questions) ? exam.questions.length : 0} questions ·{' '}
                      <span className={exam.status === 'published' ? 'text-green-600' : 'text-amber-600'}>{exam.status}</span>
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {exam.status !== 'published' && (
                      <button
                        type="button"
                        onClick={() => handlePublish(exam.id)}
                        className="rounded bg-green-600 px-3 py-1 text-sm text-white"
                      >
                        Publish to CBT
                      </button>
                    )}
                    {exam.examId && (
                      <Link href="/admin/cbt-exams" className="text-sm text-school-navy hover:underline">
                        View in CBT
                      </Link>
                    )}
                    <button type="button" onClick={() => handleDelete(exam.id)} className="text-sm text-red-600">
                      Delete
                    </button>
                  </div>
                </div>
                <ul className="list-inside list-decimal text-sm text-slate-700">
                  {(Array.isArray(exam.questions) ? exam.questions : []).slice(0, 5).map((q, i) => (
                    <li key={i}>{q.questionText}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  )
}

export default withAuth(AiExamsPage, { roles: ['SuperAdmin', 'SchoolAdmin', 'Teacher'] })
