import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useMemo, useState } from 'react'
import AppLayout from '../../../components/layout/AppLayout'
import { withAuth } from '../../../components/withAuth'
import { apiGet, apiPost } from '../../../lib/api'
import { fetchWithAuth } from '../../../lib/auth'
import type { AuthUser } from '../../../lib/useAuth'

type Lesson = {
  id: string
  title: string
  type: string
  content?: string | null
  resourceUrl?: string | null
  completed?: boolean
}
type Module = { id: string; title: string; lessons: Lesson[] }
type Assignment = {
  id: string
  title: string
  description?: string | null
  submissions?: { id: string; textAnswer?: string | null; grade?: number | null }[]
}
type Discussion = {
  id: string
  body: string
  createdAt: string
  user: { firstName: string; lastName: string; role?: { name: string } }
  replies?: Discussion[]
}
type Certificate = { id: string; certificateNumber: string; verifyCode: string }
type CourseDetail = {
  id: string
  title: string
  description?: string | null
  modules: Module[]
  enrollment?: { progressPercent: number }
  certificate?: Certificate | null
}

function youtubeEmbed(url?: string | null) {
  if (!url) return null
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/)
  return match ? `https://www.youtube.com/embed/${match[1]}` : url
}

function StudentCoursePage({ user }: { user: AuthUser }) {
  const router = useRouter()
  const courseId = String(router.query.id || '')
  const [course, setCourse] = useState<CourseDetail | null>(null)
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [discussions, setDiscussions] = useState<Discussion[]>([])
  const [activeLessonId, setActiveLessonId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [discussionBody, setDiscussionBody] = useState('')
  const [assignmentAnswers, setAssignmentAnswers] = useState<Record<string, string>>({})

  const allLessons = useMemo(
    () => course?.modules.flatMap((m) => m.lessons.map((l) => ({ ...l, moduleTitle: m.title }))) || [],
    [course]
  )
  const activeLesson = allLessons.find((l) => l.id === activeLessonId) || allLessons[0]

  async function load() {
    if (!courseId) return
    try {
      await apiPost(`/api/lms/courses/${courseId}/enroll`, {})
      const [c, a, d] = await Promise.all([
        apiGet<CourseDetail>(`/api/lms/courses/${courseId}`),
        apiGet<Assignment[]>(`/api/lms/courses/${courseId}/assignments`),
        apiGet<Discussion[]>(`/api/lms/courses/${courseId}/discussions`),
      ])
      setCourse(c)
      setAssignments(a)
      setDiscussions(d)
      const first = c.modules[0]?.lessons[0]?.id
      if (first) setActiveLessonId(first)
    } catch {
      setMessage('Failed to load course')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [courseId])

  async function markComplete() {
    if (!activeLesson) return
    try {
      const result = await apiPost(`/api/lms/lessons/${activeLesson.id}/progress`, { completed: true })
      setMessage(result.certificate ? 'Course completed! Certificate issued.' : 'Lesson marked complete.')
      load()
    } catch {
      setMessage('Could not update progress')
    }
  }

  async function postDiscussion(e: React.FormEvent) {
    e.preventDefault()
    if (!discussionBody.trim()) return
    await apiPost(`/api/lms/courses/${courseId}/discussions`, { body: discussionBody })
    setDiscussionBody('')
    const d = await apiGet<Discussion[]>(`/api/lms/courses/${courseId}/discussions`)
    setDiscussions(d)
  }

  async function submitAssignment(assignmentId: string) {
    await apiPost(`/api/lms/assignments/${assignmentId}/submit`, {
      textAnswer: assignmentAnswers[assignmentId] || '',
    })
    setMessage('Assignment submitted')
    load()
  }

  async function downloadCertificate() {
    if (!course?.certificate) return
    const res = await fetchWithAuth(`/api/lms/certificates/${course.certificate.id}/pdf`)
    if (!res.ok) return
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `certificate-${course.certificate.certificateNumber}.pdf`
    a.click()
    URL.revokeObjectURL(url)
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
        <p className="text-red-600">{message || 'Course not found'}</p>
      </AppLayout>
    )
  }

  return (
    <AppLayout user={user} title={course.title}>
      <div className="mx-auto max-w-6xl space-y-6">
        <Link href="/student/courses" className="text-sm text-slate-500 hover:text-school-navy">← My courses</Link>

        {message && <div className="rounded-xl bg-green-50 px-4 py-3 text-sm text-green-800">{message}</div>}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold text-school-navy">{course.title}</h1>
            <p className="text-sm text-slate-500">{course.enrollment?.progressPercent ?? 0}% complete</p>
          </div>
          {course.certificate && (
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" onClick={downloadCertificate} className="btn-gold text-sm">
                Download certificate
              </button>
              <Link
                href={`/verify-certificate?code=${course.certificate.verifyCode}`}
                className="text-sm text-school-navy underline"
              >
                Verification link
              </Link>
            </div>
          )}
        </div>

        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          <aside className="content-card p-4">
            <h2 className="mb-3 text-sm font-semibold text-school-navy">Curriculum</h2>
            <div className="space-y-4">
              {course.modules.map((mod) => (
                <div key={mod.id}>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{mod.title}</p>
                  <ul className="mt-2 space-y-1">
                    {mod.lessons.map((lesson) => (
                      <li key={lesson.id}>
                        <button
                          type="button"
                          onClick={() => setActiveLessonId(lesson.id)}
                          className={`w-full rounded-lg px-3 py-2 text-left text-sm ${
                            activeLesson?.id === lesson.id ? 'bg-school-navy text-white' : 'hover:bg-slate-50'
                          }`}
                        >
                          {lesson.completed ? '✓ ' : ''}{lesson.title}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </aside>

          <main className="space-y-6">
            {activeLesson && (
              <div className="content-card p-6">
                <p className="text-xs uppercase text-slate-400">{activeLesson.moduleTitle}</p>
                <h2 className="mt-1 text-xl font-semibold text-school-navy">{activeLesson.title}</h2>

                {activeLesson.type === 'video' && activeLesson.resourceUrl && (
                  <div className="mt-4 aspect-video overflow-hidden rounded-xl bg-black">
                    <iframe
                      title={activeLesson.title}
                      src={youtubeEmbed(activeLesson.resourceUrl) || ''}
                      className="h-full w-full"
                      allowFullScreen
                    />
                  </div>
                )}

                {activeLesson.type === 'pdf' && activeLesson.resourceUrl && (
                  <a
                    href={activeLesson.resourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 inline-block text-school-navy underline"
                  >
                    Open PDF resource
                  </a>
                )}

                {activeLesson.content && (
                  <p className="mt-4 whitespace-pre-wrap text-slate-700">{activeLesson.content}</p>
                )}

                {!activeLesson.completed && (
                  <button type="button" onClick={markComplete} className="btn-gold mt-6">
                    Mark lesson complete
                  </button>
                )}
              </div>
            )}

            <div className="content-card p-6">
              <h3 className="font-semibold text-school-navy">Assignments</h3>
              <div className="mt-4 space-y-4">
                {assignments.map((a) => (
                  <div key={a.id} className="rounded-lg border border-slate-100 p-4">
                    <p className="font-medium">{a.title}</p>
                    <p className="text-sm text-slate-500">{a.description}</p>
                    {a.submissions?.[0]?.grade != null ? (
                      <p className="mt-2 text-sm text-green-700">Graded: {a.submissions[0].grade}</p>
                    ) : (
                      <>
                        <textarea
                          className="mt-3 w-full"
                          rows={3}
                          placeholder="Your answer"
                          value={assignmentAnswers[a.id] || a.submissions?.[0]?.textAnswer || ''}
                          onChange={(e) => setAssignmentAnswers({ ...assignmentAnswers, [a.id]: e.target.value })}
                        />
                        <button type="button" onClick={() => submitAssignment(a.id)} className="mt-2 text-sm text-school-navy underline">
                          Submit
                        </button>
                      </>
                    )}
                  </div>
                ))}
                {assignments.length === 0 && <p className="text-sm text-slate-500">No assignments for this course.</p>}
              </div>
            </div>

            <div className="content-card p-6">
              <h3 className="font-semibold text-school-navy">Discussion</h3>
              <form onSubmit={postDiscussion} className="mt-4 space-y-3">
                <textarea
                  value={discussionBody}
                  onChange={(e) => setDiscussionBody(e.target.value)}
                  placeholder="Ask a question or share a thought..."
                  rows={3}
                  className="w-full"
                />
                <button type="submit" className="rounded-lg bg-school-navy px-4 py-2 text-sm text-white">Post</button>
              </form>
              <div className="mt-6 space-y-4">
                {discussions.map((d) => (
                  <div key={d.id} className="rounded-lg bg-slate-50 p-4 text-sm">
                    <p className="font-medium">
                      {d.user.firstName} {d.user.lastName}
                      <span className="ml-2 text-xs text-slate-400">{d.user.role?.name}</span>
                    </p>
                    <p className="mt-1 text-slate-700">{d.body}</p>
                  </div>
                ))}
              </div>
            </div>
          </main>
        </div>
      </div>
    </AppLayout>
  )
}

export default withAuth(StudentCoursePage, { roles: ['Student'] })
