import Link from 'next/link'
import { useEffect, useState } from 'react'
import AppLayout from '../../components/layout/AppLayout'
import { withAuth } from '../../components/withAuth'
import { apiGet } from '../../lib/api'
import type { AuthUser } from '../../lib/useAuth'

type Course = {
  id: string
  title: string
  description?: string | null
  published: boolean
  moduleCount?: number
  lessonCount?: number
  progressPercent?: number | null
}

export default withAuth(function StudentCoursesPage({ user }: { user: AuthUser }) {
  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    apiGet<Course[]>('/api/lms/courses')
      .then((data) => setCourses(data.filter((c) => c.published)))
      .catch(() => setError('Failed to load courses'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <AppLayout user={user} title="Learning">
      <div className="mx-auto max-w-5xl space-y-6">
        <h1 className="font-display text-2xl font-bold text-school-navy">Online Courses</h1>
        {error && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        {loading ? (
          <p className="text-slate-500">Loading courses...</p>
        ) : courses.length === 0 ? (
          <p className="text-slate-600">No courses published yet.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {courses.map((course) => (
              <Link
                key={course.id}
                href={`/student/courses/${course.id}`}
                className="content-card block p-6 transition hover:shadow-soft"
              >
                <h2 className="text-lg font-semibold text-school-navy">{course.title}</h2>
                <p className="mt-2 line-clamp-2 text-sm text-slate-600">{course.description || 'No description'}</p>
                <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
                  <span>{course.lessonCount ?? 0} lessons</span>
                  {course.progressPercent != null && (
                    <span className="font-medium text-school-gold">{course.progressPercent}% complete</span>
                  )}
                </div>
                {course.progressPercent != null && course.progressPercent > 0 && (
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-school-gold"
                      style={{ width: `${course.progressPercent}%` }}
                    />
                  </div>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  )
}, { roles: ['Student'] })
