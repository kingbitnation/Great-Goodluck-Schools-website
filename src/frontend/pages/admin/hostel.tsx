import Link from 'next/link'
import { useState, useEffect } from 'react'
import { withAuth } from '../../components/withAuth'
import AppLayout from '../../components/layout/AppLayout'
import { apiGet, apiPost, apiPut, apiDelete } from '../../lib/api'
import type { AuthUser } from '../../lib/useAuth'

type HostelRoom = {
  id: string
  roomNumber: string
  capacity: number
  occupancy: number
  buildingName: string
  floor: string
  costPerTerm: number
}

type HostelStats = {
  blocks: number
  totalRooms: number
  totalBeds: number
  occupiedBeds: number
  availableBeds: number
  occupancyRate: number
  blockBreakdown: Array<{ id: string; name: string; totalBeds: number; occupiedBeds: number }>
}

function AdminHostelPage({ user }: { user: AuthUser }) {
  const [rooms, setRooms] = useState<HostelRoom[]>([])
  const [stats, setStats] = useState<HostelStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    roomNumber: '',
    capacity: 2,
    buildingName: 'Block A',
    floor: '1',
    costPerTerm: 45000,
  })
  const [editingId, setEditingId] = useState<string | null>(null)

  useEffect(() => {
    loadRooms()
  }, [search])

  async function loadRooms() {
    try {
      setLoading(true)
      const q = search ? `?q=${encodeURIComponent(search)}` : ''
      const [roomData, statsData] = await Promise.all([
        apiGet<HostelRoom[]>(`/api/hostel/rooms${q}`),
        apiGet<HostelStats>('/api/hostel/stats').catch(() => null),
      ])
      setRooms(roomData)
      setStats(statsData)
      setError('')
    } catch (err) {
      setError('Failed to load hostel data')
    } finally {
      setLoading(false)
    }
  }

  async function handleSaveRoom() {
    if (!formData.roomNumber || !formData.buildingName) {
      setError('Room number and block name are required')
      return
    }
    try {
      const payload = {
        ...formData,
        capacity: Number(formData.capacity),
        costPerTerm: Number(formData.costPerTerm),
      }
      if (editingId) await apiPut(`/api/hostel/rooms/${editingId}`, payload)
      else await apiPost('/api/hostel/rooms', payload)
      setFormData({ roomNumber: '', capacity: 2, buildingName: 'Block A', floor: '1', costPerTerm: 45000 })
      setEditingId(null)
      setShowForm(false)
      loadRooms()
    } catch (err) {
      setError((err as Error).message || 'Failed to save room')
    }
  }

  async function handleDeleteRoom(id: string) {
    if (!confirm('Delete this room?')) return
    try {
      await apiDelete(`/api/hostel/rooms/${id}`)
      loadRooms()
    } catch (err) {
      setError((err as Error).message || 'Failed to delete room')
    }
  }

  return (
    <AppLayout user={user} title="Hostel Management">
      <div className="mx-auto max-w-7xl space-y-6 p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Hostel Management</h1>
            <p className="text-slate-600">Blocks, rooms, and occupancy overview.</p>
          </div>
          <div className="flex gap-2">
            <Link href="/admin/hostel-allocations" className="rounded border px-4 py-2 text-sm font-medium hover:bg-slate-50">
              Allocations
            </Link>
            <button type="button" onClick={() => setShowForm(!showForm)} className="rounded bg-school-navy px-4 py-2 text-sm font-medium text-white">
              {showForm ? 'Cancel' : 'Add Room'}
            </button>
          </div>
        </div>

        {stats && (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <div className="content-card p-4"><p className="text-xs text-slate-500">Blocks</p><p className="text-2xl font-bold">{stats.blocks}</p></div>
              <div className="content-card p-4"><p className="text-xs text-slate-500">Rooms</p><p className="text-2xl font-bold">{stats.totalRooms}</p></div>
              <div className="content-card p-4"><p className="text-xs text-slate-500">Total beds</p><p className="text-2xl font-bold">{stats.totalBeds}</p></div>
              <div className="content-card p-4"><p className="text-xs text-slate-500">Occupied</p><p className="text-2xl font-bold text-orange-700">{stats.occupiedBeds}</p></div>
              <div className="content-card p-4"><p className="text-xs text-slate-500">Occupancy</p><p className="text-2xl font-bold text-green-700">{stats.occupancyRate}%</p></div>
            </div>
            {stats.blockBreakdown.length > 0 && (
              <div className="grid gap-3 sm:grid-cols-2">
                {stats.blockBreakdown.map((b) => (
                  <div key={b.id} className="content-card p-4">
                    <p className="font-semibold">{b.name}</p>
                    <p className="text-sm text-slate-600">{b.occupiedBeds}/{b.totalBeds} beds occupied</p>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        <input
          type="search"
          placeholder="Search room or block..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border px-4 py-2"
        />

        {error && <div className="rounded border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>}

        {showForm && (
          <div className="content-card grid gap-3 p-4 sm:grid-cols-2">
            <input placeholder="Room number" value={formData.roomNumber} onChange={(e) => setFormData({ ...formData, roomNumber: e.target.value })} className="rounded border p-2" />
            <input placeholder="Block name" value={formData.buildingName} onChange={(e) => setFormData({ ...formData, buildingName: e.target.value })} className="rounded border p-2" />
            <input placeholder="Floor" value={formData.floor} onChange={(e) => setFormData({ ...formData, floor: e.target.value })} className="rounded border p-2" />
            <input type="number" placeholder="Capacity" value={formData.capacity} onChange={(e) => setFormData({ ...formData, capacity: Number(e.target.value) })} className="rounded border p-2" />
            <input type="number" placeholder="Cost per term" value={formData.costPerTerm} onChange={(e) => setFormData({ ...formData, costPerTerm: Number(e.target.value) })} className="rounded border p-2 sm:col-span-2" />
            <button type="button" onClick={handleSaveRoom} className="rounded bg-school-navy py-2 font-medium text-white sm:col-span-2">
              {editingId ? 'Update Room' : 'Add Room'}
            </button>
          </div>
        )}

        {loading ? (
          <div className="content-card p-8 text-center text-slate-500">Loading rooms...</div>
        ) : rooms.length === 0 ? (
          <div className="content-card p-8 text-center text-slate-600">No rooms found.</div>
        ) : (
          <div className="overflow-x-auto rounded-xl border bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left">
                <tr>
                  <th className="px-4 py-3">Room</th>
                  <th className="px-4 py-3">Block</th>
                  <th className="px-4 py-3">Floor</th>
                  <th className="px-4 py-3 text-center">Capacity</th>
                  <th className="px-4 py-3 text-center">Occupancy</th>
                  <th className="px-4 py-3 text-center">Fee/Term</th>
                  <th className="px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rooms.map((room) => (
                  <tr key={room.id} className="border-t">
                    <td className="px-4 py-3 font-medium">{room.roomNumber}</td>
                    <td className="px-4 py-3">{room.buildingName}</td>
                    <td className="px-4 py-3">{room.floor}</td>
                    <td className="px-4 py-3 text-center">{room.capacity}</td>
                    <td className="px-4 py-3 text-center">{room.occupancy}/{room.capacity}</td>
                    <td className="px-4 py-3 text-center">NGN {room.costPerTerm.toLocaleString()}</td>
                    <td className="px-4 py-3 text-center space-x-2">
                      <button type="button" onClick={() => { setFormData({ roomNumber: room.roomNumber, capacity: room.capacity, buildingName: room.buildingName, floor: room.floor, costPerTerm: room.costPerTerm }); setEditingId(room.id); setShowForm(true) }} className="text-blue-600 hover:underline">Edit</button>
                      <button type="button" onClick={() => handleDeleteRoom(room.id)} className="text-red-600 hover:underline">Delete</button>
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

export default withAuth(AdminHostelPage, { roles: ['SuperAdmin', 'SchoolAdmin', 'HostelManager'] })
