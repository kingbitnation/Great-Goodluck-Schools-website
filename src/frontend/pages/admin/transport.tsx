import Link from 'next/link'
import { useEffect, useState } from 'react'
import { withAuth } from '../../components/withAuth'
import AppLayout from '../../components/layout/AppLayout'
import { apiGet } from '../../lib/api'
import type { AuthUser } from '../../lib/useAuth'

type TransportStats = {
  routes: number
  vehicles: number
  drivers: number
  activeStudentAllocations: number
  totalSeats: number
  busesEnRoute: number
}

type LiveBus = {
  vehicleId: string
  latitude: number
  longitude: number
  etaMinutes: number | null
  status: string
  vehicle: { registrationNumber: string; driver: string }
}

function AdminTransportPage({ user }: { user: AuthUser }) {
  const [stats, setStats] = useState<TransportStats | null>(null)
  const [liveBuses, setLiveBuses] = useState<LiveBus[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadData()
    const interval = setInterval(loadData, 30000)
    return () => clearInterval(interval)
  }, [])

  async function loadData() {
    try {
      setLoading(true)
      const [statsData, liveData] = await Promise.all([
        apiGet<TransportStats>('/api/transport/stats'),
        apiGet<LiveBus[]>('/api/transport/live').catch(() => []),
      ])
      setStats(statsData)
      setLiveBuses(liveData)
      setError('')
    } catch {
      setError('Failed to load transport dashboard')
    } finally {
      setLoading(false)
    }
  }

  const utilization = stats && stats.totalSeats > 0
    ? Math.round((stats.activeStudentAllocations / stats.totalSeats) * 100)
    : 0

  return (
    <AppLayout user={user} title="Transport">
      <div className="p-8 max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold">Transport Dashboard</h1>
            <p className="text-gray-600 mt-1">Fleet overview, allocations, and live bus tracking.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/admin/transport-routes" className="btn-admin-sm">Routes</Link>
            <Link href="/admin/transport-vehicles" className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium">Vehicles</Link>
            <Link href="/admin/transport-allocations" className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium">Allocations</Link>
          </div>
        </div>

        {error && <div className="bg-red-100 text-red-700 p-4 rounded mb-4">{error}</div>}

        <div className="mb-6 rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-950">
          <p className="font-semibold">GPS / telematics note</p>
          <p className="mt-1 text-sky-900/90">
            Live map data comes from manual admin updates or browser geolocation on driver devices — not from built-in
            fleet hardware. For real-time telematics, integrate your provider and POST coordinates to the transport API.
          </p>
        </div>

        {loading && !stats ? (
          <div className="bg-white p-8 rounded-lg text-center text-gray-500">Loading...</div>
        ) : stats && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
              {[
                { label: 'Routes', value: stats.routes },
                { label: 'Vehicles', value: stats.vehicles },
                { label: 'Drivers', value: stats.drivers },
                { label: 'Students on buses', value: stats.activeStudentAllocations },
                { label: 'Seat utilization', value: `${utilization}%` },
                { label: 'Buses en route', value: stats.busesEnRoute },
              ].map((card) => (
                <div key={card.label} className="bg-white rounded-lg shadow p-4">
                  <p className="text-sm text-gray-500">{card.label}</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{card.value}</p>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-100">
                <h2 className="text-lg font-bold">Live fleet</h2>
                <p className="text-sm text-gray-500">GPS positions refresh every 30 seconds</p>
              </div>
              {liveBuses.length === 0 ? (
                <p className="p-8 text-center text-gray-500">No live bus locations reported.</p>
              ) : (
                <div className="divide-y">
                  {liveBuses.map((bus) => (
                    <div key={bus.vehicleId} className="px-6 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                      <div>
                        <p className="font-semibold text-gray-900">{bus.vehicle.registrationNumber}</p>
                        <p className="text-sm text-gray-600">Driver: {bus.vehicle.driver || '—'}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {bus.latitude.toFixed(4)}, {bus.longitude.toFixed(4)}
                        </p>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-sm text-gray-500">ETA</p>
                          <p className="text-xl font-bold text-school-royal">
                            {bus.etaMinutes != null ? `${bus.etaMinutes} min` : '—'}
                          </p>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                          bus.status === 'en_route' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'
                        }`}>
                          {bus.status === 'en_route' ? 'En route' : bus.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </AppLayout>
  )
}

export default withAuth(AdminTransportPage, { roles: ['SuperAdmin', 'SchoolAdmin', 'TransportManager'] })
