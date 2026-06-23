import { useEffect, useState } from 'react'
import AppLayout from '../../components/layout/AppLayout'
import { withAuth } from '../../components/withAuth'
import { apiGet, apiPost } from '../../lib/api'
import type { AuthUser } from '../../lib/useAuth'

type School = {
  id: string
  name: string
  city?: string
  country?: string
  contactEmail?: string
  _count?: { students: number; teachers: number; classes: number }
}

function SchoolsPage({ user }: { user: AuthUser }) {
  const [schools, setSchools] = useState<School[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [city, setCity] = useState('')
  const [creating, setCreating] = useState(false)

  function load() {
    setLoading(true)
    apiGet<School[]>('/api/schools')
      .then(setSchools)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setCreating(true)
    setError(null)
    try {
      await apiPost('/api/schools', { name, city })
      setName('')
      setCity('')
      load()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setCreating(false)
    }
  }

  return (
    <AppLayout user={user} title="Schools">
      <form onSubmit={handleCreate} className="mb-8 rounded-lg border border-gray-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">Add school</h2>
        <div className="flex flex-wrap gap-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="School name"
            className="flex-1 min-w-[200px] rounded-md border border-gray-300 px-3 py-2 text-sm"
            required
          />
          <input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="City"
            className="w-40 rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={creating}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {creating ? 'Creating...' : 'Create school'}
          </button>
        </div>
      </form>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {loading ? (
        <p className="text-gray-500">Loading schools...</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-500">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">City</th>
                <th className="px-4 py-3 font-medium">Students</th>
                <th className="px-4 py-3 font-medium">Teachers</th>
                <th className="px-4 py-3 font-medium">Classes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {schools.map((school) => (
                <tr key={school.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{school.name}</td>
                  <td className="px-4 py-3 text-gray-600">{school.city || '—'}</td>
                  <td className="px-4 py-3">{school._count?.students ?? 0}</td>
                  <td className="px-4 py-3">{school._count?.teachers ?? 0}</td>
                  <td className="px-4 py-3">{school._count?.classes ?? 0}</td>
                </tr>
              ))}
              {schools.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">No schools yet</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </AppLayout>
  )
}

export default withAuth(SchoolsPage, { roles: ['SuperAdmin'] })
