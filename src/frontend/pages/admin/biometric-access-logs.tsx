import Link from 'next/link'
import { useEffect, useState } from 'react'
import { withAuth } from '../../components/withAuth'
import AppLayout from '../../components/layout/AppLayout'
import { apiGet } from '../../lib/api'
import type { AuthUser } from '../../lib/useAuth'

type AccessLog = {
  id: string
  eventType: string
  method: string
  personType: string
  personName: string
  direction: string | null
  matchScore: number | null
  status: string
  notes: string | null
  createdAt: string
  device: { name: string; location: string } | null
}

function AdminBiometricAccessLogsPage({ user }: { user: AuthUser }) {
  const [logs, setLogs] = useState<AccessLog[]>([])
  const [events, setEvents] = useState<AccessLog[]>([])
  const [tab, setTab] = useState<'access' | 'all'>('access')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadLogs()
    const interval = setInterval(loadLogs, 30000)
    return () => clearInterval(interval)
  }, [tab])

  async function loadLogs() {
    try {
      setLoading(true)
      if (tab === 'access') {
        setLogs(await apiGet<AccessLog[]>('/api/biometrics/access-logs'))
      } else {
        setEvents(await apiGet<AccessLog[]>('/api/biometrics/events?limit=200'))
      }
      setError('')
    } catch {
      setError('Failed to load logs')
    } finally {
      setLoading(false)
    }
  }

  const rows = tab === 'access' ? logs : events

  return (
    <AppLayout user={user} title="Access Logs">
      <div className="p-8 max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold">Access &amp; Scan Logs</h1>
            <p className="text-gray-600 mt-1">Gate access and biometric attendance events.</p>
          </div>
          <Link href="/admin/biometrics" className="px-4 py-2 border border-gray-300 rounded-lg text-sm">Dashboard</Link>
        </div>

        <div className="flex gap-2 mb-6">
          <button onClick={() => setTab('access')} className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'access' ? 'bg-blue-600 text-white' : 'bg-white border border-gray-300'}`}>Gate access</button>
          <button onClick={() => setTab('all')} className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'all' ? 'bg-blue-600 text-white' : 'bg-white border border-gray-300'}`}>All events</button>
        </div>

        {error && <div className="bg-red-100 text-red-700 p-4 rounded mb-4">{error}</div>}

        {loading ? (
          <div className="bg-white p-8 rounded-lg text-center text-gray-500">Loading...</div>
        ) : rows.length === 0 ? (
          <div className="bg-white p-8 rounded-lg text-center text-gray-600">No logs yet.</div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-x-auto">
            <table className="w-full min-w-[800px]">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Time</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Person</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Type</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Event</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Method</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Device</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm text-gray-600">{new Date(log.createdAt).toLocaleString()}</td>
                    <td className="px-6 py-4 text-sm font-medium">{log.personName}</td>
                    <td className="px-6 py-4 text-sm capitalize">{log.personType}</td>
                    <td className="px-6 py-4 text-sm capitalize">{log.eventType}{log.direction ? ` (${log.direction})` : ''}</td>
                    <td className="px-6 py-4 text-sm capitalize">{log.method}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{log.device?.name || '—'}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        log.status === 'granted' ? 'bg-green-100 text-green-800' : log.status === 'denied' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'
                      }`}>{log.status}</span>
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

export default withAuth(AdminBiometricAccessLogsPage, { roles: ['SuperAdmin', 'SchoolAdmin', 'BiometricManager'] })
