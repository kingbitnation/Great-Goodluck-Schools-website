import { useState, useEffect } from 'react'
import { withAuth } from '../../components/withAuth'
import AppLayout from '../../components/layout/AppLayout'
import { apiGet } from '../../lib/api'
import type { AuthUser } from '../../lib/useAuth'

interface TimetableEntry {
  day: string
  startTime: string
  endTime: string
  subject: string
  teacher?: string
  room?: string
}

export default withAuth(function StudentTimetablePage({ user }: { user: AuthUser }) {
  const [timetable, setTimetable] = useState<TimetableEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const daysOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

  useEffect(() => {
    loadTimetable()
  }, [])

  async function loadTimetable() {
    try {
      setLoading(true)
      const timetableData = await apiGet<TimetableEntry[]>('/api/timetable')
      setTimetable(timetableData)
    } catch (err) {
      setError('Failed to load timetable')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <AppLayout user={user} title="My Timetable"><div className="p-8">Loading...</div></AppLayout>

  const groupedByDay = daysOrder.reduce((acc, day) => {
    acc[day] = timetable.filter(t => t.day === day)
    return acc
  }, {} as Record<string, TimetableEntry[]>)

  return (
    <AppLayout user={user} title="My Timetable">
      <div className="p-8 max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">My Timetable</h1>

        {error && <div className="bg-red-100 text-red-700 p-4 rounded mb-4">{error}</div>}

        <div className="space-y-6">
          {daysOrder.map(day => (
            <div key={day} className="bg-white rounded-lg shadow overflow-hidden">
              <div className="bg-blue-600 text-white px-6 py-3 font-bold">{day}</div>
              {groupedByDay[day]?.length > 0 ? (
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-6 py-3 text-left text-sm font-medium">Time</th>
                      <th className="px-6 py-3 text-left text-sm font-medium">Subject</th>
                      <th className="px-6 py-3 text-left text-sm font-medium">Teacher</th>
                      <th className="px-6 py-3 text-left text-sm font-medium">Room</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupedByDay[day].map((entry, idx) => (
                      <tr key={idx} className="border-b hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm font-medium">
                          {entry.startTime} - {entry.endTime}
                        </td>
                        <td className="px-6 py-4 text-sm">{entry.subject}</td>
                        <td className="px-6 py-4 text-sm">{entry.teacher || 'N/A'}</td>
                        <td className="px-6 py-4 text-sm">{entry.room || 'N/A'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="px-6 py-4 text-center text-gray-600">No classes scheduled</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </AppLayout>
  )
})
