import { useState, useEffect } from 'react'
import { withAuth } from '../../components/withAuth'
import AppLayout from '../../components/layout/AppLayout'
import { apiGet } from '../../lib/api'
import type { AuthUser } from '../../lib/useAuth'

type StudentReport = {
  id: string
  firstName: string
  lastName: string
  admissionNo: string
  className: string
  averageScore: number
  attendanceRate: number
  totalSubjects: number
  subjectsAboveAverage: number
  totalTests: number
  testsAbovePassingScore: number
}

type FilterOptions = {
  classId?: string
  termId?: string
}

function AdminStudentReportPage({ user }: { user: AuthUser }) {
  const [students, setStudents] = useState<StudentReport[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [sortBy, setSortBy] = useState('averageScore')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  useEffect(() => {
    loadReport()
  }, [])

  async function loadReport() {
    try {
      setLoading(true)
      const data = await apiGet<StudentReport[]>('/api/reports/students')
      setStudents(data)
    } catch (err) {
      setError('Failed to load report')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const sortedStudents = [...students].sort((a, b) => {
    let aValue: any = a[sortBy as keyof StudentReport]
    let bValue: any = b[sortBy as keyof StudentReport]

    if (typeof aValue === 'string') {
      aValue = aValue.toLowerCase()
      bValue = (bValue as string).toLowerCase()
    }

    if (sortOrder === 'asc') {
      return aValue > bValue ? 1 : -1
    } else {
      return aValue < bValue ? 1 : -1
    }
  })

  const getPerformanceColor = (score: number) => {
    if (score >= 80) return 'text-green-600 bg-green-50'
    if (score >= 60) return 'text-blue-600 bg-blue-50'
    if (score >= 40) return 'text-yellow-600 bg-yellow-50'
    return 'text-red-600 bg-red-50'
  }

  return (
    <AppLayout user={user} title="Student Performance Report">
      <div className="p-8 max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Student Performance Report</h1>

        {error && <div className="bg-red-100 text-red-700 p-4 rounded mb-4">{error}</div>}

        {/* Sorting Controls */}
        <div className="flex gap-4 mb-6">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg"
          >
            <option value="firstName">Name</option>
            <option value="averageScore">Average Score</option>
            <option value="attendanceRate">Attendance</option>
            <option value="subjectsAboveAverage">Strong Subjects</option>
          </select>
          <button
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300"
          >
            {sortOrder === 'asc' ? '↑ Ascending' : '↓ Descending'}
          </button>
        </div>

        {/* Report Table */}
        {loading ? (
          <div className="bg-white p-8 rounded-lg text-center text-gray-500">Loading report...</div>
        ) : students.length === 0 ? (
          <div className="bg-white p-8 rounded-lg text-center text-gray-600">No students found.</div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Student Name</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Admission No</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Class</th>
                  <th className="px-6 py-3 text-center text-sm font-semibold text-gray-900">Avg Score</th>
                  <th className="px-6 py-3 text-center text-sm font-semibold text-gray-900">Attendance</th>
                  <th className="px-6 py-3 text-center text-sm font-semibold text-gray-900">Strong Subjects</th>
                  <th className="px-6 py-3 text-center text-sm font-semibold text-gray-900">Test Performance</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {sortedStudents.map((student) => (
                  <tr key={student.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      {student.firstName} {student.lastName}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{student.admissionNo}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{student.className}</td>
                    <td className="px-6 py-4 text-sm text-center">
                      <span className={`px-3 py-1 rounded-full font-semibold ${getPerformanceColor(student.averageScore)}`}>
                        {student.averageScore.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-center">
                      <span
                        className={`px-3 py-1 rounded-full font-semibold ${
                          student.attendanceRate >= 85
                            ? 'text-green-600 bg-green-50'
                            : student.attendanceRate >= 70
                              ? 'text-yellow-600 bg-yellow-50'
                              : 'text-red-600 bg-red-50'
                        }`}
                      >
                        {student.attendanceRate.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-center text-gray-900 font-medium">
                      {student.subjectsAboveAverage}/{student.totalSubjects}
                    </td>
                    <td className="px-6 py-4 text-sm text-center text-gray-900 font-medium">
                      {student.testsAbovePassingScore}/{student.totalTests}
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

export default withAuth(AdminStudentReportPage, { roles: ['SuperAdmin', 'SchoolAdmin'] })
