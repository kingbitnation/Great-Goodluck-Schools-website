import Link from 'next/link'
import AppLayout from '../../components/layout/AppLayout'
import { withAuth } from '../../components/withAuth'
import type { AuthUser } from '../../lib/useAuth'

const MODULES = [
  { title: 'Live Classes', description: 'Host video classes with chat, whiteboard, and attendance.', href: '/admin/live-classes' },
  { title: 'Grade Entry', description: 'Enter and manage student grades for all subjects.', href: '/teacher/grading' },
  { title: 'Mark Attendance', description: 'Record student attendance for your classes.', href: '/teacher/mark-attendance' },
  { title: 'Grade Submissions', description: 'Review and grade student assignment submissions.', href: '/teacher/submissions' },
  { title: 'View Assignments', description: 'View all assignments and student responses.', href: '/teacher/assignments' },
  { title: 'My Timetable', description: 'View your weekly teaching schedule.', href: '/teacher/timetable' },
  { title: 'Messages', description: 'Communicate with students and colleagues.', href: '/teacher/messages' },
  { title: 'Notifications', description: 'View system announcements and alerts.', href: '/teacher/notifications' },
]

function TeacherPage({ user }: { user: AuthUser }) {
  return (
    <AppLayout user={user} title="Teaching">
      <p className="mb-6 text-gray-600">
        Tools for managing your classes at {user.schoolName || 'your school'}.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {MODULES.map((mod) => (
          <Link
            key={mod.title}
            href={mod.href}
            className="rounded-lg border border-gray-200 bg-white p-5 transition hover:border-blue-300 hover:bg-blue-50"
          >
            <h2 className="font-semibold text-gray-900">{mod.title}</h2>
            <p className="mt-2 text-sm text-gray-600">{mod.description}</p>
            <p className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-blue-700">
              Open {mod.title}
            </p>
          </Link>
        ))}
      </div>
    </AppLayout>
  )
}

export default withAuth(TeacherPage, { roles: ['Teacher'] })
