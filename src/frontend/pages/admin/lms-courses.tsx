import Link from 'next/link'
import { useEffect, useState } from 'react'
import AppLayout from '../../components/layout/AppLayout'
import { withAuth } from '../../components/withAuth'
import { apiGet, apiPost } from '../../lib/api'
import type { AuthUser } from '../../lib/useAuth'

type Course = {
  id: string
  title: string
  description?: string | null
  published: boolean
  moduleCount?: number
  lessonCount?: number
}

function AdminLmsCoursesPage({ user }: { user: AuthUser }) {
  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ title: '', description: '', videoUrl: '' })

  async function loadCourses() {
    try {
      setLoading(true)
      const data = await apiGet<Course[]>('/api/lms/courses')
      setCourses(data)
    } catch {
      setError('Failed to load courses')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadCourses() }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title) return
    try {
      await apiPost('/api/lms/courses', { ...form, published: true })
      setForm({ title: '', description: '', videoUrl: '' })
      loadCourses()
    } catch {
      setError('Failed to create course')
    }
  }

  return (
    <AppLayout user={user} title="LMS Courses">
      <div className="mx-auto max-w-5xl space-y-6">
        {error && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        <form onSubmit={handleCreate} className="content-card space-y-4 p-6">
          <h2 className="font-semibold text-school-navy">Create course</h2>
          <input
            required
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Course title"
            className="w-full"
          />
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Description"
            rows={3}
            className="w-full"
          />
          <input
            value={form.videoUrl}
            onChange={(e) => setForm({ ...form, videoUrl: e.target.value })}
            placeholder="Intro video URL (optional — creates Module 1)"
            className="w-full"
          />
          <button type="submit" className="btn-gold">Publish course</button>
        </form>

        {loading ? (
          <p className="text-slate-500">Loading...</p>
        ) : (
          <div className="space-y-3">
            {courses.map((c) => (
              <div key={c.id} className="content-card flex flex-wrap items-center justify-between gap-4 p-5">
                <div>
                  <p className="font-semibold text-school-navy">{c.title}</p>
                  <p className="text-sm text-slate-500">
                    {c.moduleCount ?? 0} modules · {c.lessonCount ?? 0} lessons ·{' '}
                    <span className={c.published ? 'text-green-600' : 'text-amber-600'}>
                      {c.published ? 'Published' : 'Draft'}
                    </span>
                  </p>
                </div>
                <Link href={`/admin/lms-course/${c.id}`} className="text-sm font-medium text-school-navy hover:underline">
                  Manage content →
                </Link>
              </div>
            ))}
            {courses.length === 0 && (
              <p className="text-center text-slate-500">No courses yet. Create your first course above.</p>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  )
}

export default withAuth(AdminLmsCoursesPage, { roles: ['SuperAdmin', 'SchoolAdmin', 'Teacher'] })
