import { useState, useEffect } from 'react'
import { withAuth } from '../../components/withAuth'
import AppLayout from '../../components/layout/AppLayout'
import { apiGet, apiPost, apiPut, apiDelete } from '../../lib/api'
import type { AuthUser } from '../../lib/useAuth'

type TransportRoute = {
  id: string
  routeName: string
  startPoint: string
  endPoint: string
  distance: number
  estimatedTime: string
  costPerTerm: number
  stops: number
  createdAt: string
}

function AdminTransportRoutesPage({ user }: { user: AuthUser }) {
  const [routes, setRoutes] = useState<TransportRoute[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    routeName: '',
    startPoint: '',
    endPoint: '',
    distance: 0,
    estimatedTime: '30',
    costPerTerm: 2000,
    stops: 0,
  })
  const [editingId, setEditingId] = useState<string | null>(null)

  useEffect(() => {
    loadRoutes()
  }, [])

  async function loadRoutes() {
    try {
      setLoading(true)
      const data = await apiGet<TransportRoute[]>('/api/transport/routes')
      setRoutes(data)
    } catch (err) {
      setError('Failed to load routes')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  async function handleSaveRoute() {
    if (!formData.routeName || !formData.startPoint || !formData.endPoint) {
      setError('All fields are required')
      return
    }

    try {
      if (editingId) {
        await apiPut(`/api/transport/routes/${editingId}`, {
          ...formData,
          distance: parseFloat(String(formData.distance)),
          costPerTerm: parseInt(String(formData.costPerTerm)),
          stops: parseInt(String(formData.stops)),
        })
      } else {
        await apiPost('/api/transport/routes', {
          ...formData,
          distance: parseFloat(String(formData.distance)),
          costPerTerm: parseInt(String(formData.costPerTerm)),
          stops: parseInt(String(formData.stops)),
        })
      }
      setFormData({ routeName: '', startPoint: '', endPoint: '', distance: 0, estimatedTime: '30', costPerTerm: 2000, stops: 0 })
      setEditingId(null)
      setShowForm(false)
      loadRoutes()
      alert(editingId ? 'Route updated!' : 'Route added!')
    } catch (err) {
      setError('Failed to save route')
      console.error(err)
    }
  }

  async function handleDeleteRoute(id: string) {
    if (!confirm('Delete this route?')) return
    try {
      await apiDelete(`/api/transport/routes/${id}`)
      loadRoutes()
      alert('Route deleted!')
    } catch (err) {
      setError('Failed to delete route')
      console.error(err)
    }
  }

  function handleEditRoute(route: TransportRoute) {
    setFormData({
      routeName: route.routeName,
      startPoint: route.startPoint,
      endPoint: route.endPoint,
      distance: route.distance,
      estimatedTime: route.estimatedTime,
      costPerTerm: route.costPerTerm,
      stops: route.stops,
    })
    setEditingId(route.id)
    setShowForm(true)
  }

  return (
    <AppLayout user={user} title="Transport Routes">
      <div className="p-8 max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Transport Routes</h1>
          <button
            onClick={() => {
              setShowForm(!showForm)
              setEditingId(null)
              setFormData({ routeName: '', startPoint: '', endPoint: '', distance: 0, estimatedTime: '30', costPerTerm: 2000, stops: 0 })
            }}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 font-medium"
          >
            {showForm ? 'Cancel' : 'Add Route'}
          </button>
        </div>

        {error && <div className="bg-red-100 text-red-700 p-4 rounded mb-4">{error}</div>}

        {/* Add/Edit Form */}
        {showForm && (
          <div className="bg-white p-6 rounded-lg shadow mb-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Route Name</label>
                <input
                  type="text"
                  value={formData.routeName}
                  onChange={(e) => setFormData({ ...formData, routeName: e.target.value })}
                  placeholder="e.g., Route A - City Center"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Start Point</label>
                <input
                  type="text"
                  value={formData.startPoint}
                  onChange={(e) => setFormData({ ...formData, startPoint: e.target.value })}
                  placeholder="e.g., School Gate"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">End Point</label>
                <input
                  type="text"
                  value={formData.endPoint}
                  onChange={(e) => setFormData({ ...formData, endPoint: e.target.value })}
                  placeholder="e.g., Lekki Phase 1"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Distance (km)</label>
                <input
                  type="number"
                  value={formData.distance}
                  onChange={(e) => setFormData({ ...formData, distance: parseFloat(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Est. Time (mins)</label>
                <input
                  type="number"
                  value={formData.estimatedTime}
                  onChange={(e) => setFormData({ ...formData, estimatedTime: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Stops</label>
                <input
                  type="number"
                  value={formData.stops}
                  onChange={(e) => setFormData({ ...formData, stops: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Cost/Term</label>
                <input
                  type="number"
                  value={formData.costPerTerm}
                  onChange={(e) => setFormData({ ...formData, costPerTerm: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
            </div>
            <button
              onClick={handleSaveRoute}
              className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 font-medium"
            >
              {editingId ? 'Update Route' : 'Add Route'}
            </button>
          </div>
        )}

        {/* Routes Table */}
        {loading ? (
          <div className="bg-white p-8 rounded-lg text-center text-gray-500">Loading routes...</div>
        ) : routes.length === 0 ? (
          <div className="bg-white p-8 rounded-lg text-center text-gray-600">No routes added yet.</div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Route Name</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">From → To</th>
                  <th className="px-6 py-3 text-center text-sm font-semibold text-gray-900">Distance</th>
                  <th className="px-6 py-3 text-center text-sm font-semibold text-gray-900">Time</th>
                  <th className="px-6 py-3 text-center text-sm font-semibold text-gray-900">Stops</th>
                  <th className="px-6 py-3 text-center text-sm font-semibold text-gray-900">Cost/Term</th>
                  <th className="px-6 py-3 text-center text-sm font-semibold text-gray-900">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {routes.map((route) => (
                  <tr key={route.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{route.routeName}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {route.startPoint} → {route.endPoint}
                    </td>
                    <td className="px-6 py-4 text-sm text-center text-gray-900">{route.distance} km</td>
                    <td className="px-6 py-4 text-sm text-center text-gray-600">{route.estimatedTime} mins</td>
                    <td className="px-6 py-4 text-sm text-center text-gray-600">{route.stops}</td>
                    <td className="px-6 py-4 text-sm text-center text-gray-900 font-medium">₦{route.costPerTerm.toLocaleString()}</td>
                    <td className="px-6 py-4 text-sm text-center space-x-2">
                      <button
                        onClick={() => handleEditRoute(route)}
                        className="text-blue-600 hover:text-blue-900 font-medium"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteRoute(route.id)}
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

export default withAuth(AdminTransportRoutesPage, { roles: ['SuperAdmin', 'SchoolAdmin', 'TransportManager'] })
