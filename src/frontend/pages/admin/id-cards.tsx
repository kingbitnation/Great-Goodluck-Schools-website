import Link from 'next/link'
import { useEffect, useState } from 'react'
import { withAuth } from '../../components/withAuth'
import AppLayout from '../../components/layout/AppLayout'
import { apiGet, apiPost } from '../../lib/api'
import { fetchWithAuth } from '../../lib/auth'
import type { AuthUser } from '../../lib/useAuth'

type IdCardStats = { total: number; students: number; staff: number; expiringSoon: number; revoked: number }

type IdCard = {
  id: string
  cardType: string
  holderName: string
  cardNumber: string
  verifyCode: string
  roleLabel?: string | null
  departmentOrClass?: string | null
  expiresAt: string
  status: string
}

type Student = { id: string; firstName: string; lastName: string; admissionNo: string }
type Employee = { id: string; firstName: string; lastName: string; employeeNo: string }

function AdminIdCardsPage({ user }: { user: AuthUser }) {
  const [stats, setStats] = useState<IdCardStats | null>(null)
  const [cards, setCards] = useState<IdCard[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    cardType: 'student',
    studentId: '',
    employeeId: '',
    expiresAt: '',
  })

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      setLoading(true)
      const [statsData, cardData, peopleData] = await Promise.all([
        apiGet<IdCardStats>('/api/id-cards/stats'),
        apiGet<IdCard[]>('/api/id-cards'),
        apiGet<{ students: Student[]; employees: Employee[] }>('/api/id-cards/people'),
      ])
      setStats(statsData)
      setCards(cardData)
      setStudents(peopleData.students)
      setEmployees(peopleData.employees)
      setError('')
    } catch {
      setError('Failed to load ID cards')
    } finally {
      setLoading(false)
    }
  }

  async function handleIssue() {
    try {
      const payload: Record<string, string> = { cardType: formData.cardType }
      if (formData.cardType === 'student') {
        if (!formData.studentId) return setError('Select a student')
        payload.studentId = formData.studentId
      } else {
        if (!formData.employeeId) return setError('Select a staff member')
        payload.employeeId = formData.employeeId
      }
      if (formData.expiresAt) payload.expiresAt = formData.expiresAt
      await apiPost('/api/id-cards', payload)
      setShowForm(false)
      setFormData({ cardType: 'student', studentId: '', employeeId: '', expiresAt: '' })
      loadData()
    } catch {
      setError('Failed to issue ID card')
    }
  }

  async function handleRevoke(id: string) {
    if (!confirm('Revoke this ID card?')) return
    try {
      await apiPost(`/api/id-cards/${id}/revoke`, {})
      loadData()
    } catch {
      setError('Failed to revoke card')
    }
  }

  async function downloadPdf(id: string, number: string) {
    const res = await fetchWithAuth(`/api/id-cards/${id}/pdf`)
    if (!res.ok) return setError('PDF download failed')
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `id-card-${number}.pdf`
    a.click()
    URL.revokeObjectURL(url)
  }

  const defaultExpiry = () => {
    const d = new Date()
    d.setFullYear(d.getFullYear() + 1)
    return d.toISOString().slice(0, 10)
  }

  return (
    <AppLayout user={user} title="ID Cards">
      <div className="p-8 max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold">Digital ID Cards</h1>
            <p className="text-gray-600 mt-1">Issue student and staff IDs with QR verification and printable PDFs.</p>
          </div>
          <div className="flex gap-2">
            <Link href="/verify-id-card" target="_blank" className="px-4 py-2 border border-gray-300 rounded-lg text-sm">Verify portal</Link>
            <button onClick={() => setShowForm(!showForm)} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium">
              {showForm ? 'Cancel' : 'Issue ID card'}
            </button>
          </div>
        </div>

        {error && <div className="bg-red-100 text-red-700 p-4 rounded mb-4">{error}</div>}

        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
            {[
              { label: 'Active', value: stats.total },
              { label: 'Students', value: stats.students },
              { label: 'Staff', value: stats.staff },
              { label: 'Expiring soon', value: stats.expiringSoon },
              { label: 'Revoked', value: stats.revoked },
            ].map((c) => (
              <div key={c.label} className="bg-white rounded-lg shadow p-4">
                <p className="text-sm text-gray-500">{c.label}</p>
                <p className="text-2xl font-bold">{c.value}</p>
              </div>
            ))}
          </div>
        )}

        {showForm && (
          <div className="bg-white rounded-lg shadow p-6 mb-8 grid grid-cols-1 md:grid-cols-2 gap-4">
            <select value={formData.cardType} onChange={(e) => setFormData({ ...formData, cardType: e.target.value, studentId: '', employeeId: '' })} className="border border-gray-300 rounded-lg px-3 py-2">
              <option value="student">Student ID</option>
              <option value="staff">Staff ID</option>
            </select>
            {formData.cardType === 'student' ? (
              <select value={formData.studentId} onChange={(e) => setFormData({ ...formData, studentId: e.target.value })} className="border border-gray-300 rounded-lg px-3 py-2">
                <option value="">Select student...</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>{s.firstName} {s.lastName} ({s.admissionNo})</option>
                ))}
              </select>
            ) : (
              <select value={formData.employeeId} onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })} className="border border-gray-300 rounded-lg px-3 py-2">
                <option value="">Select staff...</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>{e.firstName} {e.lastName} ({e.employeeNo})</option>
                ))}
              </select>
            )}
            <label className="md:col-span-2 text-sm text-gray-700">
              Expiry date (optional — defaults to 1 year)
              <input type="date" value={formData.expiresAt} onChange={(e) => setFormData({ ...formData, expiresAt: e.target.value })} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2" min={new Date().toISOString().slice(0, 10)} placeholder={defaultExpiry()} />
            </label>
            <button onClick={handleIssue} className="md:col-span-2 bg-blue-600 text-white py-2 rounded-lg font-medium">Issue card</button>
          </div>
        )}

        {loading ? (
          <div className="bg-white p-8 rounded-lg text-center text-gray-500">Loading...</div>
        ) : cards.length === 0 ? (
          <div className="bg-white p-8 rounded-lg text-center text-gray-600">No ID cards issued yet.</div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Holder</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Type</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Card No.</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Expires</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Status</th>
                  <th className="px-6 py-3 text-center text-sm font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {cards.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium">{c.holderName}</td>
                    <td className="px-6 py-4 text-sm capitalize">{c.cardType}</td>
                    <td className="px-6 py-4 text-sm font-mono text-gray-600">{c.cardNumber}</td>
                    <td className="px-6 py-4 text-sm">{new Date(c.expiresAt).toLocaleDateString()}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        c.status === 'active' ? 'bg-green-100 text-green-800' : c.status === 'expired' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'
                      }`}>{c.status}</span>
                    </td>
                    <td className="px-6 py-4 text-center space-x-2">
                      {c.status === 'active' && (
                        <>
                          <button onClick={() => downloadPdf(c.id, c.cardNumber)} className="text-blue-600 text-sm font-medium">PDF</button>
                          <button onClick={() => handleRevoke(c.id)} className="text-red-600 text-sm font-medium">Revoke</button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppLayout>
  )
}

export default withAuth(AdminIdCardsPage, { roles: ['SuperAdmin', 'SchoolAdmin'] })
