import { useState, useEffect } from 'react'
import { withAuth } from '../../components/withAuth'
import AppLayout from '../../components/layout/AppLayout'
import { apiGet } from '../../lib/api'
import type { AuthUser } from '../../lib/useAuth'

interface StudentInfo {
  id: string
  admissionNo: string
  dob?: string
  gender?: string
  address?: string
  user: { firstName: string; lastName: string; email: string; phone?: string }
  class: { name: string; level: string }
  parent?: { user: { firstName: string; lastName: string; phone?: string } }
}

interface Stats {
  students?: number
  teachers?: number
  classes?: number
  fees?: number
}

interface Result {
  totalScore: number
  grade: string
  subject: { name: string }
  published?: boolean
}

interface Payment {
  status: string
  amount: number
}

export default withAuth(function StudentPortalPage({ user }: { user: AuthUser }) {
  const [student, setStudent] = useState<StudentInfo | null>(null)
  const [stats, setStats] = useState<Stats>({})
  const [results, setResults] = useState<Result[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      setLoading(true)

      // Get dashboard stats
      const dashboardStats = await apiGet<Record<string, number>>('/api/dashboard/stats')
      setStats(dashboardStats)

      // Get student info
      const students = await apiGet<StudentInfo[]>('/api/students')
      const currentStudent = students.find(s => s.user.email === user?.email)
      if (currentStudent) {
        setStudent(currentStudent)

        // Get results
        const studentResults = await apiGet<Result[]>(`/api/results/student/${currentStudent.id}`)
        setResults(studentResults.filter(r => r.published))

        // Get payments
        const studentPayments = await apiGet<Payment[]>(`/api/payments?studentId=${currentStudent.id}`)
        setPayments(studentPayments)
      }
    } catch (err) {
      setError('Failed to load data')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <AppLayout user={user} title="Student Portal">
        <div className="p-8 text-center">Loading your portal...</div>
      </AppLayout>
    )
  }

  if (!student) {
    return (
      <AppLayout user={user} title="Student Portal">
        <div className="p-8 text-center text-red-600">Student profile not found</div>
      </AppLayout>
    )
  }

  const recentResults = results.slice(0, 3)
  const averageScore = results.length > 0
    ? (results.reduce((sum, r) => sum + r.totalScore, 0) / results.length).toFixed(2)
    : 0
  const feesPaid = payments.filter(p => p.status === 'completed').reduce((sum, p) => sum + p.amount, 0)

  return (
    <AppLayout user={user} title="Student Portal">
      <div className="p-8 max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Welcome, {student.user.firstName}!</h1>
          <p className="text-gray-600">Admission No: {student.admissionNo}</p>
        </div>

        {error && <div className="bg-red-100 text-red-700 p-4 rounded mb-4">{error}</div>}

        {/* Quick Stats */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          <div className="bg-white p-6 rounded-lg shadow">
            <p className="text-sm text-gray-600">Average Score</p>
            <p className="text-3xl font-bold text-blue-600">{averageScore}%</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <p className="text-sm text-gray-600">Subjects Studied</p>
            <p className="text-3xl font-bold text-green-600">{results.length}</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <p className="text-sm text-gray-600">Fees Paid</p>
            <p className="text-3xl font-bold text-purple-600">₦{feesPaid.toLocaleString()}</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <p className="text-sm text-gray-600">Current Class</p>
            <p className="text-2xl font-bold">{student.class.name}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-8">
          {/* Student Info */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold mb-4">Personal Information</h2>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-600">Email</p>
                <p className="font-medium">{student.user.email}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Phone</p>
                <p className="font-medium">{student.user.phone || 'Not provided'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Date of Birth</p>
                <p className="font-medium">
                  {student.dob
                    ? new Date(student.dob).toLocaleDateString()
                    : 'Not provided'}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Gender</p>
                <p className="font-medium">{student.gender || 'Not provided'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Address</p>
                <p className="font-medium">{student.address || 'Not provided'}</p>
              </div>
            </div>
          </div>

          {/* Parent Info */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold mb-4">Parent/Guardian</h2>
            {student.parent ? (
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-gray-600">Name</p>
                  <p className="font-medium">
                    {student.parent.user.firstName} {student.parent.user.lastName}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Phone</p>
                  <p className="font-medium">{student.parent.user.phone || 'Not provided'}</p>
                </div>
              </div>
            ) : (
              <p className="text-gray-600">No parent/guardian assigned</p>
            )}
          </div>
        </div>

        {/* Recent Results */}
        {recentResults.length > 0 && (
          <div className="mt-8 bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Recent Results</h2>
              <a href="/student/results" className="text-blue-600 hover:text-blue-800 text-sm">
                View All →
              </a>
            </div>
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-2 text-left text-sm font-medium">Subject</th>
                  <th className="px-4 py-2 text-center text-sm font-medium">Score</th>
                  <th className="px-4 py-2 text-center text-sm font-medium">Grade</th>
                </tr>
              </thead>
              <tbody>
                {recentResults.map((result, idx) => (
                  <tr key={idx} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm">{result.subject.name}</td>
                    <td className="px-4 py-3 text-center text-sm font-medium">{result.totalScore}</td>
                    <td className="px-4 py-3 text-center text-sm">
                      <span className="px-2 py-1 rounded bg-blue-100 text-blue-800">
                        {result.grade}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Quick Links */}
        <div className="mt-8 grid grid-cols-4 gap-4">
          <a
            href="/student/fees"
            className="bg-gradient-to-br from-blue-500 to-blue-600 text-white p-4 rounded-lg shadow hover:shadow-lg transition"
          >
            <p className="font-bold">My Fees</p>
            <p className="text-sm opacity-90">View and pay fees</p>
          </a>
          <a
            href="/student/results"
            className="bg-gradient-to-br from-green-500 to-green-600 text-white p-4 rounded-lg shadow hover:shadow-lg transition"
          >
            <p className="font-bold">Results</p>
            <p className="text-sm opacity-90">View all results</p>
          </a>
          <a
            href="/student/attendance"
            className="bg-gradient-to-br from-purple-500 to-purple-600 text-white p-4 rounded-lg shadow hover:shadow-lg transition"
          >
            <p className="font-bold">Attendance</p>
            <p className="text-sm opacity-90">View attendance</p>
          </a>
          <a
            href="/student/timetable"
            className="bg-gradient-to-br from-orange-500 to-orange-600 text-white p-4 rounded-lg shadow hover:shadow-lg transition"
          >
            <p className="font-bold">Timetable</p>
            <p className="text-sm opacity-90">View schedule</p>
          </a>
        </div>
      </div>
    </AppLayout>
  )
})
