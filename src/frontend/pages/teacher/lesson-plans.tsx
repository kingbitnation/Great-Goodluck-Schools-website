import { useEffect, useState } from 'react'
import AppLayout from '../../components/layout/AppLayout'
import { AiPlanBanner, AiProviderBadge } from '../../components/AiPlanBanner'
import { withAuth } from '../../components/withAuth'
import { apiDelete, apiGet, apiPost } from '../../lib/api'
import { fetchWithAuth } from '../../lib/auth'
import type { AuthUser } from '../../lib/useAuth'

type Subject = { id: string; name: string }
type ClassRow = { id: string; name: string }
type LessonPlan = {
  id: string
  topic: string
  duration: number | null
  homework: string | null
  content: string
  subject?: { name: string }
  class?: { name: string }
  createdAt: string
}

function LessonPlansPage({ user }: { user: AuthUser }) {
  const [plans, setPlans] = useState<LessonPlan[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [classes, setClasses] = useState<ClassRow[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const [lastProvider, setLastProvider] = useState('')
  const [form, setForm] = useState({
    topic: '',
    subjectId: '',
    classId: '',
    duration: '45',
    gradeLevel: '',
  })

  useEffect(() => {
    Promise.all([
      apiGet<LessonPlan[]>('/api/ai/lesson-plans'),
      apiGet<Subject[]>('/api/subjects'),
      apiGet<ClassRow[]>('/api/classes'),
    ])
      .then(([p, s, c]) => {
        setPlans(p)
        setSubjects(s)
        setClasses(c)
        if (s.length) setForm((f) => ({ ...f, subjectId: s[0].id }))
        if (c.length) setForm((f) => ({ ...f, classId: c[0].id }))
      })
      .catch((e) => setError(e.message || 'Failed to load'))
      .finally(() => setLoading(false))
  }, [])

  async function handleGenerate() {
    if (!form.topic.trim()) {
      setError('Enter a topic')
      return
    }
    setGenerating(true)
    setError('')
    try {
      const res = await apiPost<{ plan: LessonPlan; provider: string }>('/api/ai/lesson-plans/generate', {
        ...form,
        duration: Number(form.duration),
      })
      setPlans([res.plan, ...plans])
      setLastProvider(res.provider)
      setForm((f) => ({ ...f, topic: '' }))
    } catch (e: any) {
      setError(e.message || 'Generation failed')
    } finally {
      setGenerating(false)
    }
  }

  async function handleExport(id: string) {
    const res = await fetchWithAuth(`/api/ai/lesson-plans/${id}/export`)
    if (!res.ok) return
    const blob = await res.blob()
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `lesson-plan-${id}.md`
    link.click()
    window.URL.revokeObjectURL(url)
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this lesson plan?')) return
    await apiDelete(`/api/ai/lesson-plans/${id}`)
    setPlans(plans.filter((p) => p.id !== id))
  }

  return (
    <AppLayout user={user} title="AI Lesson Plans">
      <div className="mx-auto max-w-5xl space-y-6 p-8">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold">AI Lesson Plan Generator</h1>
          <AiProviderBadge provider={lastProvider} />
        </div>
        <AiPlanBanner />

        <div className="content-card space-y-4 p-6">
          <h2 className="text-lg font-semibold">Generate new plan</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium">Topic</label>
              <input
                value={form.topic}
                onChange={(e) => setForm({ ...form, topic: e.target.value })}
                placeholder="e.g. Photosynthesis"
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
              <label className="mb-1 block text-sm font-medium">Duration (min)</label>
              <input
                type="number"
                value={form.duration}
                onChange={(e) => setForm({ ...form, duration: e.target.value })}
                className="w-full rounded border p-2"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Grade level (optional)</label>
              <input
                value={form.gradeLevel}
                onChange={(e) => setForm({ ...form, gradeLevel: e.target.value })}
                placeholder="JSS 2"
                className="w-full rounded border p-2"
              />
            </div>
          </div>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating}
            className="rounded bg-school-navy px-4 py-2 text-white hover:opacity-90 disabled:opacity-50"
          >
            {generating ? 'Generating…' : 'Generate lesson plan'}
          </button>
        </div>

        {error && <div className="rounded bg-red-50 p-4 text-red-700">{error}</div>}

        {loading ? (
          <p className="text-slate-500">Loading…</p>
        ) : plans.length === 0 ? (
          <p className="text-slate-600">No lesson plans yet.</p>
        ) : (
          <div className="space-y-4">
            {plans.map((plan) => (
              <div key={plan.id} className="content-card p-6">
                <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="text-lg font-semibold">{plan.topic}</h3>
                    <p className="text-sm text-slate-500">
                      {plan.subject?.name} · {plan.class?.name} · {plan.duration || '—'} min
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleExport(plan.id)}
                      className="text-sm text-school-navy hover:underline"
                    >
                      Export MD
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(plan.id)}
                      className="text-sm text-red-600 hover:underline"
                    >
                      Delete
                    </button>
                  </div>
                </div>
                <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded bg-slate-50 p-4 text-sm">
                  {plan.content}
                </pre>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  )
}

export default withAuth(LessonPlansPage, { roles: ['SuperAdmin', 'SchoolAdmin', 'Teacher'] })
