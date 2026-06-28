import { useState, useEffect } from 'react'
import { withAuth } from '../../components/withAuth'
import AppLayout from '../../components/layout/AppLayout'
import { apiGet, apiPost, apiPut, apiDelete } from '../../lib/api'
import type { AuthUser } from '../../lib/useAuth'

type CBTExam = {
  id: string
  title: string
  description: string
  subjectId: string
  subject?: { id: string; name: string }
  classId: string
  class?: { id: string; name: string }
  totalQuestions: number
  duration: number
  passingScore: number
  startDate: string
  endDate: string
  randomizeQuestions?: boolean
  randomizeOptions?: boolean
  published?: boolean
  status: 'draft' | 'active' | 'completed'
  createdAt: string
}

type Subject = {
  id: string
  name: string
}

type Class = {
  id: string
  name: string
}

function AdminCBTExamsPage({ user }: { user: AuthUser }) {
  const [exams, setExams] = useState<CBTExam[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [classes, setClasses] = useState<Class[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    subjectId: '',
    classId: '',
    duration: 60,
    passingScore: 40,
    startDate: '',
    endDate: '',
    randomizeQuestions: true,
    randomizeOptions: true,
    published: false,
  })
  const [editingId, setEditingId] = useState<string | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      setLoading(true)
      const [examData, subjData, classData] = await Promise.all([
        apiGet<CBTExam[]>('/api/cbt/exams'),
        apiGet<Subject[]>('/api/subjects'),
        apiGet<Class[]>('/api/classes'),
      ])
      setExams(examData)
      setSubjects(subjData)
      setClasses(classData)
    } catch (err) {
      setError('Failed to load data')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  async function handleSaveExam() {
    if (!formData.title || !formData.subjectId || !formData.classId) {
      setError('Title, subject, and class are required')
      return
    }

    try {
      if (editingId) {
        await apiPut(`/api/cbt/exams/${editingId}`, {
          ...formData,
          duration: parseInt(String(formData.duration)),
          passingScore: parseInt(String(formData.passingScore)),
        })
      } else {
        await apiPost('/api/cbt/exams', {
          ...formData,
          duration: parseInt(String(formData.duration)),
          passingScore: parseInt(String(formData.passingScore)),
        })
      }
      resetForm()
      loadData()
      alert(editingId ? 'Exam updated!' : 'Exam created!')
    } catch (err) {
      setError('Failed to save exam')
      console.error(err)
    }
  }

  function resetForm() {
    setFormData({
      title: '',
      description: '',
      subjectId: '',
      classId: '',
      duration: 60,
      passingScore: 40,
      startDate: '',
      endDate: '',
      randomizeQuestions: true,
      randomizeOptions: true,
      published: false,
    })
    setEditingId(null)
    setShowForm(false)
  }

  async function handleDeleteExam(id: string) {
    if (!confirm('Delete this exam? This will also delete all questions and student responses.')) return
    try {
      await apiDelete(`/api/cbt/exams/${id}`)
      loadData()
      alert('Exam deleted!')
    } catch (err) {
      setError('Failed to delete exam')
      console.error(err)
    }
  }

  function handleEditExam(exam: CBTExam) {
    setFormData({
      title: exam.title,
      description: exam.description,
      subjectId: exam.subjectId,
      classId: exam.classId,
      duration: exam.duration,
      passingScore: exam.passingScore,
      startDate: exam.startDate.split('T')[0],
      endDate: exam.endDate.split('T')[0],
      randomizeQuestions: exam.randomizeQuestions ?? true,
      randomizeOptions: exam.randomizeOptions ?? true,
      published: exam.published ?? exam.status === 'active',
    })
    setEditingId(exam.id)
    setShowForm(true)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft':
        return 'bg-gray-100 text-gray-800'
      case 'active':
        return 'bg-green-100 text-green-800'
      case 'completed':
        return 'bg-blue-100 text-blue-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <AppLayout user={user} title="CBT Exams">
      <div className="p-8 max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">CBT Exams</h1>
          <button
            onClick={() => {
              setShowForm(!showForm)
              resetForm()
            }}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 font-medium"
          >
            {showForm ? 'Cancel' : 'Create Exam'}
          </button>
        </div>

        {error && <div className="bg-red-100 text-red-700 p-4 rounded mb-4">{error}</div>}

        {/* Create/Edit Form */}
        {showForm && (
          <div className="bg-white p-6 rounded-lg shadow mb-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Exam Title</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g., Mathematics Final Exam"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Subject</label>
                <select
                  value={formData.subjectId}
                  onChange={(e) => setFormData({ ...formData, subjectId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option value="">Select subject...</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Class</label>
                <select
                  value={formData.classId}
                  onChange={(e) => setFormData({ ...formData, classId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option value="">Select class...</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Duration (minutes)</label>
                <input
                  type="number"
                  value={formData.duration}
                  onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Passing Score (%)</label>
                <input
                  type="number"
                  value={formData.passingScore}
                  onChange={(e) => setFormData({ ...formData, passingScore: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Description</label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Optional description"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={formData.randomizeQuestions}
                  onChange={(e) => setFormData({ ...formData, randomizeQuestions: e.target.checked })}
                />
                Randomize question order
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={formData.randomizeOptions}
                  onChange={(e) => setFormData({ ...formData, randomizeOptions: e.target.checked })}
                />
                Randomize answer options
              </label>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={formData.published}
                onChange={(e) => setFormData({ ...formData, published: e.target.checked })}
              />
              Publish exam (make available to students)
            </label>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Start Date</label>
                <input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">End Date</label>
                <input
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
            </div>
            <button
              onClick={handleSaveExam}
              className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 font-medium"
            >
              {editingId ? 'Update Exam' : 'Create Exam'}
            </button>
          </div>
        )}

        {/* Exams Table */}
        {loading ? (
          <div className="bg-white p-8 rounded-lg text-center text-gray-500">Loading exams...</div>
        ) : exams.length === 0 ? (
          <div className="bg-white p-8 rounded-lg text-center text-gray-600">No exams created yet.</div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Title</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Subject</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Class</th>
                  <th className="px-6 py-3 text-center text-sm font-semibold text-gray-900">Duration</th>
                  <th className="px-6 py-3 text-center text-sm font-semibold text-gray-900">Questions</th>
                  <th className="px-6 py-3 text-center text-sm font-semibold text-gray-900">Pass %</th>
                  <th className="px-6 py-3 text-center text-sm font-semibold text-gray-900">Status</th>
                  <th className="px-6 py-3 text-center text-sm font-semibold text-gray-900">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {exams.map((exam) => (
                  <tr key={exam.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{exam.title}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{exam.subject?.name || '-'}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{exam.class?.name || '-'}</td>
                    <td className="px-6 py-4 text-sm text-center text-gray-900">{exam.duration} mins</td>
                    <td className="px-6 py-4 text-sm text-center text-gray-900 font-medium">{exam.totalQuestions}</td>
                    <td className="px-6 py-4 text-sm text-center text-gray-900">{exam.passingScore}%</td>
                    <td className="px-6 py-4 text-sm text-center">
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(exam.status)}`}>
                        {exam.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-center space-x-2">
                      <a href={`/admin/cbt-questions?examId=${exam.id}`} className="text-blue-600 hover:underline font-medium">Questions</a>
                      <a href={`/admin/cbt-rankings?examId=${exam.id}`} className="text-purple-600 hover:underline font-medium">Rankings</a>
                      <a href={`/admin/cbt-grading?examId=${exam.id}`} className="text-amber-600 hover:underline font-medium">Grade</a>
                      <button
                        onClick={() => handleEditExam(exam)}
                        className="text-green-600 hover:text-green-900 font-medium"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteExam(exam.id)}
                        className="text-red-600 hover:text-red-900 font-medium"
                      >
                        Delete
                      </button>
                    </td>
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

export default withAuth(AdminCBTExamsPage, { roles: ['SuperAdmin', 'SchoolAdmin', 'Teacher'] })
