import { useEffect, useState } from 'react'
import { withAuth } from '../../components/withAuth'
import AppLayout from '../../components/layout/AppLayout'
import { apiGet } from '../../lib/api'
import type { AuthUser } from '../../lib/useAuth'

type Child = {
  id: string
  admissionNo: string
  class: { name: string }
  user: { firstName: string; lastName: string; email: string }
}

function ParentChildrenPage({ user }: { user: AuthUser }) {
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

  return (
    <AppLayout user={user} title="Children">
      <div className="p-8 max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Your Children</h1>
        {error && <div className="bg-red-100 text-red-700 p-4 rounded mb-4">{error}</div>}

        {loading ? (
          <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-gray-500">Loading children...</div>
        ) : children.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center text-gray-600">No children linked to this account.</div>
        ) : (
          <div className="space-y-4">
            {children.map((child) => (
              <div key={child.id} className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
                <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">{child.user.firstName} {child.user.lastName}</h2>
                    <p className="text-sm text-gray-600">Admission No: {child.admissionNo}</p>
                    <p className="text-sm text-gray-600">Class: {child.class.name}</p>
                    <p className="text-sm text-gray-600">Email: {child.user.email}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  )
}

export default withAuth(ParentChildrenPage, { roles: ['Parent'] })
