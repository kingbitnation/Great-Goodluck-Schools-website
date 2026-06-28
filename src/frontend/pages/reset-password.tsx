import Link from 'next/link'
import { useRouter } from 'next/router'
import { useState } from 'react'
import { SchoolLogo } from '../components/public/Brand'

export default function ResetPassword() {
  const router = useRouter()
  const token = typeof router.query.token === 'string' ? router.query.token : ''
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) {
      setError('Passwords do not match')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const base = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000'
      const res = await fetch(`${base}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body?.error || 'Reset failed')
      setDone(true)
    } catch (err: any) {
      setError(err.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  if (!token && router.isReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-school-navy px-4">
        <div className="glass-card max-w-md rounded-3xl bg-white p-8 text-center">
          <p className="text-red-600">Invalid or missing reset link.</p>
          <Link href="/forgot-password" className="mt-4 inline-block text-school-gold hover:underline">Request a new link</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-school-navy px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Link href="/"><SchoolLogo size="lg" light /></Link>
        </div>
        {done ? (
          <div className="glass-card rounded-3xl bg-white p-8 text-center shadow-soft-lg">
            <h2 className="font-display text-2xl font-bold text-school-navy">Password updated</h2>
            <p className="mt-2 text-sm text-slate-500">You can now sign in with your new password.</p>
            <Link href="/login" className="btn-gold mt-6 inline-block">Go to login</Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="glass-card rounded-3xl bg-white p-8 shadow-soft-lg">
            <h2 className="text-center font-display text-2xl font-bold text-school-navy">Choose a new password</h2>
            <p className="mt-2 text-center text-xs text-slate-500">At least 8 characters with upper, lower, and a number.</p>
            <div className="mt-6 space-y-4">
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="New password" className="w-full" required />
              <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Confirm password" className="w-full" required />
              {error && <p className="rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-700">{error}</p>}
              <button type="submit" disabled={loading} className="btn-gold w-full">
                {loading ? 'Saving...' : 'Reset password'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
