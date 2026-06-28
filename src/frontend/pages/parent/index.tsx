import Link from 'next/link'
import { useEffect, useState } from 'react'
import AppLayout from '../../components/layout/AppLayout'
import { withAuth } from '../../components/withAuth'
import { apiGet } from '../../lib/api'
import type { AuthUser } from '../../lib/useAuth'

type Child = {
  id: string
  admissionNo: string
  class: { name: string }
  user: { firstName: string; lastName: string; email: string }
}

function ParentPage({ user }: { user: AuthUser }) {
  const [children, setChildren] = useState<Child[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function loadChildren() {
      try {
        setLoading(true)
        const childrenData = await apiGet<Child[]>('/api/parents/children')
        setChildren(childrenData)
      } catch (err) {
        setError('Failed to load children data')
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    loadChildren()
  }, [])

  const modules = [
    { title: 'Academic Results', description: 'View your children\'s academic performance and grades.', href: '/parent/results' },
    { title: 'Attendance', description: 'Monitor your children\'s school attendance.', href: '/parent/attendance' },
    { title: 'Fees & Payments', description: 'View and manage school fees and payments.', href: '/parent/fees' },
    { title: 'Children', description: 'View profiles of your linked children.', href: '/parent/children' },
  ]

  return (
    <AppLayout user={user} title="Parent Portal">
      <div className="max-w-7xl mx-auto">
        <p className="mb-6 text-gray-600">
          Monitor your children&apos;s progress at {user.schoolName || 'school'}.
        </p>

        {error && (
          <div className="mb-6 rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Linked Children Summary */}
        {!loading && children.length > 0 && (
          <div className="mb-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-blue-900 mb-3">Linked Children ({children.length})</h2>
            <div className="space-y-2">
              {children.map((child) => (
                <div key={child.id} className="text-sm text-blue-800">
                  • <strong>{child.user.firstName} {child.user.lastName}</strong> - {child.class.name} (Admission: {child.admissionNo})
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Feature Modules */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {modules.map((mod) => (
            <Link
              key={mod.title}
              href={mod.href}
              className="rounded-lg border border-gray-200 bg-white p-5 transition hover:border-blue-300 hover:bg-blue-50 shadow-sm"
            >
              <h2 className="font-semibold text-gray-900">{mod.title}</h2>
              <p className="mt-2 text-sm text-gray-600">{mod.description}</p>
              <p className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-blue-700">
                Open {mod.title}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </AppLayout>
  )
}

export default withAuth(ParentPage, { roles: ['Parent'] })
