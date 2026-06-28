import Link from 'next/link'
import { useEffect, useState } from 'react'
import { withAuth } from '../../components/withAuth'
import AppLayout from '../../components/layout/AppLayout'
import { apiGet, apiPost } from '../../lib/api'
import { fetchWithAuth } from '../../lib/auth'
import type { AuthUser } from '../../lib/useAuth'

type CertStats = {
  total: number
  graduation: number
  attendance: number
  excellence: number
  revoked: number
}

type Certificate = {
  id: string
  certificateType: string
  title: string
  recipientName: string
  certificateNumber: string
  verifyCode: string
  status: string
  issuedAt: string
  sessionLabel?: string | null
  className?: string | null
}

type Student = { id: string; firstName: string; lastName: string; admissionNo: string }

function AdminCertificatesPage({ user }: { user: AuthUser }) {
  const [stats, setStats] = useState<CertStats | null>(null)
  const [certificates, setCertificates] = useState<Certificate[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    certificateType: 'graduation',
    studentId: '',
    description: '',
    sessionLabel: '2025/2026',
    className: '',
  })

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      setLoading(true)
      const [statsData, certData, studentData] = await Promise.all([
        apiGet<CertStats>('/api/certificates/stats'),
        apiGet<Certificate[]>('/api/certificates'),
        apiGet<Array<{ id: string; admissionNo: string; user: { firstName: string; lastName: string } }>>('/api/students'),
      ])
      setStats(statsData)
      setCertificates(certData)
      setStudents(studentData.map((s) => ({
        id: s.id,
        firstName: s.user.firstName,
        lastName: s.user.lastName,
        admissionNo: s.admissionNo,
      })))
      setError('')
    } catch {
      setError('Failed to load certificates')
    } finally {
      setLoading(false)
    }
  }

  async function handleIssue() {
    if (!formData.studentId) {
      setError('Select a student')
      return
    }
    try {
      await apiPost('/api/certificates', formData)
      setShowForm(false)
      setFormData({ certificateType: 'graduation', studentId: '', description: '', sessionLabel: '2025/2026', className: '' })
      loadData()
    } catch {
      setError('Failed to issue certificate')
    }
  }

  async function handleRevoke(id: string) {
    if (!confirm('Revoke this certificate?')) return
    try {
      await apiPost(`/api/certificates/${id}/revoke`, {})
      loadData()
    } catch {
      setError('Failed to revoke certificate')
    }
  }

  async function downloadPdf(id: string, number: string) {
    const res = await fetchWithAuth(`/api/certificates/${id}/pdf`)
    if (!res.ok) {
      setError('PDF download failed')
      return
    }
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `certificate-${number}.pdf`
    a.click()
    URL.revokeObjectURL(url)
  }

  const typeLabel = (t: string) =>
    t === 'graduation' ? 'Graduation' : t === 'attendance' ? 'Attendance' : t === 'excellence' ? 'Excellence' : t

  return (
    <AppLayout user={user} title="Certificates">
      <div className="p-8 max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold">School Certificates</h1>
            <p className="text-gray-600 mt-1">Graduation, attendance, and excellence awards with QR verification.</p>
          </div>
          <div className="flex gap-2">
            <Link href="/verify-certificate" className="px-4 py-2 border border-gray-300 rounded-lg text-sm" target="_blank">Public verify portal</Link>
            <button onClick={() => setShowForm(!showForm)} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium">
              {showForm ? 'Cancel' : 'Issue certificate'}
            </button>
          </div>
        </div>

        {error && <div className="bg-red-100 text-red-700 p-4 rounded mb-4">{error}</div>}

        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
            {[
              { label: 'Active', value: stats.total },
              { label: 'Graduation', value: stats.graduation },
              { label: 'Attendance', value: stats.attendance },
              { label: 'Excellence', value: stats.excellence },
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
            <select value={formData.certificateType} onChange={(e) => setFormData({ ...formData, certificateType: e.target.value })} className="border border-gray-300 rounded-lg px-3 py-2">
              <option value="graduation">Graduation</option>
              <option value="attendance">Attendance</option>
              <option value="excellence">Excellence</option>
            </select>
            <select value={formData.studentId} onChange={(e) => setFormData({ ...formData, studentId: e.target.value })} className="border border-gray-300 rounded-lg px-3 py-2">
              <option value="">Select student...</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>{s.firstName} {s.lastName} ({s.admissionNo})</option>
              ))}
            </select>
            <input placeholder="Session (e.g. 2025/2026)" value={formData.sessionLabel} onChange={(e) => setFormData({ ...formData, sessionLabel: e.target.value })} className="border border-gray-300 rounded-lg px-3 py-2" />
            <input placeholder="Class (optional)" value={formData.className} onChange={(e) => setFormData({ ...formData, className: e.target.value })} className="border border-gray-300 rounded-lg px-3 py-2" />
            <textarea placeholder="Description / achievement details" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className="md:col-span-2 border border-gray-300 rounded-lg px-3 py-2 min-h-[80px]" />
            <button onClick={handleIssue} className="md:col-span-2 bg-blue-600 text-white py-2 rounded-lg font-medium">Issue &amp; generate PDF code</button>
          </div>
        )}

        {loading ? (
          <div className="bg-white p-8 rounded-lg text-center text-gray-500">Loading...</div>
        ) : certificates.length === 0 ? (
          <div className="bg-white p-8 rounded-lg text-center text-gray-600">No certificates issued yet.</div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Recipient</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Type</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Certificate No.</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Verify code</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Issued</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Status</th>
                  <th className="px-6 py-3 text-center text-sm font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {certificates.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium">{c.recipientName}</td>
                    <td className="px-6 py-4 text-sm">{typeLabel(c.certificateType)}</td>
                    <td className="px-6 py-4 text-sm font-mono text-gray-600">{c.certificateNumber}</td>
                    <td className="px-6 py-4 text-xs font-mono text-gray-500">{c.verifyCode}</td>
                    <td className="px-6 py-4 text-sm">{new Date(c.issuedAt).toLocaleDateString()}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${c.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{c.status}</span>
                    </td>
                    <td className="px-6 py-4 text-center space-x-2">
                      {c.status === 'active' && (
                        <>
                          <button onClick={() => downloadPdf(c.id, c.certificateNumber)} className="text-blue-600 text-sm font-medium">PDF</button>
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

export default withAuth(AdminCertificatesPage, { roles: ['SuperAdmin', 'SchoolAdmin'] })
