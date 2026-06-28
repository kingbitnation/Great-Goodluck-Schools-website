import Link from 'next/link'
import { useEffect, useState } from 'react'
import { withAuth } from '../../components/withAuth'
import AppLayout from '../../components/layout/AppLayout'
import { apiGet, apiPut } from '../../lib/api'
import type { AuthUser } from '../../lib/useAuth'

type BiometricStats = {
  devices: number
  enrollments: number
  studentEnrollments: number
  staffEnrollments: number
  scansToday: number
  accessLogsToday: number
  biometricAttendanceToday: number
}

type BiometricSettings = {
  fingerprintEnabled: boolean
  facialEnabled: boolean
  autoMarkAttendance: boolean
  accessControlEnabled: boolean
  minMatchScore: number
}

function AdminBiometricsPage({ user }: { user: AuthUser }) {
  const [stats, setStats] = useState<BiometricStats | null>(null)
  const [settings, setSettings] = useState<BiometricSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      setLoading(true)
      const [statsData, settingsData] = await Promise.all([
        apiGet<BiometricStats>('/api/biometrics/stats'),
        apiGet<BiometricSettings>('/api/biometrics/settings'),
      ])
      setStats(statsData)
      setSettings(settingsData)
      setError('')
    } catch {
      setError('Failed to load biometric dashboard')
    } finally {
      setLoading(false)
    }
  }

  async function saveSettings() {
    if (!settings) return
    try {
      setSaving(true)
      const updated = await apiPut<BiometricSettings>('/api/biometrics/settings', settings)
      setSettings(updated)
    } catch {
      setError('Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  return (
    <AppLayout user={user} title="Biometrics">
      <div className="p-8 max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold">Biometrics &amp; Access Control</h1>
            <p className="text-gray-600 mt-1">Fingerprint and facial recognition for attendance and gate access.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/admin/biometric-devices" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">Devices</Link>
            <Link href="/admin/biometric-enrollments" className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium">Enrollments</Link>
            <Link href="/admin/biometric-access-logs" className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium">Access Logs</Link>
          </div>
        </div>

        {error && <div className="bg-red-100 text-red-700 p-4 rounded mb-4">{error}</div>}

        {loading ? (
          <div className="bg-white p-8 rounded-lg text-center text-gray-500">Loading...</div>
        ) : (
          <>
            {stats && (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-8">
                {[
                  { label: 'Devices', value: stats.devices },
                  { label: 'Enrollments', value: stats.enrollments },
                  { label: 'Students', value: stats.studentEnrollments },
                  { label: 'Staff', value: stats.staffEnrollments },
                  { label: 'Scans today', value: stats.scansToday },
                  { label: 'Access logs', value: stats.accessLogsToday },
                  { label: 'Bio attendance', value: stats.biometricAttendanceToday },
                ].map((card) => (
                  <div key={card.label} className="bg-white rounded-lg shadow p-4">
                    <p className="text-sm text-gray-500">{card.label}</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">{card.value}</p>
                  </div>
                ))}
              </div>
            )}

            {settings && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-bold mb-4">School settings</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  {[
                    { key: 'fingerprintEnabled', label: 'Fingerprint recognition' },
                    { key: 'facialEnabled', label: 'Facial recognition' },
                    { key: 'autoMarkAttendance', label: 'Auto-mark attendance from classroom scans' },
                    { key: 'accessControlEnabled', label: 'Gate access control' },
                  ].map((item) => (
                    <label key={item.key} className="flex items-center gap-3 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={settings[item.key as keyof BiometricSettings] as boolean}
                        onChange={(e) => setSettings({ ...settings, [item.key]: e.target.checked })}
                        className="rounded border-gray-300"
                      />
                      {item.label}
                    </label>
                  ))}
                  <label className="block text-sm text-gray-700">
                    Minimum match score (0–1)
                    <input
                      type="number"
                      min={0.5}
                      max={1}
                      step={0.01}
                      value={settings.minMatchScore}
                      onChange={(e) => setSettings({ ...settings, minMatchScore: Number(e.target.value) })}
                      className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2"
                    />
                  </label>
                </div>
                <button
                  onClick={saveSettings}
                  disabled={saving}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
                >
                  {saving ? 'Saving...' : 'Save settings'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </AppLayout>
  )
}

export default withAuth(AdminBiometricsPage, { roles: ['SuperAdmin', 'SchoolAdmin', 'BiometricManager'] })
