import { useState, useEffect } from 'react'
import Link from 'next/link'
import { withAuth } from '../../components/withAuth'
import AppLayout from '../../components/layout/AppLayout'
import { apiGet, apiPost, apiPut, apiDelete } from '../../lib/api'
import type { AuthUser } from '../../lib/useAuth'

interface Result {
  id: string
  studentId: string
  subjectId: string
  examId?: string
  totalScore: number
  grade: string
  gpa: number
  percentile?: number
  feedback?: string
  published: boolean
  student: { user: { firstName: string; lastName: string }; class: { name: string } }
  subject: { name: string; code: string }
}

interface Subject {
  id: string
  name: string
  code: string
}

interface Student {
  id: string
  user: { firstName: string; lastName: string; email: string }
  class: { name: string; id?: string }
}

interface ClassRow {
  id: string
  name: string
}

export default withAuth(function ResultsPage({ user }: { user: AuthUser }) {
  const [results, setResults] = useState<Result[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [classes, setClasses] = useState<ClassRow[]>([])
  const [bulkClassId, setBulkClassId] = useState('')
  const [bulkPublishing, setBulkPublishing] = useState(false)
  const [bulkMessage, setBulkMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)

  const [form, setForm] = useState({
    studentId: '',
    subjectId: '',
    totalScore: '',
    feedback: '',
  })

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      setLoading(true)
      const [resResults, resSubjects, resStudents, resClasses] = await Promise.all([
        apiGet<Result[]>('/api/results'),
        apiGet<Subject[]>('/api/subjects'),
        apiGet<Student[]>('/api/students'),
        apiGet<ClassRow[]>('/api/classes'),
      ])
      setResults(resResults)
      setSubjects(resSubjects)
      setStudents(resStudents)
      setClasses(resClasses)
      if (resClasses.length) setBulkClassId(resClasses[0].id)
    } catch (err) {
      setError('Failed to load data')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  async function handleSaveResult() {
    if (!form.studentId || !form.subjectId || !form.totalScore) {
      setError('Please fill all required fields')
      return
    }

    try {
      if (editingId) {
        const updated = await apiPut(`/api/results/${editingId}`, {
          totalScore: parseFloat(form.totalScore),
          feedback: form.feedback,
        })
        setResults(results.map(r => (r.id === editingId ? updated : r)))
      } else {
        const created = await apiPost('/api/results', {
          studentId: form.studentId,
          subjectId: form.subjectId,
          totalScore: parseFloat(form.totalScore),
          feedback: form.feedback,
        })
        setResults([created, ...results])
      }
      setForm({ studentId: '', subjectId: '', totalScore: '', feedback: '' })
      setEditingId(null)
      setShowForm(false)
      setError('')
    } catch (err) {
      setError('Failed to save result')
      console.error(err)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this result?')) return
    try {
      await apiDelete(`/api/results/${id}`)
      setResults(results.filter(r => r.id !== id))
    } catch (err) {
      setError('Failed to delete result')
    }
  }

  async function handleBulkPublish() {
    if (!bulkClassId) {
      setError('Select a class to publish results for')
      return
    }
    if (!confirm('Publish all draft results for this class? Students and parents will be emailed.')) return
    try {
      setBulkPublishing(true)
      setBulkMessage('')
      const res = await apiPost<{ updated: number }>('/api/results/bulk-publish', { classId: bulkClassId })
      setBulkMessage(`Published ${res.updated} result(s). Notification emails queued.`)
      await loadData()
    } catch (err) {
      setError('Failed to bulk publish results')
      console.error(err)
    } finally {
      setBulkPublishing(false)
    }
  }

  async function handlePublish(id: string) {
    try {
      const updated = await apiPost(`/api/results/${id}/publish`, {})
      setResults(results.map(r => (r.id === id ? updated : r)))
    } catch (err) {
      setError('Failed to publish result')
    }
  }

  function handleEditResult(result: Result) {
    setForm({
      studentId: result.studentId,
      subjectId: result.subjectId,
      totalScore: result.totalScore.toString(),
      feedback: result.feedback || '',
    })
    setEditingId(result.id)
    setShowForm(true)
  }

  if (loading) return <AppLayout user={user} title="Results Management"><div className="p-8">Loading...</div></AppLayout>

  return (
    <AppLayout user={user} title="Results Management">
      <div className="p-8 max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Results Management</h1>

        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <p className="text-slate-600">Enter scores, publish to students, and view class rankings.</p>
          <Link
            href="/admin/broadsheets"
            className="rounded border border-school-navy px-4 py-2 text-sm font-medium text-school-navy hover:bg-slate-50"
          >
            View Broadsheets →
          </Link>
        </div>

        <div className="mb-8 rounded-lg border bg-slate-50 p-4">
          <h2 className="mb-3 text-lg font-semibold">Bulk publish by class</h2>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium">Class</label>
              <select
                value={bulkClassId}
                onChange={(e) => setBulkClassId(e.target.value)}
                className="min-w-[180px] rounded border p-2"
              >
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={handleBulkPublish}
              disabled={bulkPublishing || !bulkClassId}
              className="rounded bg-green-600 px-4 py-2 text-white hover:bg-green-700 disabled:opacity-50"
            >
              {bulkPublishing ? 'Publishing…' : 'Publish class results'}
            </button>
          </div>
          {bulkMessage && <p className="mt-3 text-sm text-green-700">{bulkMessage}</p>}
        </div>

        {error && <div className="bg-red-100 text-red-700 p-4 rounded mb-4">{error}</div>}

        {/* Form Section */}
        {showForm && (
          <div className="bg-white p-6 rounded-lg shadow mb-8">
            <h2 className="text-xl font-bold mb-4">{editingId ? 'Edit Result' : 'Add Result'}</h2>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium mb-1">Student</label>
                <select
                  value={form.studentId}
                  onChange={(e) => setForm({ ...form, studentId: e.target.value })}
                  disabled={!!editingId}
                  className="w-full p-2 border rounded"
                >
                  <option value="">Select Student</option>
                  {students.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.user.firstName} {s.user.lastName} ({s.class.name})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Subject</label>
                <select
                  value={form.subjectId}
                  onChange={(e) => setForm({ ...form, subjectId: e.target.value })}
                  disabled={!!editingId}
                  className="w-full p-2 border rounded"
                >
                  <option value="">Select Subject</option>
                  {subjects.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.code})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Score (0-100)</label>
                <input
                  type="number"
                  value={form.totalScore}
                  onChange={(e) => setForm({ ...form, totalScore: e.target.value })}
                  min="0"
                  max="100"
                  className="w-full p-2 border rounded"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Feedback</label>
                <input
                  type="text"
                  value={form.feedback}
                  onChange={(e) => setForm({ ...form, feedback: e.target.value })}
                  placeholder="Optional feedback"
                  className="w-full p-2 border rounded"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleSaveResult}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
              >
                Save Result
              </button>
              <button
                onClick={() => {
                  setShowForm(false)
                  setEditingId(null)
                  setForm({ studentId: '', subjectId: '', totalScore: '', feedback: '' })
                }}
                className="bg-gray-400 text-white px-4 py-2 rounded hover:bg-gray-500"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="bg-green-600 text-white px-4 py-2 rounded mb-4 hover:bg-green-700"
          >
            + Add Result
          </button>
        )}

        {/* Results Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-medium">Student</th>
                <th className="px-6 py-3 text-left text-sm font-medium">Subject</th>
                <th className="px-6 py-3 text-left text-sm font-medium">Score</th>
                <th className="px-6 py-3 text-left text-sm font-medium">Grade</th>
                <th className="px-6 py-3 text-left text-sm font-medium">GPA</th>
                <th className="px-6 py-3 text-left text-sm font-medium">Status</th>
                <th className="px-6 py-3 text-left text-sm font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {results.map(result => (
                <tr key={result.id} className="border-b hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm">
                    {result.student.user.firstName} {result.student.user.lastName}
                  </td>
                  <td className="px-6 py-4 text-sm">{result.subject.name}</td>
                  <td className="px-6 py-4 text-sm font-medium">{result.totalScore}</td>
                  <td className="px-6 py-4 text-sm font-medium">{result.grade}</td>
                  <td className="px-6 py-4 text-sm">{result.gpa.toFixed(2)}</td>
                  <td className="px-6 py-4 text-sm">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${result.published ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                      {result.published ? 'Published' : 'Draft'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm space-x-2">
                    <button
                      onClick={() => handleEditResult(result)}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      Edit
                    </button>
                    {!result.published && (
                      <button
                        onClick={() => handlePublish(result.id)}
                        className="text-green-600 hover:text-green-800"
                      >
                        Publish
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(result.id)}
                      className="text-red-600 hover:text-red-800"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppLayout>
  )
})
