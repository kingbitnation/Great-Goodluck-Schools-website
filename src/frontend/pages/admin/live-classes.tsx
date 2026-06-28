import Link from 'next/link'
import { useEffect, useState } from 'react'
import AppLayout from '../../components/layout/AppLayout'
import { withAuth } from '../../components/withAuth'
import { apiGet, apiPost } from '../../lib/api'
import type { AuthUser } from '../../lib/useAuth'

type LiveClass = {
  id: string
  title: string
  description?: string | null
  status: string
  scheduledAt?: string | null
  className?: string | null
  subjectName?: string | null
  teacherName?: string | null
  attendanceCount?: number
}

function AdminLiveClassesPage({ user }: { user: AuthUser }) {
  const [classes, setClasses] = useState<LiveClass[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ title: '', description: '', scheduledAt: '' })

  async function load() {
    try {
      setLoading(true)
      const data = await apiGet<LiveClass[]>('/api/live-classes')
      setClasses(data)
    } catch {
      setError('Failed to load live classes')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title) return
    try {
      await apiPost('/api/live-classes', {
        title: form.title,
        description: form.description || null,
        scheduledAt: form.scheduledAt || null,
      })
      setForm({ title: '', description: '', scheduledAt: '' })
      load()
    } catch {
      setError('Failed to create live class')
    }
  }

  return (
    <AppLayout user={user} title="Live Classes">
      <div className="mx-auto max-w-5xl space-y-6">
        <p className="text-sm text-slate-600">
          Schedule and host live video classes with chat, whiteboard, attendance tracking, and recordings.
        </p>
        {error && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        <form onSubmit={handleCreate} className="content-card space-y-4 p-6">
          <h2 className="font-semibold text-school-navy">Schedule live class</h2>
          <input
            required
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Class title"
            className="w-full"
          />
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Description (optional)"
            rows={2}
            className="w-full"
          />
          <input
            type="datetime-local"
            value={form.scheduledAt}
            onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })}
            className="w-full"
          />
          <button type="submit" className="btn-gold">Create session</button>
        </form>

        {loading ? (
          <p className="text-slate-500">Loading...</p>
        ) : (
          <div className="space-y-3">
            {classes.map((c) => (
              <div key={c.id} className="content-card flex flex-wrap items-center justify-between gap-4 p-5">
                <div>
                  <p className="font-semibold text-school-navy">{c.title}</p>
                  <p className="text-sm text-slate-500">
                    {c.subjectName || 'General'} · {c.className || 'All classes'} ·{' '}
                    <span
                      className={
                        c.status === 'live' ? 'text-green-600' : c.status === 'ended' ? 'text-slate-500' : 'text-amber-600'
                      }
                    >
                      {c.status}
                    </span>
                    {c.scheduledAt && ` · ${new Date(c.scheduledAt).toLocaleString()}`}
                  </p>
                  <p className="text-xs text-slate-400">{c.attendanceCount ?? 0} attendees</p>
                </div>
                <Link href={`/live-class/${c.id}`} className="btn-gold text-sm">
                  {c.status === 'live' ? 'Join now' : c.status === 'ended' ? 'View session' : 'Open room'}
                </Link>
              </div>
            ))}
            {classes.length === 0 && (
              <p className="text-center text-slate-500">No live classes scheduled yet.</p>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  )
}

export default withAuth(AdminLiveClassesPage, { roles: ['SuperAdmin', 'SchoolAdmin', 'Teacher'] })
