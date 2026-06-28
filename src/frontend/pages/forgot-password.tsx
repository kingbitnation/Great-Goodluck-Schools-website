import Link from 'next/link'
import { useState } from 'react'
import { SchoolLogo } from '../components/public/Brand'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setMessage(null)
    try {
      const base = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000'
      const res = await fetch(`${base}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body?.error || 'Request failed')
      setMessage(body.message || 'If the email exists, a reset link was sent.')
    } catch (err: any) {
      setError(err.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-school-navy px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Link href="/"><SchoolLogo size="lg" light /></Link>
        </div>
        <form onSubmit={handleSubmit} className="glass-card rounded-3xl bg-white p-8 shadow-soft-lg">
          <h2 className="text-center font-display text-2xl font-bold text-school-navy">Reset password</h2>
          <p className="mt-2 text-center text-sm text-slate-500">We will email you a secure reset link.</p>
          <div className="mt-6 space-y-4">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email address"
              className="w-full"
              required
            />
            {message && <p className="rounded-xl bg-green-50 px-4 py-2.5 text-sm text-green-800">{message}</p>}
            {error && <p className="rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-700">{error}</p>}
            <button type="submit" disabled={loading} className="btn-gold w-full">
              {loading ? 'Sending...' : 'Send reset link'}
            </button>
          </div>
        </form>
        <p className="mt-6 text-center text-sm">
          <Link href="/login" className="text-school-gold hover:underline">← Back to login</Link>
        </p>
      </div>
    </div>
  )
}
