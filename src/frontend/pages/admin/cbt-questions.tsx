import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { withAuth } from '../../components/withAuth'
import AppLayout from '../../components/layout/AppLayout'
import { apiGet, apiPost, apiPut, apiDelete } from '../../lib/api'
import type { AuthUser } from '../../lib/useAuth'

type CBTQuestion = {
  id: string
  examId: string
  questionText: string
  questionType: 'multiple_choice' | 'true_false' | 'short_answer'
  options: string[]
  correctAnswer: string
  explanation?: string
  marks: number
  order: number
  createdAt: string
}

type CBTExam = {
  id: string
  title: string
}

function AdminCBTQuestionsPage({ user }: { user: AuthUser }) {
  const router = useRouter()
  const { examId } = router.query
  const [exam, setExam] = useState<CBTExam | null>(null)
  const [questions, setQuestions] = useState<CBTQuestion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    questionText: '',
    questionType: 'multiple_choice',
    option1: '',
    option2: '',
    option3: '',
    option4: '',
    correctAnswer: '',
    explanation: '',
    marks: 1,
  })
  const [editingId, setEditingId] = useState<string | null>(null)

  useEffect(() => {
    if (examId) {
      loadData()
    }
  }, [examId])

  async function loadData() {
    if (!examId) return
    try {
      setLoading(true)
      const [examData, qData] = await Promise.all([
        apiGet<CBTExam>(`/api/cbt/exams/${examId}`),
        apiGet<CBTQuestion[]>(`/api/cbt/questions?examId=${examId}`),
      ])
      setExam(examData)
      setQuestions(qData)
    } catch (err) {
      setError('Failed to load data')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  async function handleSaveQuestion() {
    if (!formData.questionText || !formData.correctAnswer) {
      setError('Question text and correct answer are required')
      return
    }

    try {
      const options =
        formData.questionType === 'true_false'
          ? ['True', 'False']
          : [formData.option1, formData.option2, formData.option3, formData.option4].filter((o) => o.trim())

      if (options.length < 2 && formData.questionType === 'multiple_choice') {
        setError('Multiple choice questions need at least 2 options')
        return
      }

      if (editingId) {
        await apiPut(`/api/cbt/questions/${editingId}`, {
          questionText: formData.questionText,
          questionType: formData.questionType,
          options,
          correctAnswer: formData.correctAnswer,
          explanation: formData.explanation,
          marks: parseInt(String(formData.marks)),
        })
      } else {
        await apiPost('/api/cbt/questions', {
          examId,
          questionText: formData.questionText,
          questionType: formData.questionType,
          options,
          correctAnswer: formData.correctAnswer,
          explanation: formData.explanation,
          marks: parseInt(String(formData.marks)),
        })
      }
      resetForm()
      loadData()
      alert(editingId ? 'Question updated!' : 'Question added!')
    } catch (err) {
      setError('Failed to save question')
      console.error(err)
    }
  }

  function resetForm() {
    setFormData({
      questionText: '',
      questionType: 'multiple_choice',
      option1: '',
      option2: '',
      option3: '',
      option4: '',
      correctAnswer: '',
      explanation: '',
      marks: 1,
    })
    setEditingId(null)
    setShowForm(false)
  }

  async function handleDeleteQuestion(id: string) {
    if (!confirm('Delete this question?')) return
    try {
      await apiDelete(`/api/cbt/questions/${id}`)
      loadData()
      alert('Question deleted!')
    } catch (err) {
      setError('Failed to delete question')
      console.error(err)
    }
  }

  function handleEditQuestion(question: CBTQuestion) {
    setFormData({
      questionText: question.questionText,
      questionType: question.questionType,
      option1: question.options[0] || '',
      option2: question.options[1] || '',
      option3: question.options[2] || '',
      option4: question.options[3] || '',
      correctAnswer: question.correctAnswer,
      explanation: question.explanation || '',
      marks: question.marks,
    })
    setEditingId(question.id)
    setShowForm(true)
  }

  if (!examId) return <div>Loading...</div>

  return (
    <AppLayout user={user} title="CBT Questions">
      <div className="p-8 max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold">Questions: {exam?.title}</h1>
            <p className="text-gray-600 mt-2">Total questions: {questions.length}</p>
          </div>
          <button
            onClick={() => {
              setShowForm(!showForm)
              resetForm()
            }}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 font-medium"
          >
            {showForm ? 'Cancel' : 'Add Question'}
          </button>
        </div>

        {error && <div className="bg-red-100 text-red-700 p-4 rounded mb-4">{error}</div>}

        {/* Add/Edit Form */}
        {showForm && (
          <div className="bg-white p-6 rounded-lg shadow mb-6 space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Question Type</label>
              <select
                value={formData.questionType}
                onChange={(e) => setFormData({ ...formData, questionType: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="multiple_choice">Multiple Choice</option>
                <option value="true_false">True/False</option>
                <option value="short_answer">Short Answer</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Question Text</label>
              <textarea
                value={formData.questionText}
                onChange={(e) => setFormData({ ...formData, questionText: e.target.value })}
                placeholder="Enter the question..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>

            {(formData.questionType === 'multiple_choice' || formData.questionType === 'true_false') && (
              <div>
                <label className="block text-sm font-medium mb-2">Options</label>
                {formData.questionType === 'multiple_choice' && (
                  <div className="space-y-2">
                    {[1, 2, 3, 4].map((i) => (
                      <input
                        key={i}
                        type="text"
                        value={formData[`option${i}`]}
                        onChange={(e) => setFormData({ ...formData, [`option${i}`]: e.target.value })}
                        placeholder={`Option ${i}`}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      />
                    ))}
                  </div>
                )}
                {formData.questionType === 'true_false' && (
                  <div className="text-sm text-gray-600">True/False options are automatically generated</div>
                )}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-2">Correct Answer</label>
              <input
                type="text"
                value={formData.correctAnswer}
                onChange={(e) => setFormData({ ...formData, correctAnswer: e.target.value })}
                placeholder="The correct answer"
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Marks</label>
                <input
                  type="number"
                  value={formData.marks}
                  onChange={(e) => setFormData({ ...formData, marks: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Explanation (Optional)</label>
                <input
                  type="text"
                  value={formData.explanation}
                  onChange={(e) => setFormData({ ...formData, explanation: e.target.value })}
                  placeholder="Why is this the correct answer?"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
            </div>
            <button
              onClick={handleSaveQuestion}
              className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 font-medium"
            >
              {editingId ? 'Update Question' : 'Add Question'}
            </button>
          </div>
        )}

        {/* Questions List */}
        {loading ? (
          <div className="bg-white p-8 rounded-lg text-center text-gray-500">Loading questions...</div>
        ) : questions.length === 0 ? (
          <div className="bg-white p-8 rounded-lg text-center text-gray-600">No questions added yet. Click "Add Question" to get started.</div>
        ) : (
          <div className="space-y-4">
            {questions.map((question, index) => (
              <div key={question.id} className="bg-white rounded-lg shadow p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <p className="text-sm text-gray-600">Question {index + 1}</p>
                    <p className="text-lg font-medium text-gray-900 mt-1">{question.questionText}</p>
                    <div className="mt-3 space-y-2">
                      {question.options.map((option, i) => (
                        <p
                          key={i}
                          className={`text-sm ${
                            option === question.correctAnswer
                              ? 'text-green-700 font-semibold bg-green-50 px-2 py-1 rounded'
                              : 'text-gray-600'
                          }`}
                        >
                          {option}
                        </p>
                      ))}
                    </div>
                    {question.explanation && (
                      <p className="text-sm text-blue-600 mt-3 italic">Explanation: {question.explanation}</p>
                    )}
                  </div>
                  <div className="ml-4 text-right">
                    <span className="inline-block bg-blue-100 text-blue-800 px-3 py-1 rounded text-sm font-medium">
                      {question.marks} mark{question.marks > 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
                <div className="flex justify-end gap-2 border-t pt-4">
                  <button
                    onClick={() => handleEditQuestion(question)}
                    className="text-blue-600 hover:text-blue-900 font-medium"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeleteQuestion(question.id)}
                    className="text-red-600 hover:text-red-900 font-medium"
                  >
                    Delete
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

export default withAuth(AdminCBTQuestionsPage, { roles: ['SuperAdmin', 'SchoolAdmin'] })
