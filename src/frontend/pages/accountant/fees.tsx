import { useEffect, useState } from 'react'
import AppLayout from '../../components/layout/AppLayout'
import { withAuth } from '../../components/withAuth'
import { apiGet } from '../../lib/api'
import type { AuthUser } from '../../lib/useAuth'

type Fee = {
  id: string
  name: string
  amount: number
  dueDate: string
  isActive: boolean
  _count?: { payments: number }
}

function FeesPage({ user }: { user: AuthUser }) {
  const [fees, setFees] = useState<Fee[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const qs = user.schoolId ? `?schoolId=${user.schoolId}` : ''
    apiGet<Fee[]>(`/api/fees${qs}`)
      .then(setFees)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [user.schoolId])

  return (
    <AppLayout user={user} title="Fees & Payments">
      {error && (
        <div className="mb-4 rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {loading ? (
        <p className="text-gray-500">Loading fees...</p>
      ) : fees.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center">
          <p className="text-gray-600">No fee structures configured yet.</p>
          <p className="mt-1 text-sm text-gray-400">Fee management and payment tracking coming next.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-500">
              <tr>
                <th className="px-4 py-3 font-medium">Fee</th>
                <th className="px-4 py-3 font-medium">Amount</th>
                <th className="px-4 py-3 font-medium">Due date</th>
                <th className="px-4 py-3 font-medium">Payments</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {fees.map((fee) => (
                <tr key={fee.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{fee.name}</td>
                  <td className="px-4 py-3">₦{fee.amount.toLocaleString()}</td>
                  <td className="px-4 py-3">{new Date(fee.dueDate).toLocaleDateString()}</td>
                  <td className="px-4 py-3">{fee._count?.payments ?? 0}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                      fee.isActive ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {fee.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AppLayout>
  )
}

export default withAuth(FeesPage, { roles: ['Accountant', 'SuperAdmin', 'SchoolAdmin'] })
