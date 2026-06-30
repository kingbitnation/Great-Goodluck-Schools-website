import { useEffect, useState } from 'react'
import PublicLayout from '../components/layout/PublicLayout'
import Seo from '../components/Seo'
import Reveal from '../components/public/Reveal'
import { IconMapPin, IconMail, IconPhone } from '../components/public/Brand'
import { apiBaseUrl, parseJsonResponse } from '../lib/apiBase'
import { fetchPublic, type PublicSchool } from '../lib/publicApi'

const SUBJECTS = [
  'General enquiry',
  'Admissions',
  'Fees & payments',
  'Student welfare',
  'Partnership',
  'Other',
]

export default function ContactPage() {
  const [school, setSchool] = useState<PublicSchool | null>(null)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [subject, setSubject] = useState(SUBJECTS[0])
  const [message, setMessage] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    fetchPublic<PublicSchool>('/api/public/school-info').then(setSchool).catch(() => {})
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('loading')
    setErrorMsg('')
    const detail = [phone.trim() && `Phone: ${phone.trim()}`, '', message.trim()].filter(Boolean).join('\n')
    const fullMessage = subject ? `Subject: ${subject}\n\n${detail}` : detail
    try {
      const res = await fetch(`${apiBaseUrl()}/api/public/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), message: fullMessage }),
      })
      const body = await parseJsonResponse<{ error?: string }>(res)
      if (!res.ok) throw new Error(body.error || 'Could not send message')
      setStatus('ok')
      setName('')
      setEmail('')
      setPhone('')
      setSubject(SUBJECTS[0])
      setMessage('')
    } catch (err: unknown) {
      setStatus('error')
      setErrorMsg(err instanceof Error ? err.message : 'Could not send. Please try again.')
    }
  }

  const addressLine = [school?.address, school?.city, school?.state, school?.country].filter(Boolean).join(', ')
  const cards = [
    {
      icon: IconMapPin,
      title: 'Visit us',
      lines: addressLine ? [addressLine] : ['123 Education Lane', 'Lagos, Nigeria'],
    },
    {
      icon: IconPhone,
      title: 'Call',
      lines: [school?.contactPhone || '+234 801 234 5678', 'Mon – Fri, 8:00 AM – 4:00 PM'],
    },
    {
      icon: IconMail,
      title: 'Email',
      lines: [school?.contactEmail || 'info@schoolpilot.app', 'We reply within one business day'],
    },
  ]

  return (
    <>
      <Seo title="Contact Us" description="Get in touch with our school — admissions, fees, and general enquiries." path="/contact" />
      <PublicLayout title="Contact Us" subtitle={school?.name ? `We'd love to hear from you at ${school.name}` : "We'd love to hear from you"}>
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-10 lg:grid-cols-5 lg:gap-12">
            <div className="space-y-4 lg:col-span-2">
              <Reveal>
                <p className="text-school-muted">
                  Reach out for admissions, fees, or any question about school life. Fill in the form and our team will respond promptly.
                </p>
              </Reveal>
              {cards.map((c, i) => (
                <Reveal key={c.title} delay={i * 80}>
                  <div className="content-card flex gap-4 p-5">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-school-gold/15">
                      <c.icon className="text-amber-700 dark:text-school-gold" />
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{c.title}</p>
                      {c.lines.map((l) => (
                        <p
                          key={l}
                          className={`mt-1 text-sm text-slate-800 dark:text-slate-100 ${l.includes('@') ? 'break-all' : ''}`}
                        >
                          {l}
                        </p>
                      ))}
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>

            <Reveal delay={120} className="lg:col-span-3">
              <form
                onSubmit={handleSubmit}
                className="rounded-3xl border border-school-border bg-white p-7 shadow-soft dark:border-slate-600 dark:bg-slate-800 sm:p-9"
              >
                <h2 className="font-display text-2xl font-bold text-slate-900 dark:text-white">Send a message</h2>
                <p className="mt-1 text-sm text-school-muted">All fields marked * are required.</p>

                {status === 'ok' && (
                  <p className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200" role="status">
                    Thank you — your message was sent. We will get back to you soon.
                  </p>
                )}
                {status === 'error' && (
                  <p className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200" role="alert">
                    {errorMsg}
                  </p>
                )}

                <div className="mt-6 grid gap-5 sm:grid-cols-2">
                  <div className="sm:col-span-2 sm:grid sm:grid-cols-2 sm:gap-5">
                    <label className="block">
                      <span className="mb-1.5 block text-sm font-medium text-slate-800 dark:text-slate-200">Full name *</span>
                      <input
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g. Adeola Okonkwo"
                        autoComplete="name"
                        className="w-full"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1.5 block text-sm font-medium text-slate-800 dark:text-slate-200">Email address *</span>
                      <input
                        required
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        autoComplete="email"
                        className="w-full"
                      />
                    </label>
                  </div>
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-medium text-slate-800 dark:text-slate-200">Phone (optional)</span>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="08012345678"
                      autoComplete="tel"
                      className="w-full"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-medium text-slate-800 dark:text-slate-200">Subject *</span>
                    <select required value={subject} onChange={(e) => setSubject(e.target.value)} className="w-full">
                      {SUBJECTS.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block sm:col-span-2">
                    <span className="mb-1.5 block text-sm font-medium text-slate-800 dark:text-slate-200">Message *</span>
                    <textarea
                      required
                      rows={5}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="How can we help you?"
                      className="w-full resize-y"
                    />
                  </label>
                </div>

                <button type="submit" disabled={status === 'loading'} className="btn-gold mt-6 w-full sm:w-auto sm:min-w-[200px]">
                  {status === 'loading' ? 'Sending…' : 'Send message'}
                </button>
              </form>
            </Reveal>
          </div>
        </div>
      </PublicLayout>
    </>
  )
}
