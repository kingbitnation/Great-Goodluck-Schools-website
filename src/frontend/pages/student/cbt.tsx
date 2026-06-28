import { useState, useEffect } from 'react'
import Link from 'next/link'
import { withAuth } from '../../components/withAuth'
import AppLayout from '../../components/layout/AppLayout'
import { apiGet } from '../../lib/api'
import type { AuthUser } from '../../lib/useAuth'

type CBTExam = {
  id: string
  title: string
  description: string
  subject?: { id: string; name: string }
  duration: number
  passingScore: number
  startDate: string
  endDate: string
  status: 'draft' | 'active' | 'completed'
}

type CBTResult = {
  id: string
  examId: string
  exam: CBTExam
  score: number
  totalMarks: number
  percentage: number
  passed: boolean
  grade?: string
  submittedAt: string
}

function StudentCBTPage({ user }: { user: AuthUser }) {
  const [exams, setExams] = useState<CBTExam[]>([])
  const [results, setResults] = useState<CBTResult[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<'available' | 'results'>('available')

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      setLoading(true)
      const [examData, resultData] = await Promise.all([
        apiGet<CBTExam[]>('/api/cbt/available-exams'),
        apiGet<CBTResult[]>('/api/cbt/my-results'),
      ])
      setExams(examData)
      setResults(resultData)
    } catch (err) {
      setError('Failed to load data')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadge = (exam: CBTExam) => {
    const now = new Date()
    const start = new Date(exam.startDate)
    const end = new Date(exam.endDate)
    const taken = results.find((r) => r.examId === exam.id && r.grade !== 'Pending')

    if (taken) {
      return (
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${taken.passed ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {taken.passed ? 'Passed' : 'Failed'}
        </span>
      )
    }
    if (now < start) {
      return <span className="px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800">Not Started</span>
    }
    if (now > end) {
      return <span className="px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800">Expired</span>
    }
    return <span className="px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">Available</span>
  }

  return (
    <AppLayout user={user} title="CBT Tests">
      <div className="p-8 max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Online Tests</h1>

        {error && <div className="bg-red-100 text-red-700 p-4 rounded mb-4">{error}</div>}

        {/* Tabs */}
        <div className="mb-6 flex gap-4 border-b">
          <button
            onClick={() => setTab('available')}
            className={`px-4 py-2 font-medium ${
              tab === 'available'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Available Tests
          </button>
          <button
            onClick={() => setTab('results')}
            className={`px-4 py-2 font-medium ${
              tab === 'results'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            My Results ({results.length})
          </button>
        </div>

        {/* Available Tests */}
        {tab === 'available' && (
          <>
            {loading ? (
              <div className="bg-white p-8 rounded-lg text-center text-gray-500">Loading tests...</div>
            ) : exams.length === 0 ? (
              <div className="bg-white p-8 rounded-lg text-center text-gray-600">No tests available yet.</div>
            ) : (
              <div className="space-y-4">
                {exams.map((exam) => {
                  const taken = results.find((r) => r.examId === exam.id && r.grade !== 'Pending')
                  const now = new Date()
                  const start = new Date(exam.startDate)
                  const end = new Date(exam.endDate)
                  const canTake = now >= start && now <= end && !taken

                  return (
                    <div key={exam.id} className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h3 className="text-xl font-bold text-gray-900 mb-2">{exam.title}</h3>
                          <p className="text-gray-600 mb-3">{exam.description}</p>
                          <div className="grid grid-cols-4 gap-4 text-sm mb-4">
                            <div>
                              <p className="text-gray-600">Duration</p>
                              <p className="font-medium">{exam.duration} mins</p>
                            </div>
                            <div>
                              <p className="text-gray-600">Subject</p>
                              <p className="font-medium">{exam.subject?.name || '-'}</p>
                            </div>
                            <div>
                              <p className="text-gray-600">Passing Score</p>
                              <p className="font-medium">{exam.passingScore}%</p>
                            </div>
                            <div>
                              <p className="text-gray-600">Available Until</p>
                              <p className="font-medium">{new Date(exam.endDate).toLocaleDateString()}</p>
                            </div>
                          </div>
                        </div>
                        <div className="ml-4 text-right">
                          {getStatusBadge(exam)}
                          {canTake && (
                            <Link
                              href={`/student/cbt-test?examId=${exam.id}`}
                              className="mt-4 block w-full bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 font-medium text-center"
                            >
                              Take Test
                            </Link>
                          )}
                          {taken && (
                            <Link
                              href={`/student/cbt-result?examId=${exam.id}`}
                              className="mt-4 block w-full bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 font-medium text-center"
                            >
                              View Result
                            </Link>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}

        {/* Results */}
        {tab === 'results' && (
          <>
            {loading ? (
              <div className="bg-white p-8 rounded-lg text-center text-gray-500">Loading results...</div>
            ) : results.length === 0 ? (
              <div className="bg-white p-8 rounded-lg text-center text-gray-600">No test results yet.</div>
            ) : (
              <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Test Title</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Subject</th>
                      <th className="px-6 py-3 text-center text-sm font-semibold text-gray-900">Score</th>
                      <th className="px-6 py-3 text-center text-sm font-semibold text-gray-900">Percentage</th>
                      <th className="px-6 py-3 text-center text-sm font-semibold text-gray-900">Status</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Date Taken</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {results.map((result) => (
                      <tr key={result.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">{result.exam.title}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">{result.exam.subject?.name || '-'}</td>
                        <td className="px-6 py-4 text-sm text-center font-medium text-gray-900">
                          {result.score}/{result.totalMarks}
                        </td>
                        <td className="px-6 py-4 text-sm text-center font-bold text-gray-900">{result.percentage}%</td>
                        <td className="px-6 py-4 text-sm text-center">
                          <span
                            className={`px-3 py-1 rounded-full text-sm font-medium ${
                              result.passed ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {result.passed ? 'Passed' : 'Failed'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {new Date(result.submittedAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </AppLayout>
  )
}

export default withAuth(StudentCBTPage, { roles: ['Student'] })
