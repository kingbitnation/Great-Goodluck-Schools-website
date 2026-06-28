import Link from 'next/link'
import { useEffect, useState } from 'react'
import { withAuth } from '../../components/withAuth'
import AppLayout from '../../components/layout/AppLayout'
import { apiGet, apiPost, apiPut, apiDelete } from '../../lib/api'
import type { AuthUser } from '../../lib/useAuth'

type Device = {
  id: string
  name: string
  location: string
  deviceType: string
  methods: string[]
  direction: string | null
  apiKey: string
  isActive: boolean
}

function AdminBiometricDevicesPage({ user }: { user: AuthUser }) {
  const [devices, setDevices] = useState<Device[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    location: '',
    deviceType: 'gate',
    methods: ['fingerprint', 'facial'],
    direction: 'both',
  })

  useEffect(() => {
    loadDevices()
  }, [])

  async function loadDevices() {
    try {
      setLoading(true)
      setDevices(await apiGet<Device[]>('/api/biometrics/devices'))
      setError('')
    } catch {
      setError('Failed to load devices')
    } finally {
      setLoading(false)
    }
  }

  async function handleCreate() {
    if (!formData.name || !formData.location) {
      setError('Name and location are required')
      return
    }
    try {
      await apiPost('/api/biometrics/devices', formData)
      setFormData({ name: '', location: '', deviceType: 'gate', methods: ['fingerprint', 'facial'], direction: 'both' })
      setShowForm(false)
      loadDevices()
    } catch {
      setError('Failed to create device')
    }
  }

  async function toggleActive(device: Device) {
    try {
      await apiPut(`/api/biometrics/devices/${device.id}`, { isActive: !device.isActive })
      loadDevices()
    } catch {
      setError('Failed to update device')
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this device?')) return
    try {
      await apiDelete(`/api/biometrics/devices/${id}`)
      loadDevices()
    } catch {
      setError('Failed to delete device')
    }
  }

  return (
    <AppLayout user={user} title="Biometric Devices">
      <div className="p-8 max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold">Biometric Devices</h1>
            <p className="text-gray-600 mt-1">Gate terminals and classroom scanners.</p>
          </div>
          <div className="flex gap-2">
            <Link href="/admin/biometrics" className="px-4 py-2 border border-gray-300 rounded-lg text-sm">Dashboard</Link>
            <button onClick={() => setShowForm(!showForm)} className="btn-admin-sm">
              {showForm ? 'Cancel' : 'Add device'}
            </button>
          </div>
        </div>

        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          <p className="font-semibold">Hardware integration note</p>
          <p className="mt-1 text-amber-900/90">
            SchoolPilot registers devices and accepts scan events via API. There is no built-in ZKTeco or vendor SDK —
            connect your terminals through middleware or POST scans to the biometric API using each device&apos;s API key.
          </p>
        </div>

        {error && <div className="bg-red-100 text-red-700 p-4 rounded mb-4">{error}</div>}

        {showForm && (
          <div className="bg-white rounded-lg shadow p-6 mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <input placeholder="Device name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="border border-gray-300 rounded-lg px-3 py-2" />
            <input placeholder="Location" value={formData.location} onChange={(e) => setFormData({ ...formData, location: e.target.value })} className="border border-gray-300 rounded-lg px-3 py-2" />
            <select value={formData.deviceType} onChange={(e) => setFormData({ ...formData, deviceType: e.target.value })} className="border border-gray-300 rounded-lg px-3 py-2">
              <option value="gate">Gate</option>
              <option value="classroom">Classroom</option>
              <option value="office">Office</option>
            </select>
            <select value={formData.direction} onChange={(e) => setFormData({ ...formData, direction: e.target.value })} className="border border-gray-300 rounded-lg px-3 py-2">
              <option value="both">Both directions</option>
              <option value="in">Entry only</option>
              <option value="out">Exit only</option>
            </select>
            <button onClick={handleCreate} className="md:col-span-2 btn-admin">Save device</button>
          </div>
        )}

        {loading ? (
          <div className="bg-white p-8 rounded-lg text-center text-gray-500">Loading...</div>
        ) : devices.length === 0 ? (
          <div className="bg-white p-8 rounded-lg text-center text-gray-600">No devices registered.</div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Name</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Location</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Type</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">API key</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Status</th>
                  <th className="px-6 py-3 text-center text-sm font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {devices.map((device) => (
                  <tr key={device.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium">{device.name}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{device.location}</td>
                    <td className="px-6 py-4 text-sm capitalize">{device.deviceType}</td>
                    <td className="px-6 py-4 text-xs font-mono text-gray-500">{device.apiKey}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${device.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                        {device.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center space-x-3">
                      <button onClick={() => toggleActive(device)} className="link-admin text-sm font-medium">{device.isActive ? 'Disable' : 'Enable'}</button>
                      <button onClick={() => handleDelete(device.id)} className="text-red-600 text-sm font-medium">Delete</button>
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

export default withAuth(AdminBiometricDevicesPage, { roles: ['SuperAdmin', 'SchoolAdmin', 'BiometricManager'] })
