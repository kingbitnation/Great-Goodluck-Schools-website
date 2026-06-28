import { useEffect, useState, useCallback } from 'react'
import { withAuth } from '../../components/withAuth'
import AppLayout from '../../components/layout/AppLayout'
import { apiGet } from '../../lib/api'
import type { AuthUser } from '../../lib/useAuth'

type Child = {
  id: string
  admissionNo: string
  user: { firstName: string; lastName: string }
}

type TrackingData = {
  id: string
  route: {
    routeName: string
    startPoint: string
    endPoint: string
    estimatedTime: string
    stops: number
  } | null
  vehicle: {
    registrationNumber: string
    vehicleType: string
    driver: string
    driverPhone: string
  } | null
  tracking: {
    latitude: number
    longitude: number
    etaMinutes: number | null
    status: string
    updatedAt: string
  } | null
}

function ParentTransportPage({ user }: { user: AuthUser }) {
  const [children, setChildren] = useState<Child[]>([])
  const [selectedChildId, setSelectedChildId] = useState('')
  const [tracking, setTracking] = useState<TrackingData | null>(null)
  const [loading, setLoading] = useState(true)
  const [trackingLoading, setTrackingLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function loadChildren() {
      try {
        setLoading(true)
        const data = await apiGet<Child[]>('/api/parents/children')
        setChildren(data)
        if (data.length > 0) setSelectedChildId(data[0].id)
      } catch {
        setError('Failed to load children')
      } finally {
        setLoading(false)
      }
    }
    loadChildren()
  }, [])

  const loadTracking = useCallback(async () => {
    if (!selectedChildId) return
    try {
      setTrackingLoading(true)
      const data = await apiGet<TrackingData | null>(`/api/transport/tracking/${selectedChildId}`)
      setTracking(data)
      setError('')
    } catch {
      setError('Failed to load bus tracking')
    } finally {
      setTrackingLoading(false)
    }
  }, [selectedChildId])

  useEffect(() => {
    loadTracking()
    const interval = setInterval(loadTracking, 30000)
    return () => clearInterval(interval)
  }, [loadTracking])

  const mapUrl = tracking?.tracking
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${tracking.tracking.longitude - 0.02}%2C${tracking.tracking.latitude - 0.02}%2C${tracking.tracking.longitude + 0.02}%2C${tracking.tracking.latitude + 0.02}&layer=mapnik&marker=${tracking.tracking.latitude}%2C${tracking.tracking.longitude}`
    : null

  return (
    <AppLayout user={user} title="Bus Tracking">
      <div className="p-8 max-w-5xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">School Bus Tracking</h1>
        <p className="text-gray-600 mb-6">Live location and ETA for your child&apos;s assigned bus.</p>

        {error && <div className="bg-red-100 text-red-700 p-4 rounded mb-4">{error}</div>}

        {loading ? (
          <div className="bg-white p-8 rounded-lg text-center text-gray-500">Loading...</div>
        ) : children.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center text-gray-600">No children linked to this account.</div>
        ) : (
          <div className="space-y-6">
            {children.length > 1 && (
              <div className="bg-white rounded-lg shadow p-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Select child</label>
                <select
                  value={selectedChildId}
                  onChange={(e) => setSelectedChildId(e.target.value)}
                  className="w-full md:w-64 border border-gray-300 rounded-lg px-3 py-2"
                >
                  {children.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.user.firstName} {c.user.lastName}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {trackingLoading && !tracking ? (
              <div className="bg-white p-8 rounded-lg text-center text-gray-500">Loading bus data...</div>
            ) : !tracking ? (
              <div className="bg-white rounded-lg shadow p-8 text-center text-gray-600">
                No active transport allocation for this child.
              </div>
            ) : (
              <>
                {tracking.tracking && (
                  <div className="bg-white rounded-lg shadow overflow-hidden">
                    <div className="p-6 border-b border-gray-100 flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <p className="text-sm text-gray-500">Estimated arrival</p>
                        <p className="text-3xl font-bold text-blue-600">
                          {tracking.tracking.etaMinutes != null ? `${tracking.tracking.etaMinutes} min` : '—'}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${
                          tracking.tracking.status === 'en_route' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'
                        }`}>
                          {tracking.tracking.status === 'en_route' ? 'En route' : tracking.tracking.status}
                        </span>
                        <p className="text-xs text-gray-500 mt-1">
                          Updated {new Date(tracking.tracking.updatedAt).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                    {mapUrl && (
                      <iframe
                        title="Bus location map"
                        src={mapUrl}
                        className="w-full h-72 border-0"
                        loading="lazy"
                      />
                    )}
                    <p className="px-6 py-3 text-xs text-gray-500 bg-gray-50">
                      Coordinates: {tracking.tracking.latitude.toFixed(4)}, {tracking.tracking.longitude.toFixed(4)} · Refreshes every 30s
                    </p>
                  </div>
                )}

                {tracking.route && (
                  <div className="bg-white rounded-lg shadow p-6">
                    <h2 className="text-lg font-bold mb-4">Route</h2>
                    <p className="text-xl font-semibold text-gray-900 mb-2">{tracking.route.routeName}</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div><span className="text-gray-500">From:</span> {tracking.route.startPoint}</div>
                      <div><span className="text-gray-500">To:</span> {tracking.route.endPoint}</div>
                      <div><span className="text-gray-500">Est. time:</span> {tracking.route.estimatedTime} mins</div>
                      <div><span className="text-gray-500">Stops:</span> {tracking.route.stops}</div>
                    </div>
                  </div>
                )}

                {tracking.vehicle && (
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg shadow p-6">
                    <h2 className="text-lg font-bold mb-4">Vehicle &amp; driver</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-600">Bus</p>
                        <p className="font-bold text-blue-700">{tracking.vehicle.registrationNumber}</p>
                        <p className="text-sm text-gray-600">{tracking.vehicle.vehicleType}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Driver</p>
                        <p className="font-bold">{tracking.vehicle.driver}</p>
                        <p className="text-sm">{tracking.vehicle.driverPhone}</p>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  )
}

export default withAuth(ParentTransportPage, { roles: ['Parent'] })
