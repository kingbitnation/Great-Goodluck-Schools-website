import { useEffect, useState } from 'react'
import PublicLayout from '../components/layout/PublicLayout'
import { fetchPublic, type PublicStaff } from '../lib/publicApi'

export default function StaffPage() {
  const [staff, setStaff] = useState<PublicStaff[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchPublic<PublicStaff[]>('/api/public/staff')
      .then(setStaff)
      .finally(() => setLoading(false))
  }, [])

  return (
    <PublicLayout title="Staff Directory" subtitle="Meet our dedicated team">
      {loading ? (
        <p className="text-slate-500">Loading...</p>
      ) : staff.length === 0 ? (
        <p className="text-slate-600">Staff directory coming soon.</p>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {staff.map((s) => (
            <div key={s.id} className="border border-gray-200 dark:border-gray-800 rounded-lg p-5 bg-white dark:bg-gray-900">
              {s.photoUrl ? (
                <img src={s.photoUrl} alt={s.name} className="h-16 w-16 rounded-full object-cover mb-3" />
              ) : (
                <div className="h-16 w-16 rounded-full bg-school-navy text-school-gold flex items-center justify-center font-bold mb-3">
                  {s.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                </div>
              )}
              <p className="font-semibold text-gray-900 dark:text-white">{s.name}</p>
              <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">{s.role}</p>
              {s.dept && <p className="text-sm text-gray-500 mt-2">{s.dept}</p>}
            </div>
          ))}
        </div>
      )}
    </PublicLayout>
  )
}
