import { useState, useEffect } from 'react'
import { withAuth } from '../../components/withAuth'
import AppLayout from '../../components/layout/AppLayout'
import { apiGet } from '../../lib/api'
import type { AuthUser } from '../../lib/useAuth'

type HostelAllocation = {
  id: string
  roomId: string
  room: { id: string; roomNumber: string; buildingName: string; floor: string; capacity: number; costPerTerm: number }
  allocatedAt: string
  vacatedAt?: string | null
}

function StudentHostelPage({ user }: { user: AuthUser }) {
  const [allocation, setAllocation] = useState<HostelAllocation | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadAllocation()
  }, [])

  async function loadAllocation() {
    try {
      setLoading(true)
      const data = await apiGet<HostelAllocation>('/api/hostel/my-allocation')
      setAllocation(data)
    } catch (err) {
      // Student may not have an allocation
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AppLayout user={user} title="Hostel">
      <div className="p-8 max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">My Hostel Information</h1>

        {error && <div className="bg-red-100 text-red-700 p-4 rounded mb-4">{error}</div>}

        {loading ? (
          <div className="bg-white p-8 rounded-lg text-center text-gray-500">Loading allocation...</div>
        ) : allocation ? (
          <div className="space-y-6">
            {/* Room Details Card */}
            <div className="bg-white rounded-lg shadow p-8">
              <h2 className="text-2xl font-bold mb-6 text-gray-900">Your Room Allocation</h2>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Room Number</p>
                  <p className="text-2xl font-bold text-blue-600">{allocation.room.roomNumber}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-1">Building</p>
                  <p className="text-2xl font-bold text-blue-600">{allocation.room.buildingName}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-1">Floor</p>
                  <p className="text-2xl font-bold text-blue-600">{allocation.room.floor}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-1">Room Capacity</p>
                  <p className="text-2xl font-bold text-blue-600">{allocation.room.capacity} beds</p>
                </div>
              </div>

              {/* Cost Section */}
              <div className="mt-8 pt-8 border-t border-gray-200">
                <h3 className="text-lg font-semibold mb-4">Accommodation Fee</h3>
                <div className="bg-blue-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Cost per Term</p>
                  <p className="text-3xl font-bold text-blue-600">₦{allocation.room.costPerTerm.toLocaleString()}</p>
                </div>
              </div>

              {/* Allocation Date */}
              <div className="mt-8 pt-8 border-t border-gray-200">
                <p className="text-sm text-gray-600 mb-2">Allocated Since</p>
                <p className="text-lg font-medium text-gray-900">
                  {new Date(allocation.allocatedAt).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </p>
              </div>
            </div>

            {/* Rules Card */}
            <div className="bg-white rounded-lg shadow p-8">
              <h3 className="text-lg font-bold mb-4 text-gray-900">Hostel Rules & Guidelines</h3>
              <ul className="space-y-3 text-sm text-gray-700">
                <li className="flex gap-3">
                  <span className="text-blue-600 font-bold">•</span>
                  <span>Keep your room clean and tidy at all times</span>
                </li>
                <li className="flex gap-3">
                  <span className="text-blue-600 font-bold">•</span>
                  <span>Respect quiet hours: 10 PM - 6 AM</span>
                </li>
                <li className="flex gap-3">
                  <span className="text-blue-600 font-bold">•</span>
                  <span>No visitors allowed after 8 PM</span>
                </li>
                <li className="flex gap-3">
                  <span className="text-blue-600 font-bold">•</span>
                  <span>Report any maintenance issues immediately</span>
                </li>
                <li className="flex gap-3">
                  <span className="text-blue-600 font-bold">•</span>
                  <span>Comply with curfew regulations</span>
                </li>
                <li className="flex gap-3">
                  <span className="text-blue-600 font-bold">•</span>
                  <span>Do not bring prohibited items into the hostel</span>
                </li>
              </ul>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-600 text-lg">You have not been allocated a hostel room yet.</p>
            <p className="text-gray-500 text-sm mt-2">Please contact the school administration for hostel allocation.</p>
          </div>
        )}
      </div>
    </AppLayout>
  )
}

export default withAuth(StudentHostelPage, { roles: ['Student'] })
