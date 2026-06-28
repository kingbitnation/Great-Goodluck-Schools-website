import { useEffect, useState } from 'react'
import { withAuth } from '../../components/withAuth'
import AppLayout from '../../components/layout/AppLayout'
import { apiDelete, apiGet, apiPost } from '../../lib/api'
import type { AuthUser } from '../../lib/useAuth'

type Session = {
  id: string
  createdAt: string
  expiresAt: string
  ipAddress: string | null
  deviceName: string | null
}

type LoginEntry = {
  id: string
  createdAt: string
  ipAddress: string | null
  deviceLabel: string | null
  success: boolean
  failureReason: string | null
}

type TwoFaSetup = {
  secret: string
  qrCodeDataUrl: string
}

function SecuritySettingsPage({ user }: { user: AuthUser }) {
  const [sessions, setSessions] = useState<Session[]>([])
  const [history, setHistory] = useState<LoginEntry[]>([])
  const [twoFaSetup, setTwoFaSetup] = useState<TwoFaSetup | null>(null)
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null)
  const [confirmCode, setConfirmCode] = useState('')
  const [disablePassword, setDisablePassword] = useState('')
  const [disableCode, setDisableCode] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      const [s, h] = await Promise.all([
        apiGet<Session[]>('/api/auth/sessions'),
        apiGet<LoginEntry[]>('/api/auth/login-history'),
      ])
      setSessions(s)
      setHistory(h)
    } catch {
      setError('Failed to load security data')
    }
  }

  async function start2FA() {
    setError('')
    setMessage('')
    try {
      const data = await apiGet<TwoFaSetup>('/api/auth/2fa/setup')
      setTwoFaSetup(data)
    } catch (err: any) {
      setError(err.message)
    }
  }

  async function confirm2FA(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const data = await apiPost<{ backupCodes: string[] }>('/api/auth/2fa/confirm', { code: confirmCode })
      setBackupCodes(data.backupCodes)
      setTwoFaSetup(null)
      setConfirmCode('')
      setMessage('Two-factor authentication enabled')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function disable2FA(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await apiPost('/api/auth/2fa/disable', { password: disablePassword, code: disableCode || undefined })
      setMessage('Two-factor authentication disabled')
      setDisablePassword('')
      setDisableCode('')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await apiPost('/api/auth/change-password', { currentPassword, newPassword })
      setMessage('Password changed successfully')
      setCurrentPassword('')
      setNewPassword('')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function revokeSession(id: string) {
    try {
      await apiDelete(`/api/auth/sessions/${id}`)
      setSessions((prev) => prev.filter((s) => s.id !== id))
      setMessage('Session revoked')
    } catch (err: any) {
      setError(err.message)
    }
  }

  return (
    <AppLayout user={user} title="Security">
      <div className="mx-auto max-w-4xl space-y-8 p-6">
        <h1 className="text-2xl font-bold text-school-navy">Security settings</h1>
        {message && <p className="rounded-lg bg-green-50 px-4 py-2 text-sm text-green-800">{message}</p>}
        {error && <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>}

        <section className="rounded-xl border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Change password</h2>
          <form onSubmit={changePassword} className="mt-4 grid gap-3 sm:grid-cols-2">
            <input type="password" placeholder="Current password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className="w-full" required />
            <input type="password" placeholder="New password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full" required />
            <button type="submit" disabled={loading} className="btn-gold sm:col-span-2 sm:w-fit">Update password</button>
          </form>
        </section>

        <section className="rounded-xl border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Two-factor authentication</h2>
          {user.twoFactorEnabled ? (
            <form onSubmit={disable2FA} className="mt-4 space-y-3">
              <p className="text-sm text-slate-600">2FA is enabled on your account.</p>
              <input type="password" placeholder="Your password" value={disablePassword} onChange={(e) => setDisablePassword(e.target.value)} className="w-full max-w-md" required />
              <input type="text" placeholder="Authenticator code (optional)" value={disableCode} onChange={(e) => setDisableCode(e.target.value)} className="w-full max-w-md" />
              <button type="submit" disabled={loading} className="rounded-lg border border-red-200 px-4 py-2 text-sm text-red-700 hover:bg-red-50">Disable 2FA</button>
            </form>
          ) : twoFaSetup ? (
            <form onSubmit={confirm2FA} className="mt-4 space-y-4">
              <p className="text-sm text-slate-600">Scan this QR code with Google Authenticator or similar.</p>
              <img src={twoFaSetup.qrCodeDataUrl} alt="2FA QR code" className="h-48 w-48 rounded-lg border" />
              <p className="font-mono text-xs text-slate-500">Manual key: {twoFaSetup.secret}</p>
              <input type="text" placeholder="Enter 6-digit code" value={confirmCode} onChange={(e) => setConfirmCode(e.target.value)} className="w-full max-w-xs" required />
              <button type="submit" disabled={loading} className="btn-gold">Confirm & enable</button>
            </form>
          ) : (
            <button type="button" onClick={start2FA} className="btn-gold mt-4">Set up 2FA</button>
          )}
          {backupCodes && (
            <div className="mt-4 rounded-lg bg-amber-50 p-4">
              <p className="text-sm font-medium text-amber-900">Save these backup codes — they will not be shown again:</p>
              <ul className="mt-2 grid grid-cols-2 gap-1 font-mono text-sm">
                {backupCodes.map((c) => <li key={c}>{c}</li>)}
              </ul>
            </div>
          )}
        </section>

        <section className="rounded-xl border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Active sessions</h2>
          <ul className="mt-4 divide-y">
            {sessions.map((s) => (
              <li key={s.id} className="flex items-center justify-between py-3 text-sm">
                <div>
                  <p className="font-medium">{s.deviceName || 'Unknown device'}</p>
                  <p className="text-slate-500">{s.ipAddress || '—'} · {new Date(s.createdAt).toLocaleString()}</p>
                </div>
                <button type="button" onClick={() => revokeSession(s.id)} className="text-red-600 hover:underline">Revoke</button>
              </li>
            ))}
            {sessions.length === 0 && <p className="py-4 text-sm text-slate-500">No active sessions</p>}
          </ul>
        </section>

        <section className="rounded-xl border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Recent login activity</h2>
          <ul className="mt-4 divide-y">
            {history.map((h) => (
              <li key={h.id} className="py-3 text-sm">
                <span className={h.success ? 'text-green-700' : 'text-red-600'}>{h.success ? 'Success' : 'Failed'}</span>
                {' · '}{h.deviceLabel || 'Unknown'} · {h.ipAddress || '—'} · {new Date(h.createdAt).toLocaleString()}
                {!h.success && h.failureReason && <span className="text-slate-500"> ({h.failureReason})</span>}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </AppLayout>
  )
}

export default withAuth(SecuritySettingsPage)
