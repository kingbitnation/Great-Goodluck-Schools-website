import { useState, useEffect } from 'react'
import { withAuth } from '../../components/withAuth'
import AppLayout from '../../components/layout/AppLayout'
import { apiGet, apiPost, apiDelete } from '../../lib/api'
import type { AuthUser } from '../../lib/useAuth'

type TransportAllocation = {
  id: string
  studentId: string
  student: { id: string; firstName: string; lastName: string; email: string; admissionNo: string }
  routeId: string
  route: { id: string; routeName: string }
  vehicleId: string
  vehicle: { id: string; registrationNumber: string }
  allocatedAt: string
  deallocatedAt?: string | null
}

type TransportRoute = {
  id: string
  routeName: string
}

type TransportVehicle = {
  id: string
  registrationNumber: string
  routeId: string
}

type Student = {
  id: string
  firstName: string
  lastName: string
  email: string
  admissionNo: string
}

function AdminTransportAllocationsPage({ user }: { user: AuthUser }) {
  const [allocations, setAllocations] = useState<TransportAllocation[]>([])
  const [routes, setRoutes] = useState<TransportRoute[]>([])
  const [vehicles, setVehicles] = useState<TransportVehicle[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    studentId: '',
    routeId: '',
    vehicleId: '',
  })

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      setLoading(true)
      const [allocData, routeData, vehData, studData] = await Promise.all([
        apiGet<TransportAllocation[]>('/api/transport/allocations'),
        apiGet<TransportRoute[]>('/api/transport/routes'),
        apiGet<TransportVehicle[]>('/api/transport/vehicles'),
        apiGet<Array<{ id: string; admissionNo: string; user: { firstName: string; lastName: string; email: string } }>>('/api/students'),
      ])
      setAllocations(allocData)
      setRoutes(routeData)
      setVehicles(vehData)
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
    if (!formData.studentId || !formData.routeId || !formData.vehicleId) {
      setError('All fields are required')
      return
    }

    try {
      await apiPost('/api/transport/allocations', {
        studentId: formData.studentId,
        routeId: formData.routeId,
        vehicleId: formData.vehicleId,
      })
      setFormData({ studentId: '', routeId: '', vehicleId: '' })
      setShowForm(false)
      loadData()
      alert('Student allocated to transport!')
    } catch (err) {
      setError('Failed to allocate student')
      console.error(err)
    }
  }

  async function handleDeallocate(allocationId: string) {
    if (!confirm('Remove this allocation?')) return
    try {
      await apiDelete(`/api/transport/allocations/${allocationId}`)
      loadData()
      alert('Allocation removed!')
    } catch (err) {
      setError('Failed to remove allocation')
      console.error(err)
    }
  }

  const activeAllocations = allocations.filter((a) => !a.deallocatedAt)
  const allocatedStudentIds = new Set(activeAllocations.map((a) => a.studentId))
  const availableStudents = students.filter((s) => !allocatedStudentIds.has(s.id))

  const vehiclesForRoute = formData.routeId
    ? vehicles.filter((v) => v.routeId === formData.routeId)
    : []

  return (
    <AppLayout user={user} title="Transport Allocations">
      <div className="p-8 max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Transport Allocations</h1>
          <button
            onClick={() => {
              setShowForm(!showForm)
              setFormData({ studentId: '', routeId: '', vehicleId: '' })
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
            <div>
              <label className="block text-sm font-medium mb-2">Select Route</label>
              <select
                value={formData.routeId}
                onChange={(e) => setFormData({ ...formData, routeId: e.target.value, vehicleId: '' })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="">Choose a route...</option>
                {routes.map((route) => (
                  <option key={route.id} value={route.id}>
                    {route.routeName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Select Vehicle</label>
              <select
                value={formData.vehicleId}
                onChange={(e) => setFormData({ ...formData, vehicleId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                disabled={!formData.routeId}
              >
                <option value="">Choose a vehicle...</option>
                {vehiclesForRoute.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>
                    {vehicle.registrationNumber}
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
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Route</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Vehicle</th>
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
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{alloc.route.routeName}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{alloc.vehicle.registrationNumber}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {new Date(alloc.allocatedAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-sm text-center">
                      <button
                        onClick={() => handleDeallocate(alloc.id)}
                        className="text-red-600 hover:text-red-900 font-medium"
                      >
                        Remove
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

export default withAuth(AdminTransportAllocationsPage, { roles: ['SuperAdmin', 'SchoolAdmin', 'TransportManager'] })
