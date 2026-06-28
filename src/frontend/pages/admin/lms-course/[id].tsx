import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import AppLayout from '../../../components/layout/AppLayout'
import { withAuth } from '../../../components/withAuth'
import { apiDelete, apiGet, apiPost, apiPut } from '../../../lib/api'
import type { AuthUser } from '../../../lib/useAuth'

type Lesson = { id: string; title: string; type: string; resourceUrl?: string | null; content?: string | null }
type Module = { id: string; title: string; description?: string | null; lessons: Lesson[] }
type Assignment = {
  id: string
  title: string
  description?: string | null
  dueDate?: string | null
  submissions?: {
    id: string
    textAnswer?: string | null
    grade?: number | null
    feedback?: string | null
    student: { user: { firstName: string; lastName: string } }
  }[]
}
type Course = {
  id: string
  title: string
  description?: string | null
  published: boolean
  modules: Module[]
}

function AdminLmsCoursePage({ user }: { user: AuthUser }) {
  const router = useRouter()
  const courseId = String(router.query.id || '')
  const [course, setCourse] = useState<Course | null>(null)
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [moduleForm, setModuleForm] = useState({ title: '', description: '' })
  const [lessonForm, setLessonForm] = useState({
    moduleId: '',
    title: '',
    type: 'text',
    content: '',
    resourceUrl: '',
  })
  const [assignmentForm, setAssignmentForm] = useState({ title: '', description: '' })
  const [gradeDraft, setGradeDraft] = useState<Record<string, { grade: string; feedback: string }>>({})

  async function load() {
    if (!courseId) return
    try {
      const [c, a] = await Promise.all([
        apiGet<Course>(`/api/lms/courses/${courseId}`),
        apiGet<Assignment[]>(`/api/lms/courses/${courseId}/assignments`),
      ])
      setCourse(c)
      setAssignments(a)
    } catch {
      setError('Failed to load course')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [courseId])

  async function addModule(e: React.FormEvent) {
    e.preventDefault()
    await apiPost(`/api/lms/courses/${courseId}/modules`, moduleForm)
    setModuleForm({ title: '', description: '' })
    load()
  }

  async function addLesson(e: React.FormEvent) {
    e.preventDefault()
    if (!lessonForm.moduleId) return
    await apiPost(`/api/lms/modules/${lessonForm.moduleId}/lessons`, lessonForm)
    setLessonForm({ moduleId: '', title: '', type: 'text', content: '', resourceUrl: '' })
    load()
  }

  async function addAssignment(e: React.FormEvent) {
    e.preventDefault()
    await apiPost(`/api/lms/courses/${courseId}/assignments`, assignmentForm)
    setAssignmentForm({ title: '', description: '' })
    load()
  }

  async function togglePublish() {
    if (!course) return
    await apiPut(`/api/lms/courses/${courseId}`, { published: !course.published })
    load()
  }

  async function removeLesson(id: string) {
    if (!confirm('Delete this lesson?')) return
    await apiDelete(`/api/lms/lessons/${id}`)
    load()
  }

  async function gradeSubmission(submissionId: string) {
    const draft = gradeDraft[submissionId]
    if (!draft?.grade) return
    await apiPut(`/api/lms/submissions/${submissionId}/grade`, {
      grade: Number(draft.grade),
      feedback: draft.feedback || null,
    })
    load()
  }

  if (loading) {
    return (
      <AppLayout user={user} title="Course">
        <p className="text-slate-500">Loading...</p>
      </AppLayout>
    )
  }

  if (!course) {
    return (
      <AppLayout user={user} title="Course">
        <p className="text-red-600">{error || 'Course not found'}</p>
      </AppLayout>
    )
  }

  return (
    <AppLayout user={user} title={course.title}>
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/admin/lms-courses" className="text-sm text-slate-500 hover:text-school-navy">← All courses</Link>
          <button type="button" onClick={togglePublish} className="btn-gold text-sm">
            {course.published ? 'Unpublish' : 'Publish'}
          </button>
        </div>

        <div className="content-card p-6">
          <h1 className="text-2xl font-bold text-school-navy">{course.title}</h1>
          <p className="mt-2 text-slate-600">{course.description || 'No description'}</p>
        </div>

        <form onSubmit={addModule} className="content-card space-y-3 p-6">
          <h2 className="font-semibold">Add module</h2>
          <input
            required
            value={moduleForm.title}
            onChange={(e) => setModuleForm({ ...moduleForm, title: e.target.value })}
            placeholder="Module title"
            className="w-full"
          />
          <input
            value={moduleForm.description}
            onChange={(e) => setModuleForm({ ...moduleForm, description: e.target.value })}
            placeholder="Description (optional)"
            className="w-full"
          />
          <button type="submit" className="rounded-lg bg-school-navy px-4 py-2 text-sm text-white">Add module</button>
        </form>

        {course.modules.map((mod) => (
          <div key={mod.id} className="content-card p-6">
            <h3 className="font-semibold text-school-navy">{mod.title}</h3>
            {mod.description && <p className="mt-1 text-sm text-slate-500">{mod.description}</p>}
            <ul className="mt-4 space-y-2">
              {mod.lessons.map((lesson) => (
                <li key={lesson.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                  <span>
                    {lesson.title}
                    <span className="ml-2 text-xs uppercase text-slate-400">{lesson.type}</span>
                  </span>
                  <button type="button" onClick={() => removeLesson(lesson.id)} className="text-red-600 hover:underline">
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}

        <form onSubmit={addLesson} className="content-card space-y-3 p-6">
          <h2 className="font-semibold">Add lesson</h2>
          <select
            required
            value={lessonForm.moduleId}
            onChange={(e) => setLessonForm({ ...lessonForm, moduleId: e.target.value })}
            className="w-full"
          >
            <option value="">Select module</option>
            {course.modules.map((m) => (
              <option key={m.id} value={m.id}>{m.title}</option>
            ))}
          </select>
          <input
            required
            value={lessonForm.title}
            onChange={(e) => setLessonForm({ ...lessonForm, title: e.target.value })}
            placeholder="Lesson title"
            className="w-full"
          />
          <select
            value={lessonForm.type}
            onChange={(e) => setLessonForm({ ...lessonForm, type: e.target.value })}
            className="w-full"
          >
            <option value="text">Text</option>
            <option value="video">Video</option>
            <option value="pdf">PDF</option>
          </select>
          <textarea
            value={lessonForm.content}
            onChange={(e) => setLessonForm({ ...lessonForm, content: e.target.value })}
            placeholder="Lesson content"
            rows={3}
            className="w-full"
          />
          <input
            value={lessonForm.resourceUrl}
            onChange={(e) => setLessonForm({ ...lessonForm, resourceUrl: e.target.value })}
            placeholder="Resource URL (video or PDF)"
            className="w-full"
          />
          <button type="submit" className="rounded-lg bg-school-navy px-4 py-2 text-sm text-white">Add lesson</button>
        </form>

        <form onSubmit={addAssignment} className="content-card space-y-3 p-6">
          <h2 className="font-semibold">Assignments</h2>
          {assignments.map((a) => (
            <div key={a.id} className="rounded-lg bg-slate-50 px-3 py-3 text-sm">
              <p className="font-medium">{a.title}</p>
              <p className="text-slate-500">{a.description}</p>
              {a.submissions && a.submissions.length > 0 && (
                <div className="mt-3 space-y-3 border-t border-slate-200 pt-3">
                  {a.submissions.map((sub) => (
                    <div key={sub.id} className="rounded-lg bg-white p-3">
                      <p className="font-medium text-school-navy">
                        {sub.student.user.firstName} {sub.student.user.lastName}
                      </p>
                      {sub.textAnswer && (
                        <p className="mt-1 whitespace-pre-wrap text-slate-600">{sub.textAnswer}</p>
                      )}
                      {sub.grade != null ? (
                        <p className="mt-2 text-green-700">Graded: {sub.grade}{sub.feedback ? ` — ${sub.feedback}` : ''}</p>
                      ) : (
                        <div className="mt-2 flex flex-wrap gap-2">
                          <input
                            type="number"
                            min={0}
                            placeholder="Grade"
                            className="w-24"
                            value={gradeDraft[sub.id]?.grade ?? ''}
                            onChange={(e) =>
                              setGradeDraft({
                                ...gradeDraft,
                                [sub.id]: { grade: e.target.value, feedback: gradeDraft[sub.id]?.feedback ?? '' },
                              })
                            }
                          />
                          <input
                            placeholder="Feedback (optional)"
                            className="min-w-[12rem] flex-1"
                            value={gradeDraft[sub.id]?.feedback ?? ''}
                            onChange={(e) =>
                              setGradeDraft({
                                ...gradeDraft,
                                [sub.id]: { grade: gradeDraft[sub.id]?.grade ?? '', feedback: e.target.value },
                              })
                            }
                          />
                          <button
                            type="button"
                            onClick={() => gradeSubmission(sub.id)}
                            className="rounded-lg bg-school-navy px-3 py-1 text-xs text-white"
                          >
                            Save grade
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
          <input
            required
            value={assignmentForm.title}
            onChange={(e) => setAssignmentForm({ ...assignmentForm, title: e.target.value })}
            placeholder="Assignment title"
            className="w-full"
          />
          <textarea
            value={assignmentForm.description}
            onChange={(e) => setAssignmentForm({ ...assignmentForm, description: e.target.value })}
            placeholder="Instructions"
            rows={2}
            className="w-full"
          />
          <button type="submit" className="rounded-lg bg-school-navy px-4 py-2 text-sm text-white">Add assignment</button>
        </form>
      </div>
    </AppLayout>
  )
}

export default withAuth(AdminLmsCoursePage, { roles: ['SuperAdmin', 'SchoolAdmin', 'Teacher'] })
