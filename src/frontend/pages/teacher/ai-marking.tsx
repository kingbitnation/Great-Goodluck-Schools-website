import { useEffect, useState } from 'react'
import AppLayout from '../../components/layout/AppLayout'
import { AiPlanBanner, AiProviderBadge } from '../../components/AiPlanBanner'
import { withAuth } from '../../components/withAuth'
import { apiGet, apiPost } from '../../lib/api'
import type { AuthUser } from '../../lib/useAuth'

type Subject = { id: string; name: string }
type ClassRow = { id: string; name: string }

function AiMarkingPage({ user }: { user: AuthUser }) {
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [classes, setClasses] = useState<ClassRow[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [lastProvider, setLastProvider] = useState('')
  const [markForm, setMarkForm] = useState({
    questionText: '',
    answerText: '',
    maxMarks: '10',
    rubric: '',
  })
  const [suggestion, setSuggestion] = useState<{ suggestedMarks: number; suggestedFeedback: string } | null>(null)
  const [assignForm, setAssignForm] = useState({
    topic: '',
    subjectId: '',
    classId: '',
    totalMarks: '20',
    type: 'written',
  })
  const [assignment, setAssignment] = useState<any>(null)

  useEffect(() => {
    Promise.all([apiGet<Subject[]>('/api/subjects'), apiGet<ClassRow[]>('/api/classes')]).then(([s, c]) => {
      setSubjects(s)
      setClasses(c)
      if (s.length) setAssignForm((f) => ({ ...f, subjectId: s[0].id }))
      if (c.length) setAssignForm((f) => ({ ...f, classId: c[0].id }))
    })
  }, [])

  async function handleMarkSuggest() {
    if (!markForm.answerText.trim()) {
      setError('Paste student answer text')
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await apiPost<{ suggestion: { suggestedMarks: number; suggestedFeedback: string }; provider: string }>(
        '/api/ai/marking/suggest',
        {
          resourceType: 'manual',
          answerText: markForm.answerText,
          questionText: markForm.questionText,
          maxMarks: Number(markForm.maxMarks),
          rubric: markForm.rubric,
        }
      )
      setSuggestion(res.suggestion)
      setLastProvider(res.provider)
    } catch (e: any) {
      setError(e.message || 'Marking failed')
    } finally {
      setLoading(false)
    }
  }

  async function handleAssignGenerate() {
    if (!assignForm.topic.trim()) {
      setError('Topic required')
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await apiPost('/api/ai/assignments/generate', {
        ...assignForm,
        totalMarks: Number(assignForm.totalMarks),
      })
      setAssignment(res)
      setLastProvider(res.provider)
    } catch (e: any) {
      setError(e.message || 'Generation failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AppLayout user={user} title="AI Marking Assistant">
      <div className="mx-auto max-w-5xl space-y-8 p-8">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold">AI Marking & Assignments</h1>
          <AiProviderBadge provider={lastProvider} />
        </div>
        <AiPlanBanner />
        {error && <div className="rounded bg-red-50 p-4 text-red-700">{error}</div>}

        <section className="content-card space-y-4 p-6">
          <h2 className="text-lg font-semibold">Marking assistant</h2>
          <p className="text-sm text-slate-600">
            Paste a student answer (essay, short answer, or LMS text). AI suggests marks and feedback — you always approve final grades.
          </p>
          <div>
            <label className="mb-1 block text-sm font-medium">Question</label>
            <input
              value={markForm.questionText}
              onChange={(e) => setMarkForm({ ...markForm, questionText: e.target.value })}
              className="w-full rounded border p-2"
              placeholder="Describe the causes of erosion…"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Student answer</label>
            <textarea
              value={markForm.answerText}
              onChange={(e) => setMarkForm({ ...markForm, answerText: e.target.value })}
              rows={6}
              className="w-full rounded border p-2"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">Max marks</label>
              <input
                type="number"
                value={markForm.maxMarks}
                onChange={(e) => setMarkForm({ ...markForm, maxMarks: e.target.value })}
                className="w-full rounded border p-2"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Rubric (optional)</label>
              <input
                value={markForm.rubric}
                onChange={(e) => setMarkForm({ ...markForm, rubric: e.target.value })}
                className="w-full rounded border p-2"
              />
            </div>
          </div>
          <button
            type="button"
            onClick={handleMarkSuggest}
            disabled={loading}
            className="rounded bg-school-navy px-4 py-2 text-white disabled:opacity-50"
          >
            Suggest grade
          </button>
          {suggestion && (
            <div className="rounded-lg bg-green-50 p-4 text-sm">
              <p className="font-semibold">Suggested: {suggestion.suggestedMarks} marks</p>
              <p className="mt-2">{suggestion.suggestedFeedback}</p>
            </div>
          )}
        </section>

        <section className="content-card space-y-4 p-6">
          <h2 className="text-lg font-semibold">Assignment generator</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium">Topic</label>
              <input
                value={assignForm.topic}
                onChange={(e) => setAssignForm({ ...assignForm, topic: e.target.value })}
                className="w-full rounded border p-2"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Subject</label>
              <select
                value={assignForm.subjectId}
                onChange={(e) => setAssignForm({ ...assignForm, subjectId: e.target.value })}
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
                value={assignForm.classId}
                onChange={(e) => setAssignForm({ ...assignForm, classId: e.target.value })}
                className="w-full rounded border p-2"
              >
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>
          <button
            type="button"
            onClick={handleAssignGenerate}
            disabled={loading}
            className="rounded bg-school-navy px-4 py-2 text-white disabled:opacity-50"
          >
            Generate assignment
          </button>
          {assignment && (
            <div className="rounded-lg bg-slate-50 p-4 text-sm">
              <h3 className="font-semibold">{assignment.title}</h3>
              <p className="mt-2">{assignment.instructions}</p>
              <ul className="mt-2 list-inside list-disc">
                {(assignment.tasks || []).map((t: string, i: number) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>
    </AppLayout>
  )
}

export default withAuth(AiMarkingPage, { roles: ['SuperAdmin', 'SchoolAdmin', 'Teacher'] })
