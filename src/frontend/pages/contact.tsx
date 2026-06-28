import { useEffect, useState } from 'react'
import PublicLayout from '../components/layout/PublicLayout'
import Reveal from '../components/public/Reveal'
import { IconMapPin, IconMail, IconPhone } from '../components/public/Brand'
import { fetchPublic, type PublicSchool } from '../lib/publicApi'

export default function ContactPage() {
  const [school, setSchool] = useState<PublicSchool | null>(null)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle')

  useEffect(() => {
    fetchPublic<PublicSchool>('/api/public/school-info').then(setSchool).catch(() => {})
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('loading')
    try {
      const base = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000'
      const res = await fetch(`${base}/api/public/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, message }),
      })
      if (!res.ok) throw new Error('Failed')
      setStatus('ok')
      setName('')
      setEmail('')
      setMessage('')
    } catch {
      setStatus('error')
    }
  }

  const addressLine = [school?.address, school?.city, school?.state, school?.country].filter(Boolean).join(', ')
  const cards = [
    { icon: IconMapPin, title: 'Visit', lines: addressLine ? [addressLine] : ['123 Education Lane', 'Lagos, Nigeria'] },
    { icon: IconPhone, title: 'Call', lines: [school?.contactPhone || '+234 801 234 5678', 'Mon – Fri, 8 AM – 4 PM'] },
    { icon: IconMail, title: 'Email', lines: [school?.contactEmail || 'support@schoolpilot.app'] },
  ]

  return (
    <PublicLayout title="Contact Us" subtitle={`We'd love to hear from you${school?.name ? ` at ${school.name}` : ''}`}>
      <div className="grid gap-8 lg:grid-cols-5">
        <div className="space-y-4 lg:col-span-2">
          {cards.map((c, i) => (
            <Reveal key={c.title} delay={i * 80}>
              <div className="content-card flex gap-4 p-5">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-school-gold/15">
                  <c.icon className="text-amber-700" />
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{c.title}</p>
                  {c.lines.map((l) => (
                    <p key={l} className={`mt-1 text-sm text-slate-700 ${l.includes('@') ? 'break-all' : ''}`}>{l}</p>
                  ))}
                </div>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal delay={120}>
          <form onSubmit={handleSubmit} className="glass-card rounded-3xl p-7 sm:p-9 lg:col-span-3">
            <h2 className="font-display text-xl font-bold text-school-navy sm:text-2xl">Send a Message</h2>
            <p className="mt-1 text-sm text-slate-500">We typically respond within 24 hours.</p>
            <div className="mt-6 space-y-4">
              <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" className="w-full" />
              <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email address" className="w-full" />
              <textarea required rows={5} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Your message" className="w-full" />
              <button type="submit" disabled={status === 'loading'} className="btn-gold w-full">
                {status === 'loading' ? 'Sending...' : 'Send Message'}
              </button>
              {status === 'ok' && <p className="text-center text-sm font-medium text-emerald-600">Message sent successfully.</p>}
              {status === 'error' && <p className="text-center text-sm font-medium text-red-600">Could not send. Please try again.</p>}
            </div>
          </form>
        </Reveal>
      </div>
    </PublicLayout>
  )
}
