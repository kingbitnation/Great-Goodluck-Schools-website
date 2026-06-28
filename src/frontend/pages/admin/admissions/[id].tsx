import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import AppLayout from '../../../components/layout/AppLayout'
import { withAuth } from '../../../components/withAuth'
import { apiGet, apiPatch, apiPost } from '../../../lib/api'
import type { AuthUser } from '../../../lib/useAuth'

type ClassRow = { id: string; name: string }

type Application = {
  id: string
  referenceNo: string
  studentName: string
  parentName: string
  email: string
  phone?: string
  gradeApplied: string
  message?: string
  status: string
  examId?: string | null
  examScore?: number | null
  reviewNote?: string
  statusLogs: Array<{ toStatus: string; note?: string; createdAt: string }>
  interviews: Array<{
    id: string
    scheduledAt: string
    location?: string
    interviewer?: string
    outcome?: string
    notes?: string
  }>
  enrolledStudent?: { admissionNo: string; user: { firstName: string; lastName: string } }
}

function AdmissionDetailPage({ user }: { user: AuthUser }) {
  const router = useRouter()
  const id = String(router.query.id || '')
  const [app, setApp] = useState<Application | null>(null)
  const [classes, setClasses] = useState<ClassRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [examScore, setExamScore] = useState('')
  const [interviewForm, setInterviewForm] = useState({ scheduledAt: '', location: '', interviewer: '' })
  const [enrollClassId, setEnrollClassId] = useState('')
  const [actionMsg, setActionMsg] = useState('')

  function load() {
    if (!id) return
    Promise.all([apiGet<Application>(`/api/admissions/${id}`), apiGet<ClassRow[]>('/api/classes')])
      .then(([a, c]) => {
        setApp(a)
        setClasses(c)
        setExamScore(a.examScore != null ? String(a.examScore) : '')
        if (c.length) setEnrollClassId(c[0].id)
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [id])

  async function runAction(path: string, body: object = {}, method: 'POST' | 'PATCH' = 'POST') {
    setError('')
    setActionMsg('')
    try {
      if (method === 'PATCH') await apiPatch(path, body)
      else await apiPost(path, body)
      setActionMsg('Action completed')
      load()
    } catch (e: any) {
      setError(e.message || 'Action failed')
    }
  }

  if (loading) {
    return (
      <AppLayout user={user} title="Application">
        <div className="p-8">Loading…</div>
      </AppLayout>
    )
  }

  if (!app) {
    return (
      <AppLayout user={user} title="Application">
        <div className="p-8">Application not found</div>
      </AppLayout>
    )
  }

  return (
    <AppLayout user={user} title={`Application ${app.referenceNo}`}>
      <div className="mx-auto max-w-5xl space-y-6 p-8">
        <Link href="/admin/admissions" className="text-sm text-slate-500 hover:text-school-navy">
          ← Admissions
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">{app.studentName}</h1>
            <p className="font-mono text-sm text-slate-500">{app.referenceNo}</p>
            <p className="mt-1 text-sm capitalize text-school-navy">{app.status.replace(/_/g, ' ')}</p>
          </div>
        </div>

        {error && <div className="rounded bg-red-50 p-4 text-red-700">{error}</div>}
        {actionMsg && <div className="rounded bg-green-50 p-4 text-green-700">{actionMsg}</div>}

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="content-card space-y-3 p-6">
            <h2 className="font-semibold">Applicant details</h2>
            <p><span className="text-slate-500">Parent:</span> {app.parentName}</p>
            <p><span className="text-slate-500">Email:</span> {app.email}</p>
            <p><span className="text-slate-500">Phone:</span> {app.phone || '—'}</p>
            <p><span className="text-slate-500">Grade applied:</span> {app.gradeApplied}</p>
            {app.message && <p className="text-sm text-slate-600">{app.message}</p>}
            {app.enrolledStudent && (
              <p className="text-sm text-green-700">
                Enrolled as {app.enrolledStudent.user.firstName} {app.enrolledStudent.user.lastName} ({app.enrolledStudent.admissionNo})
              </p>
            )}
          </div>

          <div className="content-card space-y-3 p-6">
            <h2 className="font-semibold">Timeline</h2>
            <ul className="space-y-2 text-sm">
              {app.statusLogs.map((log, i) => (
                <li key={i} className="border-l-2 border-school-gold pl-3">
                  <span className="font-medium capitalize">{log.toStatus.replace(/_/g, ' ')}</span>
                  <span className="ml-2 text-slate-400">{new Date(log.createdAt).toLocaleString()}</span>
                  {log.note && <p className="text-slate-600">{log.note}</p>}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="content-card space-y-4 p-6">
          <h2 className="font-semibold">Actions</h2>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => runAction(`/api/admissions/${id}/accept`, { note: 'Welcome to our school' })} className="rounded bg-green-600 px-3 py-1.5 text-sm text-white">
              Accept
            </button>
            <button type="button" onClick={() => runAction(`/api/admissions/${id}/reject`, { note: 'Unable to offer a place this session' })} className="rounded bg-red-600 px-3 py-1.5 text-sm text-white">
              Reject
            </button>
            <button type="button" onClick={() => runAction(`/api/admissions/${id}/status`, { status: 'under_review' }, 'PATCH')} className="rounded border px-3 py-1.5 text-sm">
              Mark under review
            </button>
            <button type="button" onClick={() => runAction(`/api/admissions/${id}/status`, { status: 'waitlisted' }, 'PATCH')} className="rounded border px-3 py-1.5 text-sm">
              Waitlist
            </button>
          </div>

          <div className="border-t pt-4">
            <h3 className="mb-2 text-sm font-medium">Schedule entrance exam</h3>
            <button
              type="button"
              onClick={() => runAction(`/api/admissions/${id}/schedule-exam`, { title: `Entrance — ${app.studentName}` })}
              className="rounded bg-purple-600 px-3 py-1.5 text-sm text-white"
            >
              Create CBT entrance exam
            </button>
            {app.examId && <p className="mt-2 text-xs text-slate-500">Exam ID: {app.examId}</p>}
            <div className="mt-3 flex items-end gap-2">
              <div>
                <label className="mb-1 block text-xs">Exam score</label>
                <input value={examScore} onChange={(e) => setExamScore(e.target.value)} className="w-24 rounded border p-1.5 text-sm" />
              </div>
              <button
                type="button"
                onClick={() => runAction(`/api/admissions/${id}/exam-score`, { examScore: Number(examScore) })}
                className="rounded border px-3 py-1.5 text-sm"
              >
                Save score
              </button>
            </div>
          </div>

          <div className="border-t pt-4">
            <h3 className="mb-2 text-sm font-medium">Schedule interview</h3>
            <div className="grid gap-2 sm:grid-cols-3">
              <input
                type="datetime-local"
                value={interviewForm.scheduledAt}
                onChange={(e) => setInterviewForm({ ...interviewForm, scheduledAt: e.target.value })}
                className="rounded border p-2 text-sm"
              />
              <input
                placeholder="Location"
                value={interviewForm.location}
                onChange={(e) => setInterviewForm({ ...interviewForm, location: e.target.value })}
                className="rounded border p-2 text-sm"
              />
              <input
                placeholder="Interviewer"
                value={interviewForm.interviewer}
                onChange={(e) => setInterviewForm({ ...interviewForm, interviewer: e.target.value })}
                className="rounded border p-2 text-sm"
              />
            </div>
            <button
              type="button"
              onClick={() => runAction(`/api/admissions/${id}/interviews`, interviewForm)}
              className="mt-2 rounded bg-indigo-600 px-3 py-1.5 text-sm text-white"
            >
              Schedule interview
            </button>
            {app.interviews.length > 0 && (
              <ul className="mt-3 space-y-1 text-sm text-slate-600">
                {app.interviews.map((iv) => (
                  <li key={iv.id}>
                    {new Date(iv.scheduledAt).toLocaleString()}
                    {iv.location ? ` · ${iv.location}` : ''}
                    {iv.outcome ? ` · ${iv.outcome}` : ''}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {app.status !== 'enrolled' && (
            <div className="border-t pt-4">
              <h3 className="mb-2 text-sm font-medium">Enroll student</h3>
              <div className="flex flex-wrap items-end gap-2">
                <select value={enrollClassId} onChange={(e) => setEnrollClassId(e.target.value)} className="rounded border p-2 text-sm">
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => {
                    if (!confirm('Create parent and student portal accounts from this application?')) return
                    runAction(`/api/admissions/${id}/enroll`, { classId: enrollClassId })
                  }}
                  className="rounded bg-school-navy px-4 py-2 text-sm text-white"
                >
                  Enroll & create accounts
                </button>
              </div>
              <p className="mt-2 text-xs text-slate-500">Creates parent (applicant email) and student portal logins; credentials emailed.</p>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  )
}

export default withAuth(AdmissionDetailPage, { roles: ['SuperAdmin', 'SchoolAdmin'] })
