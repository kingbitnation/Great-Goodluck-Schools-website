import Link from 'next/link'
import { useEffect, useState } from 'react'
import { withAuth } from '../../components/withAuth'
import AppLayout from '../../components/layout/AppLayout'
import { apiGet } from '../../lib/api'
import type { AuthUser } from '../../lib/useAuth'

type AlumniProfile = {
  id: string
  fullName: string
  graduationYear?: number | null
  className?: string | null
  currentRole?: string | null
  company?: string | null
  city?: string | null
  openToMentor: boolean
}

function AlumniDirectoryPage({ user }: { user: AuthUser }) {
  const [profiles, setProfiles] = useState<AlumniProfile[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadProfiles()
  }, [search, user.schoolId])

  async function loadProfiles() {
    try {
      setLoading(true)
      const schoolId = user.schoolId
      const q = search ? `&q=${encodeURIComponent(search)}` : ''
      const path = user.role === 'Alumni' || user.role === 'SchoolAdmin' || user.role === 'SuperAdmin'
        ? `/api/alumni/profiles${search ? `?q=${encodeURIComponent(search)}` : ''}`
        : `/api/public/alumni/directory?schoolId=${schoolId}${q}`
      setProfiles(await apiGet<AlumniProfile[]>(path))
    } catch {
      setProfiles([])
    } finally {
      setLoading(false)
    }
  }

  return (
    <AppLayout user={user} title="Alumni Directory">
      <div className="p-8 max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold">Alumni Directory</h1>
            <p className="text-gray-600 mt-1">Connect with graduates of your school.</p>
          </div>
          <Link href="/alumni/join" className="text-sm text-blue-600 hover:underline">Join the network →</Link>
        </div>

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, company, or role..."
          className="w-full max-w-md border border-gray-300 rounded-lg px-4 py-2 mb-6"
        />

        {loading ? (
          <div className="text-gray-500">Loading...</div>
        ) : profiles.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center text-gray-600">No alumni found.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {profiles.map((p) => (
              <div key={p.id} className="bg-white rounded-lg shadow p-5">
                <h2 className="font-bold text-lg">{p.fullName}</h2>
                <p className="text-sm text-gray-500">
                  Class of {p.graduationYear || '—'}{p.className ? ` · ${p.className}` : ''}
                </p>
                {p.currentRole && <p className="text-sm mt-2">{p.currentRole}{p.company ? ` @ ${p.company}` : ''}</p>}
                {p.city && <p className="text-xs text-gray-500 mt-1">{p.city}</p>}
                {p.openToMentor && (
                  <span className="inline-block mt-3 px-2 py-1 bg-indigo-100 text-indigo-800 text-xs rounded-full">Open to mentor</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  )
}

export default withAuth(AlumniDirectoryPage, { roles: ['SuperAdmin', 'SchoolAdmin', 'Alumni', 'Student', 'Parent', 'Teacher'] })
