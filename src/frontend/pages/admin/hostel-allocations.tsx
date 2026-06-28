import { useState, useEffect } from 'react'
import { withAuth } from '../../components/withAuth'
import AppLayout from '../../components/layout/AppLayout'
import { apiGet, apiPost } from '../../lib/api'
import type { AuthUser } from '../../lib/useAuth'

type HostelAllocation = {
  id: string
  roomId: string
  room: { id: string; roomNumber: string; buildingName: string; floor: string; capacity: number }
  studentId: string
  student: { id: string; firstName: string; lastName: string; email: string; admissionNo: string }
  sessionId: string
  termId: string
  allocatedAt: string
  vacatedAt?: string | null
  status?: string
}

type HostelRoom = {
  id: string
  roomNumber: string
  buildingName: string
  floor: string
  capacity: number
  occupancy: number
}

type Student = {
  id: string
  firstName: string
  lastName: string
  email: string
  admissionNo: string
}

function AdminHostelAllocationPage({ user }: { user: AuthUser }) {
  const [allocations, setAllocations] = useState<HostelAllocation[]>([])
  const [rooms, setRooms] = useState<HostelRoom[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    roomId: '',
    studentId: '',
  })

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      setLoading(true)
      const [allocData, roomData, studData] = await Promise.all([
        apiGet<HostelAllocation[]>('/api/hostel/allocations'),
        apiGet<HostelRoom[]>('/api/hostel/rooms'),
        apiGet<Array<{ id: string; admissionNo: string; user: { firstName: string; lastName: string; email: string } }>>('/api/students'),
      ])
      setAllocations(allocData)
      setRooms(roomData)
      setStudents(
        studData.map((s) => ({
          id: s.id,
          firstName: s.user.firstName,
          lastName: s.user.lastName,
          email: s.user.email,
          admissionNo: s.admissionNo,
        }))
      )
    } catch (err) {
      setError('Failed to load data')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  async function handleAllocate() {
    if (!formData.roomId || !formData.studentId) {
      setError('Room and student are required')
      return
    }

    try {
      await apiPost('/api/hostel/allocations', {
        roomId: formData.roomId,
        studentId: formData.studentId,
      })
      setFormData({ roomId: '', studentId: '' })
      setShowForm(false)
      loadData()
      alert('Student allocated to room!')
    } catch (err) {
      setError('Failed to allocate student')
      console.error(err)
    }
  }

  async function handleDeallocate(allocationId: string) {
    if (!confirm('Vacate this student from the room?')) return
    try {
      await apiPost(`/api/hostel/allocations/${allocationId}/vacate`, {})
      loadData()
    } catch (err) {
      setError((err as Error).message || 'Failed to vacate allocation')
    }
  }

  const activeAllocations = allocations.filter((a) => !a.vacatedAt && a.status !== 'vacated')
  const allocatedStudentIds = new Set(activeAllocations.map((a) => a.studentId))
  const availableStudents = students.filter((s) => !allocatedStudentIds.has(s.id))

  return (
    <AppLayout user={user} title="Hostel Allocations">
      <div className="p-8 max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Hostel Allocations</h1>
          <button
            onClick={() => {
              setShowForm(!showForm)
              setFormData({ roomId: '', studentId: '' })
            }}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 font-medium"
          >
            {showForm ? 'Cancel' : 'Allocate Student'}
          </button>
        </div>

        {error && <div className="bg-red-100 text-red-700 p-4 rounded mb-4">{error}</div>}

        {/* Allocation Form */}
        {showForm && (
          <div className="bg-white p-6 rounded-lg shadow mb-6 space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Select Room</label>
              <select
                value={formData.roomId}
                onChange={(e) => setFormData({ ...formData, roomId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="">Choose a room...</option>
                {rooms
                  .filter((r) => r.occupancy < r.capacity)
                  .map((room) => (
                    <option key={room.id} value={room.id}>
                      {room.roomNumber} - {room.buildingName} (Floor {room.floor}) - {room.occupancy}/{room.capacity}
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Select Student</label>
              <select
                value={formData.studentId}
                onChange={(e) => setFormData({ ...formData, studentId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="">Choose a student...</option>
                {availableStudents.map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.firstName} {student.lastName} ({student.admissionNo})
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={handleAllocate}
              className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 font-medium"
            >
              Allocate
            </button>
          </div>
        )}

        {/* Allocations Table */}
        {loading ? (
          <div className="bg-white p-8 rounded-lg text-center text-gray-500">Loading allocations...</div>
        ) : activeAllocations.length === 0 ? (
          <div className="bg-white p-8 rounded-lg text-center text-gray-600">No active allocations.</div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Student</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Admission No</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Room</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Building</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Floor</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Allocated Date</th>
                  <th className="px-6 py-3 text-center text-sm font-semibold text-gray-900">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {activeAllocations.map((alloc) => (
                  <tr key={alloc.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      {alloc.student.firstName} {alloc.student.lastName}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{alloc.student.admissionNo}</td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{alloc.room.roomNumber}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{alloc.room.buildingName}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{alloc.room.floor}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {new Date(alloc.allocatedAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-sm text-center">
                      <button
                        onClick={() => handleDeallocate(alloc.id)}
                        className="text-red-600 hover:text-red-900 font-medium"
                      >
                        Vacate
                      </button>
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

export default withAuth(AdminHostelAllocationPage, { roles: ['SuperAdmin', 'SchoolAdmin', 'HostelManager'] })
