import { useState, useEffect } from 'react'
import { withAuth } from '../../components/withAuth'
import AppLayout from '../../components/layout/AppLayout'
import { apiGet, apiPost, apiPut } from '../../lib/api'
import type { AuthUser } from '../../lib/useAuth'

interface Result {
  id: string
  studentId: string
  subjectId: string
  totalScore: number
  grade: string
  published: boolean
  feedback?: string
  student: { user: { firstName: string; lastName: string }; id: string }
  subject: { name: string }
}

interface Subject {
  id: string
  name: string
  code: string
  class: { id: string; name: string }
  teacher?: { user?: { email: string } }
}

interface StudentGrade {
  id: string
  name: string
  score: number
  resultId?: string
  feedback: string
}

export default withAuth(function TeacherGradingPage({ user }: { user: AuthUser }) {
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [selectedSubject, setSelectedSubject] = useState<string>('')
  const [students, setStudents] = useState<StudentGrade[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadTeacherSubjects()
  }, [])

  async function loadTeacherSubjects() {
    try {
      setLoading(true)
      const allSubjects = await apiGet<Subject[]>('/api/subjects')
      // Filter subjects assigned to this teacher
      const teacherSubjects = allSubjects.filter(s => s.teacher?.user?.email === user?.email)
      setSubjects(teacherSubjects)
    } catch (err) {
      setError('Failed to load subjects')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  async function handleSelectSubject(subjectId: string) {
    try {
      setSelectedSubject(subjectId)
      setLoading(true)
      setError('')

      const subject = subjects.find(s => s.id === subjectId)
      if (!subject?.class?.id) {
        setError('This subject is not linked to a class')
        return
      }

      // Get all students in this class
      const allStudents = await apiGet<Array<{ id: string; user: { firstName: string; lastName: string } }>>(`/api/students?classId=${subject.class.id}`)
      
      // Get existing results for this subject
      const existingResults = await apiGet<Result[]>(`/api/results?subjectId=${subjectId}`)

      // Create student grades list
      const studentGrades = allStudents.map(s => {
        const result = existingResults.find(r => r.studentId === s.id)
        return {
          id: s.id,
          name: `${s.user.firstName} ${s.user.lastName}`,
          score: result?.totalScore || 0,
          resultId: result?.id,
          feedback: result?.feedback || '',
        }
      })

      setStudents(studentGrades)
    } catch (err) {
      setError('Failed to load students')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  async function handleSaveGrades() {
    if (!selectedSubject) {
      setError('Select a subject first')
      return
    }

    try {
      setSaving(true)
      setError('')

      for (const student of students) {
        if (student.score > 0) {
          if (student.resultId) {
            // Update existing result
            await apiPut(`/api/results/${student.resultId}`, {
              totalScore: student.score,
              feedback: student.feedback,
            })
          } else {
            // Create new result
            await apiPost('/api/results', {
              studentId: student.id,
              subjectId: selectedSubject,
              totalScore: student.score,
              feedback: student.feedback,
            })
          }
        }
      }

      setSuccess('Grades saved successfully!')
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError('Failed to save grades')
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  if (loading && !subjects.length) {
    return <AppLayout user={user} title="Grade Entry"><div className="p-8">Loading...</div></AppLayout>
  }

  return (
    <AppLayout user={user} title="Grade Entry">
      <div className="p-8 max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Enter Grades</h1>

        {error && <div className="bg-red-100 text-red-700 p-4 rounded mb-4">{error}</div>}
        {success && <div className="bg-green-100 text-green-700 p-4 rounded mb-4">{success}</div>}

        {/* Subject Selection */}
        <div className="bg-white p-6 rounded-lg shadow mb-6">
          <label className="block text-sm font-medium mb-2">Select Subject</label>
          <select
            value={selectedSubject}
            onChange={(e) => handleSelectSubject(e.target.value)}
            className="w-full p-3 border rounded"
          >
            <option value="">-- Choose a subject --</option>
            {subjects.map(s => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.code}) - {s.class.name}
              </option>
            ))}
          </select>
        </div>

        {/* Grades Table */}
        {selectedSubject && students.length > 0 && (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-medium">Student Name</th>
                  <th className="px-6 py-3 text-center text-sm font-medium">Score (0-100)</th>
                  <th className="px-6 py-3 text-left text-sm font-medium">Feedback</th>
                </tr>
              </thead>
              <tbody>
                {students.map(student => (
                  <tr key={student.id} className="border-b hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm">{student.name}</td>
                    <td className="px-6 py-4">
                      <input
                        type="number"
                        value={student.score}
                        onChange={(e) => {
                          const newScore = Math.min(100, Math.max(0, parseInt(e.target.value) || 0))
                          setStudents(students.map(s =>
                            s.id === student.id ? { ...s, score: newScore } : s
                          ))
                        }}
                        min="0"
                        max="100"
                        className="w-20 p-2 border rounded text-center"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <input
                        type="text"
                        value={student.feedback}
                        onChange={(e) => {
                          setStudents(students.map(s =>
                            s.id === student.id ? { ...s, feedback: e.target.value } : s
                          ))
                        }}
                        placeholder="Feedback"
                        className="w-full p-2 border rounded"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="px-6 py-4 bg-gray-50 flex justify-end">
              <button
                onClick={handleSaveGrades}
                disabled={saving}
                className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save All Grades'}
              </button>
            </div>
          </div>
        )}

        {selectedSubject && students.length === 0 && !loading && (
          <div className="bg-yellow-50 border border-yellow-200 rounded p-4 text-yellow-800">
            No students found in this class.
          </div>
        )}
      </div>
    </AppLayout>
  )
})
