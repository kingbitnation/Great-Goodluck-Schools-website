import { useEffect, useState } from 'react'
import { withAuth } from '../../components/withAuth'
import AppLayout from '../../components/layout/AppLayout'
import { apiGet, apiPost, apiPut } from '../../lib/api'
import type { AuthUser } from '../../lib/useAuth'

type SmtpSettings = {
  enabled: boolean
  host: string
  port: number
  secure: boolean
  user: string
  from: string
  hasPassword: boolean
}

type EmailSettings = {
  schoolId: string
  schoolName: string
  smtp: SmtpSettings
  globalSmtpConfigured: boolean
}

type QueueItem = {
  id: string
  to: string
  subject: string
  template: string | null
  status: string
  attempts: number
  lastError: string | null
  createdAt: string
}

function EmailAdminPage({ user }: { user: AuthUser }) {
  const schoolId = user.schoolId || ''
  const [settings, setSettings] = useState<EmailSettings | null>(null)
  const [smtp, setSmtp] = useState<SmtpSettings | null>(null)
  const [smtpPass, setSmtpPass] = useState('')
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [stats, setStats] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!schoolId && user.role !== 'SuperAdmin') return
    loadAll()
  }, [schoolId, user.role])

  async function loadAll() {
    try {
      setLoading(true)
      const targetSchool = schoolId || (await apiGet<any[]>('/api/schools'))[0]?.id
      if (!targetSchool) return
      const [emailSettings, queueData] = await Promise.all([
        apiGet<EmailSettings>(`/api/schools/${targetSchool}/email-settings`),
        apiGet<{ items: QueueItem[]; stats: Record<string, number> }>('/api/email/queue?limit=30'),
      ])
      setSettings(emailSettings)
      setSmtp(emailSettings.smtp)
      setQueue(queueData.items)
      setStats(queueData.stats)
    } catch (err: any) {
      setError(err.message || 'Failed to load email settings')
    } finally {
      setLoading(false)
    }
  }

  async function saveSmtp(e: React.FormEvent) {
    e.preventDefault()
    if (!settings) return
    setSaving(true)
    setError('')
    setMessage('')
    try {
      const body: Record<string, unknown> = { ...smtp }
      if (smtpPass) body.pass = smtpPass
      const updated = await apiPut<{ smtp: SmtpSettings }>(`/api/schools/${settings.schoolId}/email-settings`, body)
      setSmtp(updated.smtp)
      setSmtpPass('')
      setMessage('Email settings saved')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function sendTest() {
    if (!settings) return
    setMessage('')
    setError('')
    try {
      await apiPost(`/api/schools/${settings.schoolId}/email-settings/test`, {})
      setMessage('Test email sent to your account')
    } catch (err: any) {
      setError(err.message)
    }
  }

  async function sendFeeReminders() {
    setMessage('')
    setError('')
    try {
      const result = await apiPost<{ message: string }>('/api/email/fee-reminders', {})
      setMessage(result.message)
      loadAll()
    } catch (err: any) {
      setError(err.message)
    }
  }

  if (loading) {
    return (
      <AppLayout user={user} title="Email">
        <div className="p-8 text-center text-slate-500">Loading...</div>
      </AppLayout>
    )
  }

  return (
    <AppLayout user={user} title="Email system">
      <div className="mx-auto max-w-5xl space-y-8 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-school-navy">Email & notifications</h1>
            <p className="text-sm text-slate-500">{settings?.schoolName}</p>
          </div>
          <button type="button" onClick={loadAll} className="rounded-lg border px-4 py-2 text-sm hover:bg-slate-50">Refresh</button>
        </div>

        {message && <p className="rounded-lg bg-green-50 px-4 py-2 text-sm text-green-800">{message}</p>}
        {error && <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>}

        <section className="rounded-xl border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">SMTP configuration</h2>
          <p className="mt-1 text-sm text-slate-500">
            {settings?.globalSmtpConfigured
              ? 'Global SMTP is configured. School SMTP overrides when enabled.'
              : 'Configure school SMTP or set SMTP_HOST / SMTP_USER in server environment.'}
          </p>
          {smtp && (
            <form onSubmit={saveSmtp} className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="flex items-center gap-2 sm:col-span-2">
                <input type="checkbox" checked={smtp.enabled} onChange={(e) => setSmtp({ ...smtp, enabled: e.target.checked })} />
                <span className="text-sm">Use school SMTP (override global)</span>
              </label>
              <input placeholder="SMTP host" value={smtp.host} onChange={(e) => setSmtp({ ...smtp, host: e.target.value })} className="w-full" />
              <input type="number" placeholder="Port" value={smtp.port} onChange={(e) => setSmtp({ ...smtp, port: Number(e.target.value) })} className="w-full" />
              <input placeholder="Username" value={smtp.user} onChange={(e) => setSmtp({ ...smtp, user: e.target.value })} className="w-full" />
              <input type="password" placeholder={smtp.hasPassword ? 'Password (unchanged)' : 'Password'} value={smtpPass} onChange={(e) => setSmtpPass(e.target.value)} className="w-full" />
              <input placeholder="From address" value={smtp.from} onChange={(e) => setSmtp({ ...smtp, from: e.target.value })} className="w-full sm:col-span-2" />
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={smtp.secure} onChange={(e) => setSmtp({ ...smtp, secure: e.target.checked })} />
                <span className="text-sm">Use SSL/TLS (port 465)</span>
              </label>
              <div className="flex flex-wrap gap-3 sm:col-span-2">
                <button type="submit" disabled={saving} className="btn-gold">{saving ? 'Saving...' : 'Save settings'}</button>
                <button type="button" onClick={sendTest} className="rounded-lg border px-4 py-2 text-sm hover:bg-slate-50">Send test email</button>
              </div>
            </form>
          )}
        </section>

        <section className="rounded-xl border bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Fee reminders</h2>
            <button type="button" onClick={sendFeeReminders} className="btn-gold text-sm">Queue fee reminders now</button>
          </div>
          <p className="mt-2 text-sm text-slate-500">Emails students and parents for fees due within 7 days or overdue.</p>
        </section>

        <section className="rounded-xl border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Email queue</h2>
          <div className="mt-3 flex flex-wrap gap-4 text-sm">
            {Object.entries(stats).map(([status, count]) => (
              <span key={status} className="rounded-full bg-slate-100 px-3 py-1 capitalize">{status}: {count}</span>
            ))}
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b text-slate-500">
                <tr>
                  <th className="px-3 py-2">To</th>
                  <th className="px-3 py-2">Subject</th>
                  <th className="px-3 py-2">Template</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Attempts</th>
                </tr>
              </thead>
              <tbody>
                {queue.map((item) => (
                  <tr key={item.id} className="border-b last:border-0">
                    <td className="px-3 py-2">{item.to}</td>
                    <td className="px-3 py-2">{item.subject}</td>
                    <td className="px-3 py-2">{item.template || '—'}</td>
                    <td className="px-3 py-2 capitalize">{item.status}</td>
                    <td className="px-3 py-2">{item.attempts}{item.lastError ? ` · ${item.lastError}` : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {queue.length === 0 && <p className="py-6 text-center text-slate-500">No queued emails</p>}
          </div>
        </section>
      </div>
    </AppLayout>
  )
}

export default withAuth(EmailAdminPage, { roles: ['SuperAdmin', 'SchoolAdmin'] })
