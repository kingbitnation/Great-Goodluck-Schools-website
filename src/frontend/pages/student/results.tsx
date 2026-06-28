import { useState, useEffect } from 'react'
import { withAuth } from '../../components/withAuth'
import AppLayout from '../../components/layout/AppLayout'
import { apiGet } from '../../lib/api'
import { fetchWithAuth } from '../../lib/auth'
import type { AuthUser } from '../../lib/useAuth'

interface Result {
  id: string
  subject: { name: string; code: string }
  totalScore: number
  grade: string
  gpa: number
  feedback?: string
  published: boolean
}

interface Transcript {
  student: {
    name: string
    admissionNo: string
    class: string
    email: string
  }
  results: Result[]
  summary: {
    totalResults: number
    averageScore: string
    averageGPA: string
  }
}

interface ReportCard {
  student: {
    name: string
    admissionNo: string
    class: string
    email: string
    dob?: string
  }
  results: Array<{
    subject: string
    code: string
    score: number
    grade: string
    gpa: number
    feedback?: string
  }>
  summary: {
    totalSubjects: number
    averageScore: string
    averageGrade: string
    totalGPA: string
  }
}

export default withAuth(function StudentResultsPage({ user }: { user: AuthUser }) {
  const [results, setResults] = useState<Result[]>([])
  const [transcript, setTranscript] = useState<Transcript | null>(null)
  const [reportCard, setReportCard] = useState<ReportCard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<'results' | 'transcript' | 'reportcard'>('results')
  const [studentId, setStudentId] = useState('')

  useEffect(() => {
    loadStudentResults()
  }, [])

  async function loadStudentResults() {
    try {
      setLoading(true)

      // First, get student ID
      const students = await apiGet<Array<{ id: string; user: { email: string } }>>('/api/students')
      const currentStudent = students.find(s => s.user.email === user?.email)

      if (!currentStudent) {
        setError('Student profile not found')
        return
      }
      setStudentId(currentStudent.id)

      // Get results
      const studentResults = await apiGet<Result[]>(`/api/results/student/${currentStudent.id}`)
      setResults(studentResults.filter(r => r.published))

      // Get transcript
      const transcriptData = await apiGet<Transcript>(`/api/transcripts/${currentStudent.id}`)
      setTranscript(transcriptData)

      // Get report card
      const reportCardData = await apiGet<ReportCard>(`/api/reportcards/${currentStudent.id}`)
      setReportCard(reportCardData)
    } catch (err) {
      setError('Failed to load results')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  async function downloadPDF(type: 'transcript' | 'reportcard') {
    if (!studentId) return
    const path = type === 'transcript' ? `/api/transcripts/${studentId}/pdf` : `/api/reportcards/${studentId}/pdf`
    const res = await fetchWithAuth(path)
    if (!res.ok) throw new Error('Download failed')
    const blob = await res.blob()
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${type}-${studentId}.pdf`
    link.click()
    window.URL.revokeObjectURL(url)
  }

  if (loading) return <AppLayout user={user} title="My Results"><div className="p-8">Loading...</div></AppLayout>

  return (
    <AppLayout user={user} title="My Results">
      <div className="p-8 max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">My Results</h1>

        {error && <div className="bg-red-100 text-red-700 p-4 rounded mb-4">{error}</div>}

        {/* Tabs */}
        <div className="flex gap-4 mb-6 border-b">
          <button
            onClick={() => setActiveTab('results')}
            className={`px-4 py-2 font-medium ${
              activeTab === 'results'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Results
          </button>
          <button
            onClick={() => setActiveTab('transcript')}
            className={`px-4 py-2 font-medium ${
              activeTab === 'transcript'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Transcript
          </button>
          <button
            onClick={() => setActiveTab('reportcard')}
            className={`px-4 py-2 font-medium ${
              activeTab === 'reportcard'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Report Card
          </button>
        </div>

        {/* Results Tab */}
        {activeTab === 'results' && (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            {results.length > 0 ? (
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-medium">Subject</th>
                    <th className="px-6 py-3 text-center text-sm font-medium">Score</th>
                    <th className="px-6 py-3 text-center text-sm font-medium">Grade</th>
                    <th className="px-6 py-3 text-center text-sm font-medium">GPA</th>
                    <th className="px-6 py-3 text-left text-sm font-medium">Feedback</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map(result => (
                    <tr key={result.id} className="border-b hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm">
                        {result.subject.name} ({result.subject.code})
                      </td>
                      <td className="px-6 py-4 text-center text-sm font-medium">{result.totalScore}</td>
                      <td className="px-6 py-4 text-center text-sm font-medium">
                        <span className="px-3 py-1 rounded-full bg-blue-100 text-blue-800">
                          {result.grade}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center text-sm">{result.gpa.toFixed(2)}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{result.feedback || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="p-6 text-center text-gray-600">No published results yet</div>
            )}
          </div>
        )}

        {/* Transcript Tab */}
        {activeTab === 'transcript' && transcript && (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="mb-6">
              <h2 className="text-2xl font-bold">{transcript.student.name}</h2>
              <p className="text-gray-600">Admission No: {transcript.student.admissionNo}</p>
              <p className="text-gray-600">Class: {transcript.student.class}</p>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-blue-50 p-4 rounded">
                <p className="text-sm text-gray-600">Total Subjects</p>
                <p className="text-2xl font-bold">{transcript.summary.totalResults}</p>
              </div>
              <div className="bg-green-50 p-4 rounded">
                <p className="text-sm text-gray-600">Average Score</p>
                <p className="text-2xl font-bold">{transcript.summary.averageScore}</p>
              </div>
              <div className="bg-purple-50 p-4 rounded">
                <p className="text-sm text-gray-600">Average GPA</p>
                <p className="text-2xl font-bold">{transcript.summary.averageGPA}</p>
              </div>
            </div>

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
                {transcript.results.map(result => (
                  <tr key={result.id} className="border-b">
                    <td className="px-6 py-4 text-sm">{result.subject.name}</td>
                    <td className="px-6 py-4 text-center text-sm font-medium">{result.totalScore}</td>
                    <td className="px-6 py-4 text-center text-sm">{result.grade}</td>
                    <td className="px-6 py-4 text-center text-sm">{result.gpa.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="mt-6">
              <button
                onClick={() => downloadPDF('transcript')}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
              >
                Download Transcript
              </button>
            </div>
          </div>
        )}

        {/* Report Card Tab */}
        {activeTab === 'reportcard' && reportCard && (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="mb-6">
              <h2 className="text-2xl font-bold">{reportCard.student.name}</h2>
              <p className="text-gray-600">Admission No: {reportCard.student.admissionNo}</p>
              <p className="text-gray-600">Class: {reportCard.student.class}</p>
            </div>

            <div className="grid grid-cols-4 gap-4 mb-6">
              <div className="bg-blue-50 p-4 rounded">
                <p className="text-sm text-gray-600">Subjects</p>
                <p className="text-2xl font-bold">{reportCard.summary.totalSubjects}</p>
              </div>
              <div className="bg-green-50 p-4 rounded">
                <p className="text-sm text-gray-600">Avg Score</p>
                <p className="text-2xl font-bold">{reportCard.summary.averageScore}</p>
              </div>
              <div className="bg-purple-50 p-4 rounded">
                <p className="text-sm text-gray-600">Avg Grade</p>
                <p className="text-2xl font-bold">{reportCard.summary.averageGrade}</p>
              </div>
              <div className="bg-yellow-50 p-4 rounded">
                <p className="text-sm text-gray-600">Total GPA</p>
                <p className="text-2xl font-bold">{reportCard.summary.totalGPA}</p>
              </div>
            </div>

            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-medium">Subject</th>
                  <th className="px-6 py-3 text-center text-sm font-medium">Code</th>
                  <th className="px-6 py-3 text-center text-sm font-medium">Score</th>
                  <th className="px-6 py-3 text-center text-sm font-medium">Grade</th>
                  <th className="px-6 py-3 text-center text-sm font-medium">GPA</th>
                </tr>
              </thead>
              <tbody>
                {reportCard.results.map((result, idx) => (
                  <tr key={idx} className="border-b">
                    <td className="px-6 py-4 text-sm">{result.subject}</td>
                    <td className="px-6 py-4 text-center text-sm">{result.code}</td>
                    <td className="px-6 py-4 text-center text-sm font-medium">{result.score}</td>
                    <td className="px-6 py-4 text-center text-sm">{result.grade}</td>
                    <td className="px-6 py-4 text-center text-sm">{result.gpa.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="mt-6">
              <button
                onClick={() => downloadPDF('reportcard')}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
              >
                Download Report Card
              </button>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  )
})
