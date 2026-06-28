import { useEffect, useState } from 'react'
import { withAuth } from '../../components/withAuth'
import AppLayout from '../../components/layout/AppLayout'
import { apiGet } from '../../lib/api'
import type { AuthUser } from '../../lib/useAuth'

type Result = {
  id: string
  totalScore: number
  grade: string
  gpa: number
  published: boolean
  student: { id: string; user: { firstName: string; lastName: string } }
  subject: { name: string; code: string }
}

type Child = {
  id: string
  user: { firstName: string; lastName: string }
  class: { name: string }
}

function ParentResultsPage({ user }: { user: AuthUser }) {
  const [children, setChildren] = useState<Child[]>([])
  const [selectedChild, setSelectedChild] = useState<string>('')
  const [results, setResults] = useState<Result[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function loadChildren() {
      try {
        const childrenData = await apiGet<Child[]>('/api/parents/children')
        setChildren(childrenData)
        if (childrenData.length > 0) {
          setSelectedChild(childrenData[0].id)
          loadResults(childrenData[0].id)
        }
      } catch (err) {
        setError('Failed to load children')
        console.error(err)
      }
    }
    loadChildren()
  }, [])

  async function loadResults(childId: string) {
    try {
      setLoading(true)
      const resultsData = await apiGet<Result[]>(`/api/results/student/${childId}`)
      setResults(resultsData.filter((r) => r.published))
    } catch (err) {
      setError('Failed to load results')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleChildChange = (childId: string) => {
    setSelectedChild(childId)
    loadResults(childId)
  }

  const selectedChildData = children.find((c) => c.id === selectedChild)
  const totalScore = results.reduce((sum, r) => sum + r.totalScore, 0)
  const averageScore = results.length > 0 ? (totalScore / results.length).toFixed(2) : '0'

  return (
    <AppLayout user={user} title="Children Results">
      <div className="p-8 max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Academic Results</h1>

        {error && <div className="bg-red-100 text-red-700 p-4 rounded mb-4">{error}</div>}

        {/* Child Selector */}
        <div className="bg-white p-6 rounded-lg shadow mb-6">
          <label className="block text-sm font-medium mb-2">Select Child</label>
          <select
            value={selectedChild}
            onChange={(e) => handleChildChange(e.target.value)}
            className="w-full md:w-64 px-3 py-2 border border-gray-300 rounded-md"
          >
            {children.map((child) => (
              <option key={child.id} value={child.id}>
                {child.user.firstName} {child.user.lastName} ({child.class.name})
              </option>
            ))}
          </select>
        </div>

        {/* Summary Cards */}
        {selectedChildData && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-white p-6 rounded-lg shadow">
              <p className="text-sm text-gray-600">Subjects Completed</p>
              <p className="text-3xl font-bold text-blue-600">{results.length}</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <p className="text-sm text-gray-600">Average Score</p>
              <p className="text-3xl font-bold text-green-600">{averageScore}%</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <p className="text-sm text-gray-600">Class</p>
              <p className="text-3xl font-bold text-purple-600">{selectedChildData.class.name}</p>
            </div>
          </div>
        )}

        {/* Results Table */}
        {loading ? (
          <div className="bg-white p-8 rounded-lg text-center text-gray-500">Loading results...</div>
        ) : results.length === 0 ? (
          <div className="bg-white p-8 rounded-lg text-center text-gray-600">
            No published results available for this child yet.
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-medium">Subject</th>
                  <th className="px-6 py-3 text-center text-sm font-medium">Score</th>
                  <th className="px-6 py-3 text-center text-sm font-medium">Grade</th>
                  <th className="px-6 py-3 text-center text-sm font-medium">GPA</th>
                </tr>
              </thead>
              <tbody>
                {results.map((result) => (
                  <tr key={result.id} className="border-b hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium">
                      {result.subject.name} ({result.subject.code})
                    </td>
                    <td className="px-6 py-4 text-center text-sm font-semibold">{result.totalScore}%</td>
                    <td className="px-6 py-4 text-center">
                      <span className="inline-block px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                        {result.grade}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center text-sm font-semibold">{result.gpa.toFixed(2)}</td>
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

export default withAuth(ParentResultsPage, { roles: ['Parent'] })
