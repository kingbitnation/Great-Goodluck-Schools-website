import { useEffect, useState } from 'react'
import { withAuth } from '../../components/withAuth'
import AppLayout from '../../components/layout/AppLayout'
import { apiGet } from '../../lib/api'
import type { AuthUser } from '../../lib/useAuth'

type Assignment = {
  id: string
  title: string
  description?: string | null
  dueDate: string
  totalMarks: number
  class: { name: string }
  subject: { name: string }
  teacher: { user: { firstName: string; lastName: string } }
}

function TeacherAssignmentsPage({ user }: { user: AuthUser }) {
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function loadAssignments() {
      try {
        setLoading(true)
        const assignmentsData = await apiGet<Assignment[]>('/api/assignments')
        setAssignments(assignmentsData)
      } catch (err) {
        setError('Failed to load assignments')
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    loadAssignments()
  }, [])

  return (
    <AppLayout user={user} title="Assignments">
      <div className="p-8 max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Assignments</h1>
        {error && <div className="bg-red-100 text-red-700 p-4 rounded mb-4">{error}</div>}

        {loading ? (
          <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-gray-500">Loading assignments...</div>
        ) : assignments.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center text-gray-600">No assignments available.</div>
        ) : (
          <div className="grid gap-4">
            {assignments.map((assignment) => (
              <div key={assignment.id} className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">{assignment.title}</h2>
                    <p className="text-sm text-gray-600 mt-1">{assignment.subject.name} • {assignment.class.name}</p>
                    <p className="text-sm text-gray-600">Due: {new Date(assignment.dueDate).toLocaleDateString()}</p>
                  </div>
                  <div className="rounded-full bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700">
                    {assignment.totalMarks} marks
                  </div>
                </div>
                {assignment.description && <p className="mt-4 text-gray-700">{assignment.description}</p>}
                <div className="mt-4 text-sm text-gray-500">Assigned by {assignment.teacher.user.firstName} {assignment.teacher.user.lastName}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  )
}

export default withAuth(TeacherAssignmentsPage, { roles: ['Teacher'] })
