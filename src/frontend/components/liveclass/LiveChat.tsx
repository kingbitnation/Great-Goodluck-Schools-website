import { useEffect, useRef, useState } from 'react'
import { apiGet, apiPost } from '../../lib/api'

type Message = {
  id: string
  body: string
  createdAt: string
  user: { firstName: string; lastName: string; role?: { name: string } }
}

type Props = {
  liveClassId: string
}

export default function LiveChat({ liveClassId }: Props) {
  const [messages, setMessages] = useState<Message[]>([])
  const [body, setBody] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const lastAt = useRef<string | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        const path = lastAt.current
          ? `/api/live-classes/${liveClassId}/messages?since=${encodeURIComponent(lastAt.current)}`
          : `/api/live-classes/${liveClassId}/messages`
        const data = await apiGet<Message[]>(path)
        if (data.length) {
          setMessages((prev) => {
            const ids = new Set(prev.map((m) => m.id))
            const merged = [...prev, ...data.filter((m) => !ids.has(m.id))]
            return merged.slice(-200)
          })
          lastAt.current = data[data.length - 1].createdAt
        }
      } catch {
        // ignore
      }
    }
    load()
    const id = setInterval(load, 3000)
    return () => clearInterval(id)
  }, [liveClassId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function send(e: React.FormEvent) {
    e.preventDefault()
    if (!body.trim()) return
    const msg = await apiPost<Message>(`/api/live-classes/${liveClassId}/messages`, { body })
    setMessages((prev) => [...prev, msg])
    lastAt.current = msg.createdAt
    setBody('')
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-2 overflow-y-auto p-3 text-sm" style={{ maxHeight: '280px' }}>
        {messages.map((m) => (
          <div key={m.id} className="rounded-lg bg-slate-50 px-3 py-2">
            <p className="text-xs font-medium text-school-navy">
              {m.user.firstName} {m.user.lastName}
              <span className="ml-1 text-slate-400">{m.user.role?.name}</span>
            </p>
            <p className="mt-0.5 text-slate-700">{m.body}</p>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <form onSubmit={send} className="border-t border-slate-100 p-3">
        <div className="flex gap-2">
          <input
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Type a message..."
            className="min-w-0 flex-1 text-sm"
          />
          <button type="submit" className="rounded-lg bg-school-navy px-3 py-1.5 text-xs text-white">
            Send
          </button>
        </div>
      </form>
    </div>
  )
}
