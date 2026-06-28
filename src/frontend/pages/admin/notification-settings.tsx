import { useEffect, useState } from 'react'
import { withAuth } from '../../components/withAuth'
import AppLayout from '../../components/layout/AppLayout'
import { apiGet, apiPost, apiPut } from '../../lib/api'
import type { AuthUser } from '../../lib/useAuth'

type NotificationSettings = {
  smsEnabled: boolean
  smsProvider: string
  termiiSenderId: string
  hasTermiiApiKey: boolean
  hasTwilioAuthToken: boolean
  twilioAccountSid: string
  twilioFromNumber: string
  pushEnabled: boolean
  vapidPublicKey: string
  hasVapidPrivateKey: boolean
  vapidSubject: string
  channelDefaults: Record<string, string[]>
}

type SettingsResponse = {
  schoolId: string
  schoolName: string
  settings: NotificationSettings
}

type SmsQueueItem = {
  id: string
  to: string
  body: string
  template: string | null
  status: string
  attempts: number
  lastError: string | null
}

function NotificationAdminPage({ user }: { user: AuthUser }) {
  const schoolId = user.schoolId || ''
  const [data, setData] = useState<SettingsResponse | null>(null)
  const [form, setForm] = useState<NotificationSettings | null>(null)
  const [termiiApiKey, setTermiiApiKey] = useState('')
  const [twilioAuthToken, setTwilioAuthToken] = useState('')
  const [smsQueue, setSmsQueue] = useState<SmsQueueItem[]>([])
  const [smsStats, setSmsStats] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [testPhone, setTestPhone] = useState('')

  useEffect(() => {
    if (!schoolId && user.role !== 'SuperAdmin') return
    loadAll()
  }, [schoolId, user.role])

  async function loadAll() {
    try {
      setLoading(true)
      const targetSchool = schoolId || (await apiGet<{ id: string }[]>('/api/schools'))[0]?.id
      if (!targetSchool) return
      const [settingsData, queueData] = await Promise.all([
        apiGet<SettingsResponse>(`/api/schools/${targetSchool}/notification-settings`),
        apiGet<{ items: SmsQueueItem[]; stats: Record<string, number> }>('/api/notifications/sms-queue?limit=30'),
      ])
      setData(settingsData)
      setForm(settingsData.settings)
      setSmsQueue(queueData.items)
      setSmsStats(queueData.stats)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load settings')
    } finally {
      setLoading(false)
    }
  }

  async function saveSettings(e: React.FormEvent) {
    e.preventDefault()
    if (!data || !form) return
    setSaving(true)
    setError('')
    setMessage('')
    try {
      const body: Record<string, unknown> = { ...form }
      if (termiiApiKey) body.termiiApiKey = termiiApiKey
      if (twilioAuthToken) body.twilioAuthToken = twilioAuthToken
      const updated = await apiPut<{ settings: NotificationSettings }>(
        `/api/schools/${data.schoolId}/notification-settings`,
        body
      )
      setForm(updated.settings)
      setTermiiApiKey('')
      setTwilioAuthToken('')
      setMessage('Notification settings saved')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function generateVapid() {
    if (!data) return
    setError('')
    setMessage('')
    try {
      const updated = await apiPut<{ settings: NotificationSettings }>(
        `/api/schools/${data.schoolId}/notification-settings`,
        { generateVapid: true, ...(form || {}) }
      )
      setForm(updated.settings)
      setMessage('New VAPID keys generated for push notifications')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to generate keys')
    }
  }

  async function sendTestSms() {
    if (!data) return
    setError('')
    setMessage('')
    try {
      await apiPost(`/api/schools/${data.schoolId}/notification-settings/test-sms`, {
        to: testPhone || undefined,
      })
      setMessage('Test SMS sent')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Test SMS failed')
    }
  }

  async function processSmsQueue() {
    setError('')
    setMessage('')
    try {
      const result = await apiPost<{ sent: number; failed: number }>('/api/notifications/sms-queue/process', {})
      setMessage(`Processed SMS queue — sent: ${result.sent}, failed: ${result.failed}`)
      loadAll()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Queue processing failed')
    }
  }

  if (loading) {
    return (
      <AppLayout user={user} title="Notifications">
        <div className="p-8 text-center text-slate-500">Loading...</div>
      </AppLayout>
    )
  }

  return (
    <AppLayout user={user} title="Notification channels">
      <div className="mx-auto max-w-5xl space-y-8 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-school-navy">SMS & push notifications</h1>
            <p className="text-sm text-slate-500">{data?.schoolName}</p>
          </div>
          <button type="button" onClick={loadAll} className="rounded-lg border px-4 py-2 text-sm hover:bg-slate-50">
            Refresh
          </button>
        </div>

        {message && <p className="rounded-lg bg-green-50 px-4 py-2 text-sm text-green-800">{message}</p>}
        {error && <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>}

        {form && (
          <form onSubmit={saveSettings} className="space-y-8">
            <section className="rounded-xl border bg-white p-6 shadow-sm space-y-4">
              <h2 className="text-lg font-semibold">SMS provider</h2>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.smsEnabled}
                  onChange={(e) => setForm({ ...form, smsEnabled: e.target.checked })}
                />
                <span className="text-sm">Enable SMS for this school</span>
              </label>
              <select
                value={form.smsProvider}
                onChange={(e) => setForm({ ...form, smsProvider: e.target.value })}
                className="w-full max-w-xs rounded border px-3 py-2"
              >
                <option value="termii">Termii (Nigeria)</option>
                <option value="twilio">Twilio</option>
                <option value="none">Disabled</option>
              </select>

              {form.smsProvider === 'termii' && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <input
                    placeholder="Termii sender ID"
                    value={form.termiiSenderId}
                    onChange={(e) => setForm({ ...form, termiiSenderId: e.target.value })}
                    className="w-full rounded border px-3 py-2"
                  />
                  <input
                    type="password"
                    placeholder={form.hasTermiiApiKey ? 'API key (unchanged)' : 'Termii API key'}
                    value={termiiApiKey}
                    onChange={(e) => setTermiiApiKey(e.target.value)}
                    className="w-full rounded border px-3 py-2"
                  />
                </div>
              )}

              {form.smsProvider === 'twilio' && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <input
                    placeholder="Twilio Account SID"
                    value={form.twilioAccountSid}
                    onChange={(e) => setForm({ ...form, twilioAccountSid: e.target.value })}
                    className="w-full rounded border px-3 py-2"
                  />
                  <input
                    type="password"
                    placeholder={form.hasTwilioAuthToken ? 'Auth token (unchanged)' : 'Twilio auth token'}
                    value={twilioAuthToken}
                    onChange={(e) => setTwilioAuthToken(e.target.value)}
                    className="w-full rounded border px-3 py-2"
                  />
                  <input
                    placeholder="From number (+234...)"
                    value={form.twilioFromNumber}
                    onChange={(e) => setForm({ ...form, twilioFromNumber: e.target.value })}
                    className="w-full rounded border px-3 py-2 sm:col-span-2"
                  />
                </div>
              )}

              <div className="flex flex-wrap gap-3 items-end">
                <input
                  placeholder="Test phone (optional)"
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                  className="rounded border px-3 py-2"
                />
                <button type="button" onClick={sendTestSms} className="rounded-lg border px-4 py-2 text-sm hover:bg-slate-50">
                  Send test SMS
                </button>
              </div>
            </section>

            <section className="rounded-xl border bg-white p-6 shadow-sm space-y-4">
              <h2 className="text-lg font-semibold">Web push (PWA)</h2>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.pushEnabled}
                  onChange={(e) => setForm({ ...form, pushEnabled: e.target.checked })}
                />
                <span className="text-sm">Enable browser push notifications</span>
              </label>
              <input
                placeholder="VAPID subject (mailto: or https://)"
                value={form.vapidSubject}
                onChange={(e) => setForm({ ...form, vapidSubject: e.target.value })}
                className="w-full rounded border px-3 py-2"
              />
              <p className="text-sm text-slate-500 break-all">
                Public key: {form.vapidPublicKey || 'Not set'}
                {form.hasVapidPrivateKey ? ' · Private key configured' : ''}
              </p>
              <button type="button" onClick={generateVapid} className="rounded-lg border px-4 py-2 text-sm hover:bg-slate-50">
                Generate VAPID keys
              </button>
            </section>

            <div className="flex gap-3">
              <button type="submit" disabled={saving} className="btn-gold">
                {saving ? 'Saving...' : 'Save settings'}
              </button>
            </div>
          </form>
        )}

        <section className="rounded-xl border bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">SMS queue</h2>
            <button type="button" onClick={processSmsQueue} className="btn-gold text-sm">
              Process queue now
            </button>
          </div>
          <div className="mt-3 flex flex-wrap gap-4 text-sm">
            {Object.entries(smsStats).map(([status, count]) => (
              <span key={status} className="rounded-full bg-slate-100 px-3 py-1 capitalize">
                {status}: {count}
              </span>
            ))}
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b text-slate-500">
                <tr>
                  <th className="px-3 py-2">To</th>
                  <th className="px-3 py-2">Message</th>
                  <th className="px-3 py-2">Template</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {smsQueue.map((item) => (
                  <tr key={item.id} className="border-b last:border-0">
                    <td className="px-3 py-2">{item.to}</td>
                    <td className="px-3 py-2 max-w-xs truncate">{item.body}</td>
                    <td className="px-3 py-2">{item.template || '—'}</td>
                    <td className="px-3 py-2 capitalize">{item.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {smsQueue.length === 0 && <p className="py-6 text-center text-slate-500">No queued SMS messages</p>}
          </div>
        </section>
      </div>
    </AppLayout>
  )
}

export default withAuth(NotificationAdminPage, { roles: ['SuperAdmin', 'SchoolAdmin'] })
