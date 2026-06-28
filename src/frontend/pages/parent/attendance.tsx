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
}

type Child = {
  id: string
  user: { firstName: string; lastName: string }
  class: { name: string }
}

function ParentAttendancePage({ user }: { user: AuthUser }) {
  const [children, setChildren] = useState<Child[]>([])
  const [selectedChild, setSelectedChild] = useState<string>('')
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth() + 1)
  const [filterYear, setFilterYear] = useState(new Date().getFullYear())

  useEffect(() => {
    async function loadChildren() {
      try {
        const childrenData = await apiGet<Child[]>('/api/parents/children')
        setChildren(childrenData)
        if (childrenData.length > 0) {
          setSelectedChild(childrenData[0].id)
          loadAttendance(childrenData[0].id, filterMonth, filterYear)
        }
      } catch (err) {
        setError('Failed to load children')
        console.error(err)
      }
    }
    loadChildren()
  }, [filterMonth, filterYear])

  async function loadAttendance(childId: string, month: number, year: number) {
    try {
      setLoading(true)
      const attendanceData = await apiGet<AttendanceRecord[]>(
        `/api/attendance?studentId=${childId}&month=${month}&year=${year}`
      )
      setAttendance(attendanceData)
    } catch (err) {
      console.error(err)
      setAttendance([])
    } finally {
      setLoading(false)
    }
  }

  const handleChildChange = (childId: string) => {
    setSelectedChild(childId)
    loadAttendance(childId, filterMonth, filterYear)
  }

  const selectedChildData = children.find((c) => c.id === selectedChild)
  const presentDays = attendance.filter((a) => a.status.toLowerCase() === 'present').length
  const absentDays = attendance.filter((a) => a.status.toLowerCase() === 'absent').length
  const lateDays = attendance.filter((a) => a.status.toLowerCase() === 'late').length
  const attendanceRate = attendance.length > 0 ? (((presentDays + lateDays) / attendance.length) * 100).toFixed(1) : '0'

  return (
    <AppLayout user={user} title="Attendance">
      <div className="p-8 max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Attendance Record</h1>

        {error && <div className="bg-red-100 text-red-700 p-4 rounded mb-4">{error}</div>}

        {/* Child Selector & Filters */}
        <div className="bg-white p-6 rounded-lg shadow mb-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Select Child</label>
              <select
                value={selectedChild}
                onChange={(e) => handleChildChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                {children.map((child) => (
                  <option key={child.id} value={child.id}>
                    {child.user.firstName} {child.user.lastName} ({child.class.name})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Month</label>
              <select
                value={filterMonth}
                onChange={(e) => setFilterMonth(parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                {[...Array(12)].map((_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {new Date(2000, i).toLocaleString('default', { month: 'long' })}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Year</label>
              <select
                value={filterYear}
                onChange={(e) => setFilterYear(parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
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
        </div>

        {/* Summary Cards */}
        {selectedChildData && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white p-6 rounded-lg shadow border-l-4 border-green-500">
              <p className="text-sm text-gray-600">Present</p>
              <p className="text-3xl font-bold text-green-600">{presentDays}</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow border-l-4 border-red-500">
              <p className="text-sm text-gray-600">Absent</p>
              <p className="text-3xl font-bold text-red-600">{absentDays}</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow border-l-4 border-yellow-500">
              <p className="text-sm text-gray-600">Late</p>
              <p className="text-3xl font-bold text-yellow-600">{lateDays}</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow border-l-4 border-blue-500">
              <p className="text-sm text-gray-600">Attendance Rate</p>
              <p className="text-3xl font-bold text-blue-600">{attendanceRate}%</p>
            </div>
          </div>
        )}

        {/* Attendance Table */}
        {loading ? (
          <div className="bg-white p-8 rounded-lg text-center text-gray-500">Loading attendance...</div>
        ) : attendance.length === 0 ? (
          <div className="bg-white p-8 rounded-lg text-center text-gray-600">
            No attendance records available for the selected period.
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-medium">Date</th>
                  <th className="px-6 py-3 text-left text-sm font-medium">Day</th>
                  <th className="px-6 py-3 text-center text-sm font-medium">Status</th>
                  <th className="px-6 py-3 text-left text-sm font-medium">Remark</th>
                </tr>
              </thead>
              <tbody>
                {attendance.map((record) => {
                  const date = new Date(record.date)
                  return (
                    <tr key={record.id} className="border-b hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-medium">{date.toLocaleDateString()}</td>
                      <td className="px-6 py-4 text-sm">
                        {date.toLocaleString('default', { weekday: 'long' })}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span
                          className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                          record.status.toLowerCase() === 'present'
                              ? 'bg-green-100 text-green-800'
                              : record.status === 'absent'
                                ? 'bg-red-100 text-red-800'
                                : record.status === 'late'
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {record.status.charAt(0).toUpperCase() + record.status.slice(1)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{record.remark || '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppLayout>
  )
}

export default withAuth(ParentAttendancePage, { roles: ['Parent'] })
