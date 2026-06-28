import { useState, useEffect } from 'react'
import { withAuth } from '../../components/withAuth'
import AppLayout from '../../components/layout/AppLayout'
import { apiGet } from '../../lib/api'
import type { AuthUser } from '../../lib/useAuth'

interface AttendanceRecord {
  date: string
  status: string
}

export default withAuth(function StudentAttendancePage({ user }: { user: AuthUser }) {
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [studentId, setStudentId] = useState<string>('')

  useEffect(() => {
    loadAttendance()
  }, [])

  async function loadAttendance() {
    try {
      setLoading(true)
      const students = await apiGet<Array<{ id: string; user: { email: string } }>>('/api/students')
      const currentStudent = students.find(s => s.user.email === user?.email)
      if (!currentStudent) {
        setError('Student profile not found')
        return
      }
      setStudentId(currentStudent.id)

      const records = await apiGet<AttendanceRecord[]>(`/api/attendance?studentId=${currentStudent.id}`)
      setAttendance(records)
    } catch (err) {
      setError('Failed to load attendance')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const presentCount = attendance.filter(a => a.status === 'Present').length
  const absentCount = attendance.filter(a => a.status === 'Absent').length
  const lateCount = attendance.filter(a => a.status === 'Late').length
  const attendancePercentage = attendance.length > 0
    ? ((presentCount / attendance.length) * 100).toFixed(1)
    : 0

  if (loading) return <AppLayout user={user} title="My Attendance"><div className="p-8">Loading...</div></AppLayout>

  return (
    <AppLayout user={user} title="My Attendance">
      <div className="p-8 max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">My Attendance</h1>

        {error && <div className="bg-red-100 text-red-700 p-4 rounded mb-4">{error}</div>}

        {/* Summary Cards */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          <div className="bg-white p-6 rounded-lg shadow">
            <p className="text-sm text-gray-600">Total Days</p>
            <p className="text-3xl font-bold">{attendance.length}</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <p className="text-sm text-gray-600">Attendance %</p>
            <p className="text-3xl font-bold text-green-600">{attendancePercentage}%</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <p className="text-sm text-gray-600">Absent</p>
            <p className="text-3xl font-bold text-red-600">{absentCount}</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <p className="text-sm text-gray-600">Late</p>
            <p className="text-3xl font-bold text-orange-600">{lateCount}</p>
          </div>
        </div>

        {/* Attendance Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {attendance.length > 0 ? (
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-medium">Date</th>
                  <th className="px-6 py-3 text-center text-sm font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {attendance.map((record, idx) => (
                  <tr key={idx} className="border-b hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm">
                      {new Date(record.date).toLocaleDateString('en-US', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        record.status === 'Present'
                          ? 'bg-green-100 text-green-800'
                          : record.status === 'Absent'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-orange-100 text-orange-800'
                      }`}>
                        {record.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-6 text-center text-gray-600">No attendance records yet</div>
          )}
        </div>
      </div>
    </AppLayout>
  )
})
