import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/router'
import { withAuth } from '../../components/withAuth'
import AppLayout from '../../components/layout/AppLayout'
import { apiPost } from '../../lib/api'
import type { AuthUser } from '../../lib/useAuth'

type CBTExam = {
  id: string
  title: string
  duration: number
  totalQuestions: number
  passingScore: number
  description: string
}

type CBTQuestion = {
  id: string
  questionText: string
  questionType: 'multiple_choice' | 'true_false' | 'short_answer'
  options: string[]
  marks: number
}

type StartPayload = {
  exam: CBTExam
  questions: CBTQuestion[]
  secondsRemaining: number
  attempt: { tabSwitchCount: number }
}

function StudentCBTTestPage({ user }: { user: AuthUser }) {
  const router = useRouter()
  const { examId } = router.query
  const [exam, setExam] = useState<CBTExam | null>(null)
  const [questions, setQuestions] = useState<CBTQuestion[]>([])
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [testStarted, setTestStarted] = useState(false)
  const [timeLeft, setTimeLeft] = useState(0)
  const [submitted, setSubmitted] = useState(false)
  const [result, setResult] = useState<Record<string, unknown> | null>(null)
  const [violations, setViolations] = useState(0)
  const submitting = useRef(false)

  const handleSubmitTest = useCallback(async () => {
    if (!examId || submitting.current || submitted) return
    submitting.current = true
    try {
      const res = await apiPost(`/api/cbt/exams/${examId}/submit`, { answers })
      setResult(res)
      setSubmitted(true)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to submit test')
      submitting.current = false
    }
  }, [examId, answers, submitted])

  async function startTest() {
    if (!examId) return
    try {
      setLoading(true)
      const data = await apiPost<StartPayload>(`/api/cbt/exams/${examId}/start`, {})
      setExam(data.exam)
      setQuestions(data.questions)
      setTimeLeft(data.secondsRemaining)
      setViolations(data.attempt.tabSwitchCount)
      setTestStarted(true)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not start exam')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (examId) setLoading(false)
  }, [examId])

  useEffect(() => {
    if (!testStarted || submitted || timeLeft <= 0) return
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          handleSubmitTest()
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [testStarted, submitted, timeLeft, handleSubmitTest])

  useEffect(() => {
    if (!testStarted || submitted || !examId) return

    function onVisibility() {
      if (document.hidden) {
        apiPost(`/api/cbt/exams/${examId}/violation`, {}).then((r: { tabSwitchCount: number }) => {
          setViolations(r.tabSwitchCount)
        }).catch(() => {})
      }
    }

    function onBlur() {
      onVisibility()
    }

    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('blur', onBlur)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('blur', onBlur)
    }
  }, [testStarted, submitted, examId])

  useEffect(() => {
    if (!testStarted) return
    const block = (e: Event) => e.preventDefault()
    document.addEventListener('copy', block)
    document.addEventListener('cut', block)
    document.addEventListener('contextmenu', block)
    return () => {
      document.removeEventListener('copy', block)
      document.removeEventListener('cut', block)
      document.removeEventListener('contextmenu', block)
    }
  }, [testStarted])

  function handleAnswerChange(questionId: string, answer: string) {
    setAnswers({ ...answers, [questionId]: answer })
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  if (!examId || loading) {
    return <AppLayout user={user} title="CBT Test"><div className="p-8">Loading...</div></AppLayout>
  }

  if (submitted && result) {
    const percentage = Number(result.percentage ?? 0)
    const passed = Boolean(result.passed)
    return (
      <AppLayout user={user} title="Test Result">
        <div className="mx-auto max-w-2xl p-8">
          <div className="rounded-lg bg-white p-8 text-center shadow">
            <p className={`text-6xl font-bold ${passed ? 'text-green-600' : 'text-red-600'}`}>{percentage}%</p>
            <h1 className={`mt-2 text-3xl font-bold ${passed ? 'text-green-600' : 'text-red-600'}`}>
              {result.pendingManual ? 'Submitted' : passed ? 'Passed!' : 'Failed'}
            </h1>
            <p className="mt-4 text-gray-600">{String(result.message || '')}</p>
            {violations > 0 && (
              <p className="mt-2 text-sm text-amber-700">Tab switches recorded: {violations}</p>
            )}
            <button
              type="button"
              onClick={() => router.push('/student/cbt')}
              className="btn-gold mt-6"
            >
              Back to tests
            </button>
          </div>
        </div>
      </AppLayout>
    )
  }

  if (!testStarted) {
    return (
      <AppLayout user={user} title="Start Test">
        <div className="mx-auto max-w-2xl p-8">
          <div className="content-card p-8">
            <h1 className="text-3xl font-bold text-school-navy">Ready to begin?</h1>
            <p className="mt-4 text-slate-600">
              The timer starts when you click Start. Do not switch tabs — violations are logged.
              Copy/paste is disabled during the test.
            </p>
            {error && <p className="mt-4 text-red-600">{error}</p>}
            <button type="button" onClick={startTest} className="btn-gold mt-8 w-full py-3 text-lg">
              Start Test
            </button>
          </div>
        </div>
      </AppLayout>
    )
  }

  if (!exam || questions.length === 0) {
    return <AppLayout user={user} title="CBT Test"><div className="p-8 text-red-600">{error || 'No questions'}</div></AppLayout>
  }

  const question = questions[currentQuestion]

  return (
    <AppLayout user={user} title="Taking Test">
      <div className="mx-auto max-w-6xl p-8 select-none" onCopy={(e) => e.preventDefault()}>
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-white p-4 shadow">
          <h2 className="text-xl font-bold">{exam.title}</h2>
          <div className="flex items-center gap-4">
            {violations > 0 && (
              <span className="text-xs text-amber-700">Violations: {violations}</span>
            )}
            <div className={`text-2xl font-bold ${timeLeft < 300 ? 'text-red-600' : 'text-school-navy'}`}>
              {formatTime(timeLeft)}
            </div>
          </div>
        </div>

        {error && <div className="mb-4 rounded bg-red-50 p-4 text-red-700">{error}</div>}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
          <div className="lg:col-span-3">
            <div className="content-card p-8">
              <p className="text-sm text-slate-500">Question {currentQuestion + 1} of {questions.length}</p>
              <h3 className="mt-2 text-2xl font-bold text-school-navy">{question.questionText}</h3>

              <div className="mt-6 space-y-3">
                {question.questionType === 'short_answer' ? (
                  <textarea
                    rows={4}
                    className="w-full"
                    value={answers[question.id] || ''}
                    onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                    placeholder="Type your answer"
                  />
                ) : (
                  question.options.map((option, i) => (
                    <label key={i} className="flex cursor-pointer items-center rounded-lg border border-slate-200 p-4 hover:bg-slate-50">
                      <input
                        type="radio"
                        name={`q-${question.id}`}
                        value={option}
                        checked={answers[question.id] === option}
                        onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                        className="h-4 w-4"
                      />
                      <span className="ml-3">{option}</span>
                    </label>
                  ))
                )}
              </div>

              <div className="mt-8 flex justify-between gap-4">
                <button
                  type="button"
                  onClick={() => setCurrentQuestion(Math.max(0, currentQuestion - 1))}
                  disabled={currentQuestion === 0}
                  className="rounded-lg bg-slate-200 px-6 py-2 disabled:opacity-50"
                >
                  Previous
                </button>
                {currentQuestion < questions.length - 1 ? (
                  <button
                    type="button"
                    onClick={() => setCurrentQuestion(currentQuestion + 1)}
                    className="rounded-lg bg-school-navy px-6 py-2 text-white"
                  >
                    Next
                  </button>
                ) : (
                  <button type="button" onClick={handleSubmitTest} className="btn-gold px-6 py-2">
                    Submit Test
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="content-card p-4">
            <h4 className="mb-4 font-bold">Questions</h4>
            <div className="grid grid-cols-4 gap-2">
              {questions.map((q, i) => (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => setCurrentQuestion(i)}
                  className={`h-8 rounded text-sm font-medium ${
                    i === currentQuestion
                      ? 'bg-school-navy text-white'
                      : answers[q.id]
                        ? 'bg-green-100 text-green-800'
                        : 'bg-slate-200'
                  }`}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}

export default withAuth(StudentCBTTestPage, { roles: ['Student'] })
