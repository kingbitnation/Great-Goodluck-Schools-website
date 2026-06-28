import { useState, useEffect } from 'react'
import { withAuth } from '../../components/withAuth'
import AppLayout from '../../components/layout/AppLayout'
import { apiGet } from '../../lib/api'
import type { AuthUser } from '../../lib/useAuth'

type TransportAllocation = {
  id: string
  route: { id: string; routeName: string; startPoint: string; endPoint: string; estimatedTime: string; stops: number }
  vehicle: { id: string; registrationNumber: string; vehicleType: string; capacity: number; driver: string; driverPhone: string }
  allocatedAt: string
  tracking?: {
    latitude: number
    longitude: number
    etaMinutes: number | null
    status: string
    updatedAt: string
  } | null
}

function StudentTransportPage({ user }: { user: AuthUser }) {
  const [allocation, setAllocation] = useState<TransportAllocation | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadAllocation()
    const interval = setInterval(loadAllocation, 30000)
    return () => clearInterval(interval)
  }, [])

  async function loadAllocation() {
    try {
      setLoading(true)
      const data = await apiGet<TransportAllocation>('/api/transport/my-allocation')
      setAllocation(data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AppLayout user={user} title="Transport">
      <div className="p-8 max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">My Transport Information</h1>

        {error && <div className="bg-red-100 text-red-700 p-4 rounded mb-4">{error}</div>}

        {loading ? (
          <div className="bg-white p-8 rounded-lg text-center text-gray-500">Loading allocation...</div>
        ) : allocation ? (
          <div className="space-y-6">
            {/* Route Card */}
            <div className="bg-white rounded-lg shadow p-8">
              <h2 className="text-2xl font-bold mb-6 text-gray-900">Your Route</h2>
              <div className="space-y-4">
                <div className="border-l-4 border-blue-600 pl-4">
                  <p className="text-sm text-gray-600 mb-1">Route Name</p>
                  <p className="text-xl font-bold text-gray-900">{allocation.route.routeName}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">From</p>
                    <p className="font-medium text-gray-900">{allocation.route.startPoint}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">To</p>
                    <p className="font-medium text-gray-900">{allocation.route.endPoint}</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Est. Time</p>
                    <p className="font-medium text-gray-900">{allocation.route.estimatedTime} mins</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Number of Stops</p>
                    <p className="font-medium text-gray-900">{allocation.route.stops}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Vehicle Card */}
            <div className="bg-white rounded-lg shadow p-8">
              <h2 className="text-2xl font-bold mb-6 text-gray-900">Your Vehicle</h2>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Registration Number</p>
                  <p className="text-2xl font-bold text-blue-600">{allocation.vehicle.registrationNumber}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-1">Vehicle Type</p>
                  <p className="text-2xl font-bold text-blue-600">{allocation.vehicle.vehicleType}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-1">Capacity</p>
                  <p className="text-lg font-medium text-gray-900">{allocation.vehicle.capacity} passengers</p>
                </div>
              </div>
            </div>

            {/* Live tracking */}
            {allocation.tracking && (
              <div className="bg-white rounded-lg shadow overflow-hidden">
                <div className="p-6 border-b border-gray-100 flex flex-wrap justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">Live Bus Tracking</h2>
                    <p className="text-gray-600 mt-1">ETA to your stop</p>
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-bold text-blue-600">
                      {allocation.tracking.etaMinutes != null ? `${allocation.tracking.etaMinutes} min` : '—'}
                    </p>
                    <span className={`inline-flex mt-1 px-3 py-1 rounded-full text-sm font-medium ${
                      allocation.tracking.status === 'en_route' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'
                    }`}>
                      {allocation.tracking.status === 'en_route' ? 'En route' : allocation.tracking.status}
                    </span>
                  </div>
                </div>
                <iframe
                  title="Bus location"
                  src={`https://www.openstreetmap.org/export/embed.html?bbox=${allocation.tracking.longitude - 0.02}%2C${allocation.tracking.latitude - 0.02}%2C${allocation.tracking.longitude + 0.02}%2C${allocation.tracking.latitude + 0.02}&layer=mapnik&marker=${allocation.tracking.latitude}%2C${allocation.tracking.longitude}`}
                  className="w-full h-64 border-0"
                  loading="lazy"
                />
                <p className="px-6 py-3 text-xs text-gray-500 bg-gray-50">
                  Last updated {new Date(allocation.tracking.updatedAt).toLocaleTimeString()} · Auto-refresh every 30s
                </p>
              </div>
            )}

            {/* Driver Info Card */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg shadow p-8">
              <h2 className="text-2xl font-bold mb-6 text-gray-900">Driver Information</h2>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Driver Name</p>
                    <p className="text-lg font-bold text-gray-900">{allocation.vehicle.driver}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-600 mb-1">Contact</p>
                    <p className="text-lg font-bold text-gray-900">{allocation.vehicle.driverPhone}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Safety Guidelines */}
            <div className="bg-white rounded-lg shadow p-8">
              <h3 className="text-lg font-bold mb-4 text-gray-900">Transport Safety Guidelines</h3>
              <ul className="space-y-3 text-sm text-gray-700">
                <li className="flex gap-3">
                  <span className="text-blue-600 font-bold">•</span>
                  <span>Always be punctual and ready before your vehicle arrives</span>
                </li>
                <li className="flex gap-3">
                  <span className="text-blue-600 font-bold">•</span>
                  <span>Sit safely and use seatbelts when provided</span>
                </li>
                <li className="flex gap-3">
                  <span className="text-blue-600 font-bold">•</span>
                  <span>Follow all instructions from the driver</span>
                </li>
                <li className="flex gap-3">
                  <span className="text-blue-600 font-bold">•</span>
                  <span>Do not distract the driver while driving</span>
                </li>
                <li className="flex gap-3">
                  <span className="text-blue-600 font-bold">•</span>
                  <span>Report any mechanical issues immediately</span>
                </li>
                <li className="flex gap-3">
                  <span className="text-blue-600 font-bold">•</span>
                  <span>Maintain discipline and courtesy to fellow passengers</span>
                </li>
              </ul>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-600 text-lg">You have not been allocated a transport route yet.</p>
            <p className="text-gray-500 text-sm mt-2">Please contact the school administration for transport allocation.</p>
          </div>
        )}
      </div>
    </AppLayout>
  )
}

export default withAuth(StudentTransportPage, { roles: ['Student'] })
