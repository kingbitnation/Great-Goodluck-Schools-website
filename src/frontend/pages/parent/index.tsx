import AppLayout from '../../components/layout/AppLayout'
import { withAuth } from '../../components/withAuth'
import type { AuthUser } from '../../lib/useAuth'

const MODULES = [
  { title: 'Children Overview', description: 'See profiles and class details for your children.' },
  { title: 'Results', description: 'Track academic performance and report cards.' },
  { title: 'Fees', description: 'View outstanding fees and payment history.' },
  { title: 'Messages', description: 'Communicate with teachers and school admin.' },
]

function ParentPage({ user }: { user: AuthUser }) {
  return (
    <AppLayout user={user} title="Parent Portal">
      <p className="mb-6 text-gray-600">
        Monitor your children&apos;s progress at {user.schoolName || 'school'}.
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

export default withAuth(ParentPage, { roles: ['Parent'] })
