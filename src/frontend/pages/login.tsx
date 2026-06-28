import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/router'
import { saveToken } from '../lib/auth'
import { ROLE_HOME } from '../lib/navigation'
import { SchoolLogo } from '../components/public/Brand'
import { ThemeToggle } from '../components/ThemeProvider'
import { FieldGroup, Input, SkipLink } from '../components/ui'
import Seo from '../components/Seo'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [twoFactorCode, setTwoFactorCode] = useState('')
  const [tempToken, setTempToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const base = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000'

  async function completeLogin(data: { accessToken: string; user: { role?: string } }) {
    saveToken(data.accessToken)
    const role = data.user?.role || 'SuperAdmin'
    router.push(ROLE_HOME[role] || '/dashboard')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${base}/api/auth/login`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body?.error || body?.message || 'Login failed')

      if (body.requires2FA && body.tempToken) {
        setTempToken(body.tempToken)
        return
      }

      if (body?.accessToken) {
        await completeLogin(body)
      } else {
        throw new Error('No token returned')
      }
    } catch (err: any) {
      setError(err.message || 'Login error')
    } finally {
      setLoading(false)
    }
  }

  async function handle2FA(e: React.FormEvent) {
    e.preventDefault()
    if (!tempToken) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${base}/api/auth/login/2fa`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tempToken, code: twoFactorCode }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body?.error || 'Invalid code')
      if (body?.accessToken) {
        await completeLogin(body)
      } else {
        throw new Error('No token returned')
      }
    } catch (err: any) {
      setError(err.message || 'Verification failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-x-hidden bg-school-navy px-4">
      <Seo title="Portal Login" description="Sign in to your SchoolPilot school portal." path="/login" noIndex />
      <SkipLink href="#login-form" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(245,179,1,0.12),transparent_60%)]" />
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <div className="relative w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Link href="/" aria-label="Back to website home">
            <SchoolLogo size="lg" light />
          </Link>
        </div>
        <form
          id="login-form"
          onSubmit={tempToken ? handle2FA : handleSubmit}
          className="glass-card rounded-3xl p-8 shadow-soft-lg sm:p-10"
          aria-labelledby="login-heading"
        >
          <h1 id="login-heading" className="text-center font-display text-2xl font-bold text-school-navy dark:text-school-text">
            {tempToken ? 'Two-Factor Authentication' : 'Portal Login'}
          </h1>
          <p className="mt-1 text-center text-sm text-school-muted">
            {tempToken ? 'Enter the code from your authenticator app' : 'Sign in to your account'}
          </p>
          <FieldGroup className="mt-7">
            {!tempToken ? (
              <>
                <Input
                  label="Email address"
                  type="email"
                  name="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@school.edu"
                  required
                />
                <Input
                  label="Password"
                  type="password"
                  name="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </>
            ) : (
              <Input
                label="Authentication code"
                type="text"
                name="otp"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={twoFactorCode}
                onChange={(e) => setTwoFactorCode(e.target.value)}
                placeholder="6-digit code"
                className="text-center tracking-widest"
                required
              />
            )}
            {error && (
              <p role="alert" className="rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300">
                {error}
              </p>
            )}
            <button type="submit" disabled={loading} className="btn-gold w-full" aria-busy={loading}>
              {loading ? 'Please wait...' : tempToken ? 'Verify' : 'Sign in'}
            </button>
            {tempToken && (
              <button
                type="button"
                className="w-full text-sm text-school-muted hover:text-school-text"
                onClick={() => { setTempToken(null); setTwoFactorCode(''); setError(null) }}
              >
                ← Back to login
              </button>
            )}
            {!tempToken && (
              <p className="text-center text-sm">
                <Link href="/forgot-password" className="text-school-gold hover:underline">
                  Forgot password?
                </Link>
              </p>
            )}
          </FieldGroup>
        </form>
        <p className="mt-6 text-center text-sm">
          <Link href="/" className="text-school-gold hover:underline">← Back to website</Link>
        </p>
      </div>
    </div>
  )
}
