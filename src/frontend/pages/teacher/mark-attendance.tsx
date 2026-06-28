import { useState, useEffect } from 'react'
import { withAuth } from '../../components/withAuth'
import AppLayout from '../../components/layout/AppLayout'
import { apiGet, apiPost } from '../../lib/api'
import type { AuthUser } from '../../lib/useAuth'

type Class = {
  id: string
  name: string
}

type Student = {
  id: string
  admissionNo: string
  user: { firstName: string; lastName: string; email: string }
}

type AttendanceRecord = {
  id: string
  date: string
  status: string
  remark?: string | null
}

function TeacherMarkAttendancePage({ user }: { user: AuthUser }) {
  const [classes, setClasses] = useState<Class[]>([])
  const [selectedClass, setSelectedClass] = useState<string>('')
  const [students, setStudents] = useState<Student[]>([])
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [attendance, setAttendance] = useState<Record<string, { status: string; remark: string }>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    loadClasses()
  }, [])

  async function loadClasses() {
    try {
      const classesData = await apiGet<Class[]>('/api/classes')
      setClasses(classesData)
    } catch (err) {
      console.error(err)
    }
  }

  async function handleClassSelect(classId: string) {
    try {
      setLoading(true)
      setSelectedClass(classId)
      const studentsData = await apiGet<Student[]>(`/api/students?classId=${classId}`)
      setStudents(studentsData)

      // Load existing attendance for the selected date
      const attendanceData = await apiGet<AttendanceRecord[]>(
        `/api/attendance?classId=${classId}&date=${selectedDate}`
      )

      const attendanceMap: Record<string, { status: string; remark: string }> = {}
      attendanceData.forEach((record) => {
        attendanceMap[record.id] = { status: record.status, remark: record.remark || '' }
      })
      setAttendance(attendanceMap)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  async function handleSaveAttendance() {
    if (!selectedClass || !students.length) {
      setError('Please select a class first')
      return
    }

    try {
      setLoading(true)
      setError('')

      for (const student of students) {
        const record = attendance[student.id]
        if (record && record.status) {
          await apiPost('/api/attendance', {
            studentId: student.id,
            classId: selectedClass,
            date: new Date(selectedDate),
            status: record.status,
            remark: record.remark || null,
          })
        }
      }

      setSuccess('Attendance marked successfully!')
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError('Failed to save attendance')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AppLayout user={user} title="Mark Attendance">
      <div className="p-8 max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Mark Attendance</h1>

        {error && <div className="bg-red-100 text-red-700 p-4 rounded mb-4">{error}</div>}
        {success && <div className="bg-green-100 text-green-700 p-4 rounded mb-4">{success}</div>}

        {/* Filters */}
        <div className="bg-white p-6 rounded-lg shadow mb-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Select Class</label>
              <select
                value={selectedClass}
                onChange={(e) => handleClassSelect(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="">-- Choose a class --</option>
                {classes.map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Date</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
          </div>
        </div>

        {/* Attendance Table */}
        {selectedClass && students.length > 0 && (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-medium">Student Name</th>
                  <th className="px-6 py-3 text-left text-sm font-medium">Admission No</th>
                  <th className="px-6 py-3 text-center text-sm font-medium">Status</th>
                  <th className="px-6 py-3 text-left text-sm font-medium">Remark</th>
                </tr>
              </thead>
              <tbody>
                {students.map((student) => (
                  <tr key={student.id} className="border-b hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium">
                      {student.user.firstName} {student.user.lastName}
                    </td>
                    <td className="px-6 py-4 text-sm">{student.admissionNo}</td>
                    <td className="px-6 py-4">
                      <select
                        value={attendance[student.id]?.status ?? 'present'}
                        onChange={(e) =>
                          setAttendance({
                            ...attendance,
                            [student.id]: { ...attendance[student.id], status: e.target.value },
                          })
                        }
                        className="px-3 py-1 border border-gray-300 rounded text-sm"
                      >
                        <option value="present">Present</option>
                        <option value="absent">Absent</option>
                        <option value="late">Late</option>
                        <option value="excused">Excused</option>
                      </select>
                    </td>
                    <td className="px-6 py-4">
                      <input
                        type="text"
                        value={attendance[student.id]?.remark ?? ''}
                        onChange={(e) =>
                          setAttendance({
                            ...attendance,
                            [student.id]: { ...attendance[student.id], remark: e.target.value },
                          })
                        }
                        placeholder="Optional remark"
                        className="w-full px-3 py-1 border border-gray-300 rounded text-sm"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="px-6 py-4 bg-gray-50 flex justify-end">
              <button
                onClick={handleSaveAttendance}
                disabled={loading}
                className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:opacity-50 font-medium"
              >
                {loading ? 'Saving...' : 'Save Attendance'}
              </button>
            </div>
          </div>
        )}

        {selectedClass && students.length === 0 && !loading && (
          <div className="bg-yellow-50 border border-yellow-200 rounded p-4 text-yellow-800">No students in this class.</div>
        )}
      </div>
    </AppLayout>
  )
}

export default withAuth(TeacherMarkAttendancePage, { roles: ['Teacher'] })
