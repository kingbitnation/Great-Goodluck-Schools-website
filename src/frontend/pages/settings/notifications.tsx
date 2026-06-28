import { useEffect, useState } from 'react'
import { withAuth } from '../../components/withAuth'
import AppLayout from '../../components/layout/AppLayout'
import { apiGet, apiPut } from '../../lib/api'
import {
  isPushSupported,
  registerServiceWorker,
  subscribeToPush,
  unsubscribeFromPush,
} from '../../lib/pushNotifications'
import type { AuthUser } from '../../lib/useAuth'

type Preferences = {
  email: boolean
  sms: boolean
  push: boolean
  inApp: boolean
  pushSubscribed: boolean
}

function NotificationSettingsPage({ user }: { user: AuthUser }) {
  const [prefs, setPrefs] = useState<Preferences | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [pushBusy, setPushBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [pushSupported, setPushSupported] = useState(false)

  useEffect(() => {
    isPushSupported().then(setPushSupported)
    registerServiceWorker()
    loadPrefs()
  }, [])

  async function loadPrefs() {
    try {
      setLoading(true)
      const data = await apiGet<Preferences>('/api/notifications/preferences')
      setPrefs(data)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load preferences')
    } finally {
      setLoading(false)
    }
  }

  async function savePrefs(next: Preferences) {
    setSaving(true)
    setError('')
    setMessage('')
    try {
      const updated = await apiPut<Preferences>('/api/notifications/preferences', {
        email: next.email,
        sms: next.sms,
        push: next.push,
        inApp: next.inApp,
      })
      setPrefs({ ...updated, pushSubscribed: next.pushSubscribed })
      setMessage('Preferences saved')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  async function togglePush() {
    if (!prefs) return
    setPushBusy(true)
    setError('')
    setMessage('')
    try {
      if (prefs.pushSubscribed) {
        await unsubscribeFromPush()
        setPrefs({ ...prefs, pushSubscribed: false })
        setMessage('Push notifications disabled')
      } else {
        await subscribeToPush()
        setPrefs({ ...prefs, push: true, pushSubscribed: true })
        setMessage('Push notifications enabled')
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Push setup failed')
    } finally {
      setPushBusy(false)
    }
  }

  function toggleField(field: keyof Pick<Preferences, 'email' | 'sms' | 'push' | 'inApp'>) {
    if (!prefs) return
    const next = { ...prefs, [field]: !prefs[field] }
    setPrefs(next)
    savePrefs(next)
  }

  return (
    <AppLayout user={user} title="Notification settings">
      <div className="p-4 sm:p-8 max-w-3xl mx-auto">
        <h1 className="text-2xl sm:text-3xl font-bold mb-2">Notification settings</h1>
        <p className="text-gray-600 mb-6">
          Choose how you receive alerts for results, fees, attendance, and more.
        </p>

        {message && <div className="bg-green-50 text-green-800 p-4 rounded mb-4">{message}</div>}
        {error && <div className="bg-red-100 text-red-700 p-4 rounded mb-4">{error}</div>}

        {loading || !prefs ? (
          <div className="bg-white p-8 rounded-lg shadow-sm text-gray-500">Loading...</div>
        ) : (
          <div className="space-y-4">
            {[
              { key: 'inApp' as const, label: 'In-app notifications', desc: 'Show alerts inside the portal' },
              { key: 'email' as const, label: 'Email', desc: 'Receive messages at your registered email' },
              { key: 'sms' as const, label: 'SMS', desc: 'Text messages to your phone (when school enables SMS)' },
              { key: 'push' as const, label: 'Browser push', desc: 'Desktop and mobile push via PWA' },
            ].map((item) => (
              <label
                key={item.key}
                className="flex items-start gap-4 bg-white border rounded-lg p-4 shadow-sm cursor-pointer"
              >
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4"
                  checked={prefs[item.key]}
                  onChange={() => toggleField(item.key)}
                  disabled={saving}
                />
                <span>
                  <span className="font-medium block">{item.label}</span>
                  <span className="text-sm text-gray-600">{item.desc}</span>
                </span>
              </label>
            ))}

            {pushSupported && (
              <div className="bg-white border rounded-lg p-4 shadow-sm">
                <h2 className="font-semibold mb-1">Push subscription</h2>
                <p className="text-sm text-gray-600 mb-4">
                  {prefs.pushSubscribed
                    ? 'This device is subscribed to push notifications.'
                    : 'Enable push on this device to get instant alerts.'}
                </p>
                <button
                  type="button"
                  onClick={togglePush}
                  disabled={pushBusy}
                  className="px-4 py-2 rounded-lg bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-60"
                >
                  {pushBusy
                    ? 'Working...'
                    : prefs.pushSubscribed
                      ? 'Unsubscribe this device'
                      : 'Enable push on this device'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  )
}

export default withAuth(NotificationSettingsPage, {
  roles: ['SuperAdmin', 'SchoolAdmin', 'Teacher', 'Student', 'Parent', 'Accountant', 'Alumni'],
})
