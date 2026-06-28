import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import AppLayout from '../../components/layout/AppLayout'
import LiveChat from '../../components/liveclass/LiveChat'
import LiveWhiteboard from '../../components/liveclass/LiveWhiteboard'
import { withAuth } from '../../components/withAuth'
import { apiGet, apiPost, apiPut } from '../../lib/api'
import type { AuthUser } from '../../lib/useAuth'

type LiveClass = {
  id: string
  title: string
  description?: string | null
  status: string
  recordingUrl?: string | null
  attendanceCount?: number
}

type JoinInfo = {
  jitsiUrl: string
  canModerate: boolean
  status: string
}

type Attendance = {
  id: string
  joinedAt: string
  user: { firstName: string; lastName: string; role?: { name: string } }
}

function LiveClassRoomPage({ user }: { user: AuthUser }) {
  const router = useRouter()
  const id = String(router.query.id || '')
  const [liveClass, setLiveClass] = useState<LiveClass | null>(null)
  const [join, setJoin] = useState<JoinInfo | null>(null)
  const [attendance, setAttendance] = useState<Attendance[]>([])
  const [tab, setTab] = useState<'chat' | 'whiteboard' | 'attendance'>('chat')
  const [recordingUrl, setRecordingUrl] = useState('')
  const [error, setError] = useState('')
  const canModerate = ['SuperAdmin', 'SchoolAdmin', 'Teacher'].includes(user.role)

  useEffect(() => {
    if (!id) return
    async function load() {
      try {
        const [lc, j] = await Promise.all([
          apiGet<LiveClass>(`/api/live-classes/${id}`),
          apiPost<JoinInfo>(`/api/live-classes/${id}/join`, {}),
        ])
        setLiveClass(lc)
        setJoin(j)
        setRecordingUrl(lc.recordingUrl || '')
        if (canModerate) {
          const att = await apiGet<Attendance[]>(`/api/live-classes/${id}/attendance`).catch(() => [])
          setAttendance(att)
        }
      } catch {
        setError('Could not join live class')
      }
    }
    load()
    return () => {
      apiPost(`/api/live-classes/${id}/leave`, {}).catch(() => {})
    }
  }, [id])

  useEffect(() => {
    if (!id || !canModerate) return
    const poll = setInterval(() => {
      apiGet<Attendance[]>(`/api/live-classes/${id}/attendance`)
        .then(setAttendance)
        .catch(() => {})
    }, 10000)
    return () => clearInterval(poll)
  }, [id, canModerate])

  async function startClass() {
    const lc = await apiPost<LiveClass>(`/api/live-classes/${id}/start`, {})
    setLiveClass(lc)
    setJoin((j) => (j ? { ...j, status: 'live' } : j))
  }

  async function endClass() {
    const lc = await apiPost<LiveClass>(`/api/live-classes/${id}/end`, { recordingUrl: recordingUrl || null })
    setLiveClass(lc)
    setJoin((j) => (j ? { ...j, status: 'ended' } : j))
  }

  async function saveRecording() {
    await apiPut(`/api/live-classes/${id}`, { recordingUrl })
    setLiveClass((lc) => (lc ? { ...lc, recordingUrl } : lc))
  }

  const backHref =
    user.role === 'Student' ? '/student/live-classes' : '/admin/live-classes'

  if (error) {
    return (
      <AppLayout user={user} title="Live Class">
        <p className="text-red-600">{error}</p>
        <Link href={backHref} className="mt-4 inline-block text-sm text-school-navy underline">← Back</Link>
      </AppLayout>
    )
  }

  if (!liveClass || !join) {
    return (
      <AppLayout user={user} title="Live Class">
        <p className="text-slate-500">Joining classroom...</p>
      </AppLayout>
    )
  }

  return (
    <AppLayout user={user} title={liveClass.title}>
      <div className="mx-auto max-w-7xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href={backHref} className="text-sm text-slate-500 hover:text-school-navy">← Live classes</Link>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                liveClass.status === 'live'
                  ? 'bg-green-100 text-green-800'
                  : liveClass.status === 'ended'
                    ? 'bg-slate-100 text-slate-600'
                    : 'bg-amber-100 text-amber-800'
              }`}
            >
              {liveClass.status}
            </span>
            <span className="text-xs text-slate-500">{liveClass.attendanceCount ?? 0} joined</span>
          </div>
        </div>

        {canModerate && (
          <div className="content-card flex flex-wrap items-center gap-3 p-4">
            {liveClass.status !== 'live' && liveClass.status !== 'ended' && (
              <button type="button" onClick={startClass} className="btn-gold text-sm">
                Start class
              </button>
            )}
            {liveClass.status === 'live' && (
              <button type="button" onClick={endClass} className="rounded-lg bg-red-600 px-4 py-2 text-sm text-white">
                End class
              </button>
            )}
            <input
              value={recordingUrl}
              onChange={(e) => setRecordingUrl(e.target.value)}
              placeholder="Recording URL (after class)"
              className="min-w-[16rem] flex-1 text-sm"
            />
            <button type="button" onClick={saveRecording} className="text-sm text-school-navy underline">
              Save recording
            </button>
          </div>
        )}

        {liveClass.recordingUrl && liveClass.status === 'ended' && (
          <div className="content-card p-4 text-sm">
            <p className="font-medium text-school-navy">Class recording</p>
            <a href={liveClass.recordingUrl} target="_blank" rel="noopener noreferrer" className="text-school-gold underline">
              Watch recording
            </a>
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <div className="content-card overflow-hidden p-2">
            <p className="mb-2 px-2 text-xs text-slate-500">
              Video & screen share — use the toolbar inside the meeting (camera, mic, share screen).
            </p>
            <iframe
              title="Live video classroom"
              src={join.jitsiUrl}
              allow="camera; microphone; display-capture; fullscreen; autoplay"
              className="aspect-video w-full rounded-lg bg-black"
            />
          </div>

          <div className="content-card flex flex-col overflow-hidden">
            <div className="flex border-b border-slate-100">
              {(['chat', 'whiteboard', ...(canModerate ? (['attendance'] as const) : [])] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  className={`flex-1 px-3 py-2 text-xs font-medium capitalize ${
                    tab === t ? 'border-b-2 border-school-gold text-school-navy' : 'text-slate-500'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
            <div className="flex-1 p-2">
              {tab === 'chat' && <LiveChat liveClassId={id} />}
              {tab === 'whiteboard' && <LiveWhiteboard liveClassId={id} canDraw={canModerate} />}
              {tab === 'attendance' && canModerate && (
                <ul className="max-h-80 space-y-2 overflow-y-auto text-sm">
                  {attendance.map((a) => (
                    <li key={a.id} className="rounded-lg bg-slate-50 px-3 py-2">
                      {a.user.firstName} {a.user.lastName}
                      <span className="ml-2 text-xs text-slate-400">{a.user.role?.name}</span>
                      <span className="block text-xs text-slate-400">
                        Joined {new Date(a.joinedAt).toLocaleTimeString()}
                      </span>
                    </li>
                  ))}
                  {attendance.length === 0 && <p className="text-slate-500">No attendees yet.</p>}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}

export default withAuth(LiveClassRoomPage, {
  roles: ['SuperAdmin', 'SchoolAdmin', 'Teacher', 'Student'],
})
