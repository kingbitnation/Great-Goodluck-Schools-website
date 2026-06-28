import { useEffect, useState } from 'react'
import { withAuth } from '../../components/withAuth'
import AppLayout from '../../components/layout/AppLayout'
import { apiGet } from '../../lib/api'
import type { AuthUser } from '../../lib/useAuth'

type AttendanceRecord = {
  id: string
  date: string
  status: string
  remark?: string | null
  class: { name: string }
  student: { user: { firstName: string; lastName: string } }
  markedBy: { firstName: string; lastName: string }
}

function TeacherAttendancePage({ user }: { user: AuthUser }) {
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function loadAttendance() {
      try {
        setLoading(true)
        const attendanceData = await apiGet<AttendanceRecord[]>('/api/attendance')
        setAttendance(attendanceData)
      } catch (err) {
        setError('Failed to load attendance records')
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    loadAttendance()
  }, [])

  return (
    <AppLayout user={user} title="Attendance">
      <div className="p-8 max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Attendance</h1>
        {error && <div className="bg-red-100 text-red-700 p-4 rounded mb-4">{error}</div>}

        {loading ? (
          <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-gray-500">Loading attendance...</div>
        ) : attendance.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center text-gray-600">No attendance records available.</div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
            <table className="w-full min-w-[720px] divide-y divide-gray-200">
              <thead className="bg-gray-50 text-left text-sm font-semibold text-gray-700">
                <tr>
                  <th className="px-6 py-3">Date</th>
                  <th className="px-6 py-3">Student</th>
                  <th className="px-6 py-3">Class</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Marked By</th>
                  <th className="px-6 py-3">Remark</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white text-sm text-gray-700">
                {attendance.map((record) => (
                  <tr key={record.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">{new Date(record.date).toLocaleDateString()}</td>
                    <td className="px-6 py-4">{record.student.user.firstName} {record.student.user.lastName}</td>
                    <td className="px-6 py-4">{record.class.name}</td>
                    <td className="px-6 py-4 capitalize">{record.status}</td>
                    <td className="px-6 py-4">{record.markedBy.firstName} {record.markedBy.lastName}</td>
                    <td className="px-6 py-4">{record.remark || '—'}</td>
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

export default withAuth(TeacherAttendancePage, { roles: ['Teacher'] })
