import Link from 'next/link'
import { useEffect, useState } from 'react'
import { withAuth } from '../../components/withAuth'
import AppLayout from '../../components/layout/AppLayout'
import { apiGet, apiPost } from '../../lib/api'
import type { AuthUser } from '../../lib/useAuth'

type Enrollment = {
  id: string
  personType: string
  personName: string
  method: string
  status: string
  enrolledAt: string
  admissionNo: string | null
  employeeNo: string | null
}

type Student = { id: string; firstName: string; lastName: string; admissionNo: string }
type Employee = { id: string; firstName: string; lastName: string; employeeNo: string }

function AdminBiometricEnrollmentsPage({ user }: { user: AuthUser }) {
  const [enrollments, setEnrollments] = useState<Enrollment[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [devices, setDevices] = useState<Array<{ id: string; name: string }>>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [formData, setFormData] = useState({
    personType: 'student',
    studentId: '',
    employeeId: '',
    method: 'fingerprint',
  })
  const [scanDeviceId, setScanDeviceId] = useState('')
  const [scanEnrollmentId, setScanEnrollmentId] = useState('')

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      setLoading(true)
      const [enrollmentData, peopleData, deviceData] = await Promise.all([
        apiGet<Enrollment[]>('/api/biometrics/enrollments'),
        apiGet<{ students: Student[]; employees: Employee[] }>('/api/biometrics/people'),
        apiGet<Array<{ id: string; name: string }>>('/api/biometrics/devices'),
      ])
      setEnrollments(enrollmentData)
      setStudents(peopleData.students)
      setEmployees(peopleData.employees)
      setDevices(deviceData)
      if (deviceData.length > 0) setScanDeviceId(deviceData[0].id)
      setError('')
    } catch {
      setError('Failed to load enrollments')
    } finally {
      setLoading(false)
    }
  }

  async function handleEnroll() {
    try {
      await apiPost('/api/biometrics/enrollments', {
        personType: formData.personType,
        studentId: formData.personType === 'student' ? formData.studentId : undefined,
        employeeId: formData.personType === 'employee' ? formData.employeeId : undefined,
        method: formData.method,
        templateSeed: `${formData.personType}-${formData.personType === 'student' ? formData.studentId : formData.employeeId}-${formData.method}`,
      })
      loadData()
    } catch {
      setError('Failed to enroll — person may already be enrolled for this method')
    }
  }

  async function handleRevoke(id: string) {
    if (!confirm('Revoke this enrollment?')) return
    try {
      await apiPost(`/api/biometrics/enrollments/${id}/revoke`, {})
      loadData()
    } catch {
      setError('Failed to revoke enrollment')
    }
  }

  async function simulateScan() {
    if (!scanDeviceId || !scanEnrollmentId) {
      setError('Select a device and enrollment to simulate scan')
      return
    }
    try {
      const result = await apiPost<{ granted: boolean; event: { status: string } }>('/api/biometrics/scan', {
        deviceId: scanDeviceId,
        enrollmentId: scanEnrollmentId,
        method: 'fingerprint',
        matchScore: 0.97,
      })
      alert(result.granted ? 'Scan granted — attendance/access recorded' : `Scan ${result.event.status}`)
      loadData()
    } catch {
      setError('Scan simulation failed')
    }
  }

  const activeEnrollments = enrollments.filter((e) => e.status === 'active')

  return (
    <AppLayout user={user} title="Biometric Enrollments">
      <div className="p-8 max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold">Biometric Enrollments</h1>
            <p className="text-gray-600 mt-1">Register fingerprint and facial templates for students and staff.</p>
          </div>
          <Link href="/admin/biometrics" className="px-4 py-2 border border-gray-300 rounded-lg text-sm self-start">Dashboard</Link>
        </div>

        {error && <div className="bg-red-100 text-red-700 p-4 rounded mb-4">{error}</div>}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="font-bold mb-4">New enrollment</h2>
            <div className="space-y-3">
              <select value={formData.personType} onChange={(e) => setFormData({ ...formData, personType: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2">
                <option value="student">Student</option>
                <option value="employee">Staff</option>
              </select>
              {formData.personType === 'student' ? (
                <select value={formData.studentId} onChange={(e) => setFormData({ ...formData, studentId: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2">
                  <option value="">Select student...</option>
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>{s.firstName} {s.lastName} ({s.admissionNo})</option>
                  ))}
                </select>
              ) : (
                <select value={formData.employeeId} onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2">
                  <option value="">Select staff...</option>
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>{e.firstName} {e.lastName} ({e.employeeNo})</option>
                  ))}
                </select>
              )}
              <select value={formData.method} onChange={(e) => setFormData({ ...formData, method: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2">
                <option value="fingerprint">Fingerprint</option>
                <option value="facial">Facial</option>
              </select>
              <button onClick={handleEnroll} className="w-full bg-blue-600 text-white py-2 rounded-lg font-medium">Enroll</button>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="font-bold mb-4">Simulate scan</h2>
            <p className="text-sm text-gray-600 mb-4">Test a device scan to mark attendance or log gate access.</p>
            <div className="space-y-3">
              <select value={scanDeviceId} onChange={(e) => setScanDeviceId(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2">
                {devices.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
              <select value={scanEnrollmentId} onChange={(e) => setScanEnrollmentId(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2">
                <option value="">Select enrollment...</option>
                {activeEnrollments.map((e) => (
                  <option key={e.id} value={e.id}>{e.personName} — {e.method}</option>
                ))}
              </select>
              <button onClick={simulateScan} className="w-full bg-indigo-600 text-white py-2 rounded-lg font-medium">Run scan</button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="bg-white p-8 rounded-lg text-center text-gray-500">Loading...</div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Person</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Type</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Method</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">ID</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Status</th>
                  <th className="px-6 py-3 text-center text-sm font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {enrollments.map((e) => (
                  <tr key={e.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium">{e.personName}</td>
                    <td className="px-6 py-4 text-sm capitalize">{e.personType}</td>
                    <td className="px-6 py-4 text-sm capitalize">{e.method}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{e.admissionNo || e.employeeNo || '—'}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${e.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>{e.status}</span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      {e.status === 'active' && (
                        <button onClick={() => handleRevoke(e.id)} className="text-red-600 text-sm font-medium">Revoke</button>
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

export default withAuth(AdminBiometricEnrollmentsPage, { roles: ['SuperAdmin', 'SchoolAdmin', 'BiometricManager'] })
