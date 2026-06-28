import Link from 'next/link'
import AppLayout from '../../components/layout/AppLayout'
import { withAuth } from '../../components/withAuth'
import type { AuthUser } from '../../lib/useAuth'

const MODULES = [
  { title: 'My Results', description: 'View published exam results and report cards.', href: '/student/results' },
  { title: 'My Fees', description: 'Check your school fees and payment status.', href: '/student/fees' },
  { title: 'Timetable', description: 'Check your weekly class schedule.', href: '/student/timetable' },
  { title: 'Attendance', description: 'Review your attendance record.', href: '/student/attendance' },
  { title: 'Messages', description: 'Communicate with teachers and staff.', href: '/student/messages' },
  { title: 'Notifications', description: 'View announcements and updates.', href: '/student/notifications' },
  { title: 'Library', description: 'Browse and borrow books from the school library.', href: '/student/library' },
  { title: 'Hostel', description: 'View your hostel room allocation details.', href: '/student/hostel' },
  { title: 'Transport', description: 'View your transport route and vehicle information.', href: '/student/transport' },
  { title: 'Online Tests', description: 'Take computer-based tests (CBT) online.', href: '/student/cbt' },
]

function StudentPage({ user }: { user: AuthUser }) {
  return (
    <AppLayout user={user} title="Student Portal">
      <p className="mb-6 text-gray-600">
        Welcome, {user.firstName}. Access your academic information and communications here.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {MODULES.map((mod) => (
          <Link
            key={mod.title}
            href={mod.href}
            className="rounded-lg border border-gray-200 bg-white p-5 hover:border-blue-300 hover:bg-blue-50 transition"
          >
            <h2 className="font-semibold text-gray-900">{mod.title}</h2>
            <p className="mt-2 text-sm text-gray-600">{mod.description}</p>
            <span className="mt-3 inline-block text-xs font-medium text-blue-700 bg-blue-50 px-2 py-1 rounded">
              Open {mod.title}
            </span>
          </Link>
        ))}
      </div>
    </AppLayout>
  )
}

export default withAuth(StudentPage, { roles: ['Student'] })
