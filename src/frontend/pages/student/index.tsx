import AppLayout from '../../components/layout/AppLayout'
import { withAuth } from '../../components/withAuth'
import type { AuthUser } from '../../lib/useAuth'

const MODULES = [
  { title: 'My Results', description: 'View published exam results and report cards.' },
  { title: 'Assignments', description: 'See pending assignments and submit work.' },
  { title: 'Timetable', description: 'Check your weekly class schedule.' },
  { title: 'Attendance', description: 'Review your attendance record.' },
]

function StudentPage({ user }: { user: AuthUser }) {
  return (
    <AppLayout user={user} title="Student Portal">
      <p className="mb-6 text-gray-600">
        Welcome, {user.firstName}. Access your academic information here.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {MODULES.map((mod) => (
          <div key={mod.title} className="rounded-lg border border-gray-200 bg-white p-5">
            <h2 className="font-semibold text-gray-900">{mod.title}</h2>
            <p className="mt-2 text-sm text-gray-600">{mod.description}</p>
            <span className="mt-3 inline-block text-xs font-medium text-amber-700 bg-amber-50 px-2 py-1 rounded">
              Coming soon
            </span>
          </div>
        ))}
      </div>
    </AppLayout>
  )
}

export default withAuth(StudentPage, { roles: ['Student'] })
