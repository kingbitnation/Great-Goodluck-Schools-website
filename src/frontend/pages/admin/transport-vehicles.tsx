import { useState, useEffect } from 'react'
import { withAuth } from '../../components/withAuth'
import AppLayout from '../../components/layout/AppLayout'
import { apiGet, apiPost, apiPut, apiDelete } from '../../lib/api'
import type { AuthUser } from '../../lib/useAuth'

type TransportVehicle = {
  id: string
  registrationNumber: string
  vehicleType: string
  capacity: number
  driver: string
  driverPhone: string
  routeId: string
  route?: { id: string; routeName: string }
  status: 'active' | 'maintenance' | 'inactive'
  createdAt: string
}

type TransportRoute = {
  id: string
  routeName: string
}

function AdminTransportVehiclesPage({ user }: { user: AuthUser }) {
  const [vehicles, setVehicles] = useState<TransportVehicle[]>([])
  const [routes, setRoutes] = useState<TransportRoute[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    registrationNumber: '',
    vehicleType: 'Bus',
    capacity: 50,
    driver: '',
    driverPhone: '',
    routeId: '',
    status: 'active',
  })
  const [editingId, setEditingId] = useState<string | null>(null)
  const [gpsVehicleId, setGpsVehicleId] = useState<string | null>(null)
  const [gpsForm, setGpsForm] = useState({ latitude: '', longitude: '', etaMinutes: '', status: 'en_route' })

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      setLoading(true)
      const [vehData, routeData] = await Promise.all([
        apiGet<TransportVehicle[]>('/api/transport/vehicles'),
        apiGet<TransportRoute[]>('/api/transport/routes'),
      ])
      setVehicles(vehData)
      setRoutes(routeData)
    } catch (err) {
      setError('Failed to load data')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  async function handleSaveVehicle() {
    if (!formData.registrationNumber || !formData.driver || !formData.routeId) {
      setError('All fields are required')
      return
    }

    try {
      if (editingId) {
        await apiPut(`/api/transport/vehicles/${editingId}`, {
          ...formData,
          capacity: parseInt(String(formData.capacity)),
        })
      } else {
        await apiPost('/api/transport/vehicles', {
          ...formData,
          capacity: parseInt(String(formData.capacity)),
        })
      }
      resetForm()
      loadData()
      alert(editingId ? 'Vehicle updated!' : 'Vehicle added!')
    } catch (err) {
      setError('Failed to save vehicle')
      console.error(err)
    }
  }

  function resetForm() {
    setFormData({ registrationNumber: '', vehicleType: 'Bus', capacity: 50, driver: '', driverPhone: '', routeId: '', status: 'active' })
    setEditingId(null)
    setShowForm(false)
  }

  async function handleDeleteVehicle(id: string) {
    if (!confirm('Delete this vehicle?')) return
    try {
      await apiDelete(`/api/transport/vehicles/${id}`)
      loadData()
      alert('Vehicle deleted!')
    } catch (err) {
      setError('Failed to delete vehicle')
      console.error(err)
    }
  }

  const [message, setMessage] = useState('')

  async function handleUpdateGps() {
    if (!gpsVehicleId || !gpsForm.latitude || !gpsForm.longitude) {
      setError('Latitude and longitude are required')
      return
    }
    try {
      await apiPut(`/api/transport/vehicles/${gpsVehicleId}/location`, {
        latitude: Number(gpsForm.latitude),
        longitude: Number(gpsForm.longitude),
        etaMinutes: gpsForm.etaMinutes ? Number(gpsForm.etaMinutes) : undefined,
        status: gpsForm.status,
      })
      setGpsVehicleId(null)
      setGpsForm({ latitude: '', longitude: '', etaMinutes: '', status: 'en_route' })
      setMessage('GPS location updated for parents to track')
      setError('')
    } catch (err) {
      setError('Failed to update GPS location')
      console.error(err)
    }
  }

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported in this browser')
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsForm((f) => ({
          ...f,
          latitude: String(pos.coords.latitude),
          longitude: String(pos.coords.longitude),
        }))
      },
      () => setError('Could not get location — enter coordinates manually')
    )
  }

  function handleEditVehicle(vehicle: TransportVehicle) {
    setFormData({
      registrationNumber: vehicle.registrationNumber,
      vehicleType: vehicle.vehicleType,
      capacity: vehicle.capacity,
      driver: vehicle.driver,
      driverPhone: vehicle.driverPhone,
      routeId: vehicle.routeId,
      status: vehicle.status,
    })
    setEditingId(vehicle.id)
    setShowForm(true)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800'
      case 'maintenance':
        return 'bg-yellow-100 text-yellow-800'
      case 'inactive':
        return 'bg-gray-100 text-gray-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <AppLayout user={user} title="Transport Vehicles">
      <div className="p-8 max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Transport Vehicles</h1>
          <button
            onClick={() => {
              setShowForm(!showForm)
              resetForm()
            }}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 font-medium"
          >
            {showForm ? 'Cancel' : 'Add Vehicle'}
          </button>
        </div>

        {error && <div className="bg-red-100 text-red-700 p-4 rounded mb-4">{error}</div>}
        {message && <div className="bg-green-100 text-green-800 p-4 rounded mb-4">{message}</div>}

        {gpsVehicleId && (
          <div className="bg-white p-6 rounded-lg shadow mb-6 space-y-4 border border-blue-200">
            <h2 className="text-lg font-semibold">Update live GPS — {vehicles.find((v) => v.id === gpsVehicleId)?.registrationNumber}</h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <input type="number" step="any" placeholder="Latitude" value={gpsForm.latitude} onChange={(e) => setGpsForm({ ...gpsForm, latitude: e.target.value })} className="w-full px-3 py-2 border rounded-md" />
              <input type="number" step="any" placeholder="Longitude" value={gpsForm.longitude} onChange={(e) => setGpsForm({ ...gpsForm, longitude: e.target.value })} className="w-full px-3 py-2 border rounded-md" />
              <input type="number" placeholder="ETA (mins)" value={gpsForm.etaMinutes} onChange={(e) => setGpsForm({ ...gpsForm, etaMinutes: e.target.value })} className="w-full px-3 py-2 border rounded-md" />
              <select value={gpsForm.status} onChange={(e) => setGpsForm({ ...gpsForm, status: e.target.value })} className="w-full px-3 py-2 border rounded-md">
                <option value="en_route">En route</option>
                <option value="at_stop">At stop</option>
                <option value="idle">Idle</option>
              </select>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={useCurrentLocation} className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-gray-50">Use my location</button>
              <button type="button" onClick={handleUpdateGps} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">Publish location</button>
              <button type="button" onClick={() => setGpsVehicleId(null)} className="rounded-md px-4 py-2 text-sm text-gray-600 hover:underline">Cancel</button>
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-600">Total Vehicles</p>
            <p className="text-2xl font-bold text-blue-600">{vehicles.length}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-600">Active</p>
            <p className="text-2xl font-bold text-green-600">{vehicles.filter((v) => v.status === 'active').length}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-600">In Maintenance</p>
            <p className="text-2xl font-bold text-yellow-600">{vehicles.filter((v) => v.status === 'maintenance').length}</p>
          </div>
        </div>

        {/* Add/Edit Form */}
        {showForm && (
          <div className="bg-white p-6 rounded-lg shadow mb-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Registration Number</label>
                <input
                  type="text"
                  value={formData.registrationNumber}
                  onChange={(e) => setFormData({ ...formData, registrationNumber: e.target.value })}
                  placeholder="e.g., COGG-001"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Vehicle Type</label>
                <select
                  value={formData.vehicleType}
                  onChange={(e) => setFormData({ ...formData, vehicleType: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option>Bus</option>
                  <option>Minibus</option>
                  <option>Van</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Driver Name</label>
                <input
                  type="text"
                  value={formData.driver}
                  onChange={(e) => setFormData({ ...formData, driver: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Driver Phone</label>
                <input
                  type="tel"
                  value={formData.driverPhone}
                  onChange={(e) => setFormData({ ...formData, driverPhone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Route</label>
                <select
                  value={formData.routeId}
                  onChange={(e) => setFormData({ ...formData, routeId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option value="">Select a route...</option>
                  {routes.map((route) => (
                    <option key={route.id} value={route.id}>
                      {route.routeName}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Capacity</label>
                <input
                  type="number"
                  value={formData.capacity}
                  onChange={(e) => setFormData({ ...formData, capacity: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option>active</option>
                  <option>maintenance</option>
                  <option>inactive</option>
                </select>
              </div>
            </div>
            <button
              onClick={handleSaveVehicle}
              className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 font-medium"
            >
              {editingId ? 'Update Vehicle' : 'Add Vehicle'}
            </button>
          </div>
        )}

        {/* Vehicles Table */}
        {loading ? (
          <div className="bg-white p-8 rounded-lg text-center text-gray-500">Loading vehicles...</div>
        ) : vehicles.length === 0 ? (
          <div className="bg-white p-8 rounded-lg text-center text-gray-600">No vehicles added yet.</div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Reg. Number</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Type</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Driver</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Route</th>
                  <th className="px-6 py-3 text-center text-sm font-semibold text-gray-900">Capacity</th>
                  <th className="px-6 py-3 text-center text-sm font-semibold text-gray-900">Status</th>
                  <th className="px-6 py-3 text-center text-sm font-semibold text-gray-900">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {vehicles.map((vehicle) => (
                  <tr key={vehicle.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{vehicle.registrationNumber}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{vehicle.vehicleType}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {vehicle.driver}
                      <div className="text-xs text-gray-500">{vehicle.driverPhone}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{vehicle.route?.routeName || '-'}</td>
                    <td className="px-6 py-4 text-sm text-center text-gray-900 font-medium">{vehicle.capacity}</td>
                    <td className="px-6 py-4 text-sm text-center">
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(vehicle.status)}`}>
                        {vehicle.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-center space-x-2">
                      <button
                        type="button"
                        onClick={() => { setGpsVehicleId(vehicle.id); setMessage('') }}
                        className="text-emerald-600 hover:text-emerald-900 font-medium"
                      >
                        GPS
                      </button>
                      <button
                        onClick={() => handleEditVehicle(vehicle)}
                        className="text-blue-600 hover:text-blue-900 font-medium"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteVehicle(vehicle.id)}
                        className="text-red-600 hover:text-red-900 font-medium"
                      >
                        Delete
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

export default withAuth(AdminTransportVehiclesPage, { roles: ['SuperAdmin', 'SchoolAdmin', 'TransportManager'] })
