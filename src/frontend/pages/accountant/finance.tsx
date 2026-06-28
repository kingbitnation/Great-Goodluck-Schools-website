import { useState, useEffect } from 'react'
import { withAuth } from '../../components/withAuth'
import AppLayout from '../../components/layout/AppLayout'
import { apiGet } from '../../lib/api'
import type { AuthUser } from '../../lib/useAuth'

interface FinancialReport {
  period: string
  totalFees: number
  totalFeeAmount: number
  totalPayments: number
  totalCollected: number
  pendingAmount: number
  collectionRate: string
  paymentsByGateway: Record<string, number>
}

interface Debtor {
  id: string
  studentName: string
  email: string
  class: string
  parent: string
  totalDue: number
  totalPaid: number
  debt: number
  daysOverdue: number
}

interface Payment {
  id: string
  student: { user: { firstName: string; lastName: string }; class: { name: string } }
  amount: number
  status: string
  gateway: string
  createdAt: string
}

export default withAuth(function AccountantFinancePage({ user }: { user: AuthUser }) {
  const [report, setReport] = useState<FinancialReport | null>(null)
  const [debtors, setDebtors] = useState<Debtor[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<'overview' | 'debtors' | 'payments'>('overview')
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())

  useEffect(() => {
    loadData()
  }, [selectedMonth, selectedYear])

  async function loadData() {
    try {
      setLoading(true)
      const [reportData, debtorsData, paymentsData] = await Promise.all([
        apiGet<FinancialReport>(`/api/financial-report?month=${selectedMonth}&year=${selectedYear}`),
        apiGet<Debtor[]>('/api/debtors'),
        apiGet<Payment[]>('/api/payments?status=completed'),
      ])
      setReport(reportData)
      setDebtors(debtorsData)
      setPayments(paymentsData)
    } catch (err) {
      setError('Failed to load data')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <AppLayout user={user} title="Financial Dashboard"><div className="p-8">Loading...</div></AppLayout>

  return (
    <AppLayout user={user} title="Financial Dashboard">
      <div className="p-8 max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Financial Dashboard</h1>

        {error && <div className="bg-red-100 text-red-700 p-4 rounded mb-4">{error}</div>}

        {/* Tabs */}
        <div className="flex gap-4 mb-6 border-b">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2 font-medium ${
              activeTab === 'overview'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('debtors')}
            className={`px-4 py-2 font-medium ${
              activeTab === 'debtors'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Debtors ({debtors.length})
          </button>
          <button
            onClick={() => setActiveTab('payments')}
            className={`px-4 py-2 font-medium ${
              activeTab === 'payments'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Payments ({payments.length})
          </button>
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && report && (
          <div>
            {/* Period Selector */}
            <div className="bg-white p-4 rounded-lg shadow mb-6 flex gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Month</label>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                  className="p-2 border rounded"
                >
                  {[...Array(12)].map((_, i) => (
                    <option key={i + 1} value={i + 1}>
                      {new Date(2000, i).toLocaleString('default', { month: 'long' })}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Year</label>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                  className="p-2 border rounded"
                >
                  {[...Array(5)].map((_, i) => {
                    const year = new Date().getFullYear() - i
                    return (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    )
                  })}
                </select>
              </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-5 gap-4 mb-8">
              <div className="bg-white p-6 rounded-lg shadow">
                <p className="text-sm text-gray-600">Total Due</p>
                <p className="text-2xl font-bold">₦{report.totalFeeAmount.toLocaleString()}</p>
              </div>
              <div className="bg-white p-6 rounded-lg shadow">
                <p className="text-sm text-gray-600">Collected</p>
                <p className="text-2xl font-bold text-green-600">₦{report.totalCollected.toLocaleString()}</p>
              </div>
              <div className="bg-white p-6 rounded-lg shadow">
                <p className="text-sm text-gray-600">Pending</p>
                <p className="text-2xl font-bold text-orange-600">₦{report.pendingAmount.toLocaleString()}</p>
              </div>
              <div className="bg-white p-6 rounded-lg shadow">
                <p className="text-sm text-gray-600">Collection Rate</p>
                <p className="text-2xl font-bold text-blue-600">{report.collectionRate}%</p>
              </div>
              <div className="bg-white p-6 rounded-lg shadow">
                <p className="text-sm text-gray-600">Payments Made</p>
                <p className="text-2xl font-bold">{report.totalPayments}</p>
              </div>
            </div>

            {/* Payment Methods Breakdown */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-bold mb-4">Payments by Gateway</h2>
              <div className="grid grid-cols-3 gap-4">
                {Object.entries(report.paymentsByGateway).map(([gateway, amount]) => (
                  <div key={gateway} className="border rounded p-4">
                    <p className="text-sm text-gray-600 capitalize">{gateway}</p>
                    <p className="text-2xl font-bold">₦{(amount as number).toLocaleString()}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Debtors Tab */}
        {activeTab === 'debtors' && (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            {debtors.length > 0 ? (
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-medium">Student Name</th>
                    <th className="px-6 py-3 text-left text-sm font-medium">Class</th>
                    <th className="px-6 py-3 text-left text-sm font-medium">Parent</th>
                    <th className="px-6 py-3 text-center text-sm font-medium">Total Due</th>
                    <th className="px-6 py-3 text-center text-sm font-medium">Total Paid</th>
                    <th className="px-6 py-3 text-center text-sm font-medium">Debt</th>
                    <th className="px-6 py-3 text-center text-sm font-medium">Days Overdue</th>
                  </tr>
                </thead>
                <tbody>
                  {debtors.map(debtor => (
                    <tr key={debtor.id} className="border-b hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-medium">{debtor.studentName}</td>
                      <td className="px-6 py-4 text-sm">{debtor.class}</td>
                      <td className="px-6 py-4 text-sm">{debtor.parent}</td>
                      <td className="px-6 py-4 text-center text-sm">₦{debtor.totalDue.toLocaleString()}</td>
                      <td className="px-6 py-4 text-center text-sm text-green-600">₦{debtor.totalPaid.toLocaleString()}</td>
                      <td className="px-6 py-4 text-center text-sm font-bold text-red-600">₦{debtor.debt.toLocaleString()}</td>
                      <td className="px-6 py-4 text-center text-sm">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          debtor.daysOverdue > 30
                            ? 'bg-red-100 text-red-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {debtor.daysOverdue} days
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="p-6 text-center text-gray-600">No debtors found</div>
            )}
          </div>
        )}

        {/* Payments Tab */}
        {activeTab === 'payments' && (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            {payments.length > 0 ? (
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-medium">Date</th>
                    <th className="px-6 py-3 text-left text-sm font-medium">Student</th>
                    <th className="px-6 py-3 text-left text-sm font-medium">Class</th>
                    <th className="px-6 py-3 text-center text-sm font-medium">Amount</th>
                    <th className="px-6 py-3 text-center text-sm font-medium">Method</th>
                    <th className="px-6 py-3 text-center text-sm font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map(payment => (
                    <tr key={payment.id} className="border-b hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm">
                        {new Date(payment.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        {payment.student.user.firstName} {payment.student.user.lastName}
                      </td>
                      <td className="px-6 py-4 text-sm">{payment.student.class.name}</td>
                      <td className="px-6 py-4 text-center text-sm font-medium">
                        ₦{payment.amount.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-center text-sm capitalize">{payment.gateway}</td>
                      <td className="px-6 py-4 text-center text-sm">
                        <span className="px-3 py-1 rounded-full bg-green-100 text-green-800 text-xs font-medium">
                          Completed
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="p-6 text-center text-gray-600">No payments found</div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  )
})
