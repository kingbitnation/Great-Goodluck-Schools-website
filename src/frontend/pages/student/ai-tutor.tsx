import { useEffect, useRef, useState } from 'react'
import AppLayout from '../../components/layout/AppLayout'
import { AiPlanBanner } from '../../components/AiPlanBanner'
import { withAuth } from '../../components/withAuth'
import { apiGet, apiPost } from '../../lib/api'
import type { AuthUser } from '../../lib/useAuth'

type ChatSession = { id: string; title: string; type: string }
type ChatMessage = { id: string; role: string; content: string; createdAt: string }

const TAB_TYPES = {
  tutor: 'tutor',
  homework: 'homework',
  planner: 'study_planner',
} as const

function AiTutorPage({ user }: { user: AuthUser }) {
  const [tab, setTab] = useState<keyof typeof TAB_TYPES>('tutor')
  const [session, setSession] = useState<ChatSession | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    setSession(null)
    setMessages([])
    setInput('')
  }, [tab])

  async function ensureSession() {
    if (session) return session
    const titles = {
      tutor: 'AI Tutor',
      homework: 'Homework Help',
      planner: 'Study Planner',
    }
    const created = await apiPost<ChatSession>('/api/ai/chat/sessions', {
      type: TAB_TYPES[tab],
      title: titles[tab],
      context: { subject: 'General' },
    })
    setSession(created)
    return created
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!input.trim()) return
    setSending(true)
    setError('')
    try {
      const s = await ensureSession()
      const userMsg: ChatMessage = {
        id: `local-${Date.now()}`,
        role: 'user',
        content: input.trim(),
        createdAt: new Date().toISOString(),
      }
      setMessages((m) => [...m, userMsg])
      setInput('')

      const res = await apiPost<{ message: ChatMessage }>(`/api/ai/chat/sessions/${s.id}/messages`, {
        content: userMsg.content,
      })
      setMessages((m) => [...m, res.message])
    } catch (err: any) {
      setError(err.message || 'Failed to send')
    } finally {
      setSending(false)
    }
  }

  const placeholders = {
    tutor: 'Ask about a topic you are learning…',
    homework: 'Describe your homework question (I will guide, not give full answers)…',
    planner: 'What subjects and exams do you need a study plan for?',
  }

  return (
    <AppLayout user={user} title="AI Learning Assistant">
      <div className="mx-auto flex max-w-3xl flex-col p-8" style={{ minHeight: '70vh' }}>
        <h1 className="mb-4 text-3xl font-bold">AI Learning Assistant</h1>
        <AiPlanBanner />

        <div className="mb-4 flex gap-2 border-b">
          {(['tutor', 'homework', 'planner'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium capitalize ${
                tab === t ? 'border-b-2 border-school-gold text-school-navy' : 'text-slate-500'
              }`}
            >
              {t === 'planner' ? 'Study planner' : t === 'homework' ? 'Homework help' : 'Tutor'}
            </button>
          ))}
        </div>

        {error && <div className="mb-4 rounded bg-red-50 p-3 text-sm text-red-700">{error}</div>}

        <div className="content-card flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 space-y-3 overflow-y-auto p-4" style={{ maxHeight: '50vh' }}>
            {messages.length === 0 && (
              <p className="text-center text-sm text-slate-500">
                Start a conversation — your school AI assistant is here to help you learn.
              </p>
            )}
            {messages.map((m) => (
              <div
                key={m.id}
                className={`rounded-lg px-4 py-2 text-sm ${
                  m.role === 'user' ? 'ml-8 bg-school-navy text-white' : 'mr-8 bg-slate-100 text-slate-800'
                }`}
              >
                {m.content}
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
          <form onSubmit={handleSend} className="flex gap-2 border-t p-4">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={placeholders[tab]}
              className="flex-1 rounded border p-2 text-sm"
              disabled={sending}
            />
            <button
              type="submit"
              disabled={sending}
              className="rounded bg-school-navy px-4 py-2 text-sm text-white disabled:opacity-50"
            >
              Send
            </button>
          </form>
        </div>
      </div>
    </AppLayout>
  )
}

export default withAuth(AiTutorPage, { roles: ['Student', 'Teacher', 'SuperAdmin', 'SchoolAdmin'] })
