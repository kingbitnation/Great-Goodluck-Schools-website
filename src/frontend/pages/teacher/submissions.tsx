import { useState, useEffect } from 'react'
import { withAuth } from '../../components/withAuth'
import AppLayout from '../../components/layout/AppLayout'
import { apiGet, apiPost } from '../../lib/api'
import type { AuthUser } from '../../lib/useAuth'

type Submission = {
  id: string
  fileUrl: string
  submittedAt: string
  grade?: number | null
  feedback?: string | null
  student: {
    id: string
    user: { firstName: string; lastName: string; email: string }
    class: { name: string }
  }
  assignment: {
    title: string
    subject: { name: string }
    totalMarks: number
  }
}

function TeacherSubmissionsPage({ user }: { user: AuthUser }) {
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [filteredSubmissions, setFilteredSubmissions] = useState<Submission[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [grading, setGrading] = useState<Record<string, { grade: number; feedback: string }>>({})
  const [filterStatus, setFilterStatus] = useState<'all' | 'graded' | 'pending'>('all')

  useEffect(() => {
    loadSubmissions()
  }, [])

  async function loadSubmissions() {
    try {
      setLoading(true)
      const data = await apiGet<Submission[]>('/api/submissions')
      setSubmissions(data)
      filterSubmissions(data, 'all')
    } catch (err) {
      setError('Failed to load submissions')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  function filterSubmissions(items: Submission[], status: 'all' | 'graded' | 'pending') {
    let filtered = items
    if (status === 'graded') {
      filtered = items.filter((s) => s.grade !== null && s.grade !== undefined)
    } else if (status === 'pending') {
      filtered = items.filter((s) => !s.grade && s.grade !== 0)
    }
    setFilteredSubmissions(filtered)
    setFilterStatus(status)
  }

  async function handleSubmitGrade(submissionId: string) {
    const grade = grading[submissionId]
    if (!grade || grade.grade === undefined || grade.grade < 0) {
      alert('Please enter a valid grade')
      return
    }

    try {
      await apiPost(`/api/submissions/${submissionId}/grade`, {
        grade: grade.grade,
        feedback: grade.feedback,
      })
      loadSubmissions()
      setGrading({ ...grading, [submissionId]: { grade: 0, feedback: '' } })
      alert('Grade submitted successfully!')
    } catch (err) {
      alert('Failed to submit grade')
      console.error(err)
    }
  }

  return (
    <AppLayout user={user} title="Grade Submissions">
      <div className="p-8 max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Grade Student Submissions</h1>

        {error && <div className="bg-red-100 text-red-700 p-4 rounded mb-4">{error}</div>}

        {/* Filter Tabs */}
        <div className="mb-6 flex gap-2 border-b">
          {['all', 'pending', 'graded'].map((status) => (
            <button
              key={status}
              onClick={() => filterSubmissions(submissions, status as 'all' | 'graded' | 'pending')}
              className={`px-4 py-2 font-medium capitalize ${
                filterStatus === status
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {status} ({submissions.filter((s) => {
                if (status === 'graded') return s.grade !== null && s.grade !== undefined
                if (status === 'pending') return !s.grade && s.grade !== 0
                return true
              }).length})
            </button>
          ))}
        </div>

        {loading ? (
          <div className="bg-white p-8 rounded-lg text-center text-gray-500">Loading submissions...</div>
        ) : filteredSubmissions.length === 0 ? (
          <div className="bg-white p-8 rounded-lg text-center text-gray-600">No submissions in this category.</div>
        ) : (
          <div className="space-y-4">
            {filteredSubmissions.map((submission) => (
              <div key={submission.id} className="border border-gray-200 rounded-lg p-6 bg-white">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                  <div>
                    <p className="text-xs text-gray-500 uppercase">Student</p>
                    <p className="font-semibold">{submission.student.user.firstName} {submission.student.user.lastName}</p>
                    <p className="text-sm text-gray-600">{submission.student.class.name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase">Assignment</p>
                    <p className="font-semibold">{submission.assignment.title}</p>
                    <p className="text-sm text-gray-600">{submission.assignment.subject.name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase">Submitted</p>
                    <p className="font-semibold">{new Date(submission.submittedAt).toLocaleDateString()}</p>
                    <p className="text-sm text-gray-600">{new Date(submission.submittedAt).toLocaleTimeString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase">Total Marks</p>
                    <p className="font-semibold text-lg">{submission.assignment.totalMarks}</p>
                  </div>
                </div>

                {/* Submission Link */}
                <div className="mb-4 p-4 bg-gray-50 rounded">
                  <a href={submission.fileUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                    📎 View Submission File
                  </a>
                </div>

                {/* Grading Form */}
                <div className="border-t pt-4 space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Score (out of {submission.assignment.totalMarks})</label>
                      <input
                        type="number"
                        min="0"
                        max={submission.assignment.totalMarks}
                        value={grading[submission.id]?.grade ?? submission.grade ?? ''}
                        onChange={(e) =>
                          setGrading({
                            ...grading,
                            [submission.id]: { ...grading[submission.id], grade: Number(e.target.value) },
                          })
                        }
                        placeholder="Enter grade"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Feedback</label>
                      <input
                        type="text"
                        value={grading[submission.id]?.feedback ?? submission.feedback ?? ''}
                        onChange={(e) =>
                          setGrading({
                            ...grading,
                            [submission.id]: { ...grading[submission.id], feedback: e.target.value },
                          })
                        }
                        placeholder="Optional feedback"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      />
                    </div>
                  </div>
                  <button
                    onClick={() => handleSubmitGrade(submission.id)}
                    className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 font-medium"
                  >
                    {submission.grade !== null && submission.grade !== undefined ? 'Update Grade' : 'Submit Grade'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  )
}

export default withAuth(TeacherSubmissionsPage, { roles: ['Teacher'] })
