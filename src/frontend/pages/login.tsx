import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/router'
import { apiBaseUrl, parseJsonResponse } from '../lib/apiBase'
import { saveToken } from '../lib/auth'
import { ROLE_HOME } from '../lib/navigation'
import { SchoolLogo } from '../components/public/Brand'
import { ThemeToggle } from '../components/ThemeProvider'
import { FieldGroup, Input, SkipLink } from '../components/ui'
import Seo from '../components/Seo'
import DashboardPreview from '../components/public/DashboardPreview'

const PORTAL_FEATURES = [
  'Real-time attendance & results',
  'Online fee payments',
  'CBT exams & LMS courses',
  'AI-powered insights',
]

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [twoFactorCode, setTwoFactorCode] = useState('')
  const [tempToken, setTempToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

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
      const res = await fetch(`${apiBaseUrl()}/api/auth/login`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const body = await parseJsonResponse<{
        accessToken?: string
        requires2FA?: boolean
        tempToken?: string
        user?: { role?: string }
        error?: string
        message?: string
      }>(res)
      if (!res.ok) throw new Error(body?.error || body?.message || 'Login failed')

      if (body.requires2FA && body.tempToken) {
        setTempToken(body.tempToken)
        return
      }

      if (body?.accessToken) {
        await completeLogin({ accessToken: body.accessToken, user: body.user || {} })
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
      const res = await fetch(`${apiBaseUrl()}/api/auth/login/2fa`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tempToken, code: twoFactorCode }),
      })
      const body = await parseJsonResponse<{
        accessToken?: string
        user?: { role?: string }
        error?: string
      }>(res)
      if (!res.ok) throw new Error(body?.error || 'Invalid code')
      if (body?.accessToken) {
        await completeLogin({ accessToken: body.accessToken, user: body.user || {} })
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
    <div className="exclusive-scene relative flex min-h-screen overflow-x-hidden">
      <Seo title="Portal Login" description="Sign in to your SchoolPilot school portal." path="/login" noIndex />
      <SkipLink href="#login-form" />

      <div className="pointer-events-none absolute inset-0">
        <div className="animate-orb absolute -left-32 top-0 h-96 w-96 rounded-full bg-school-royal/25 blur-[100px]" />
        <div className="animate-orb animation-delay-2000 absolute right-0 top-1/3 h-80 w-80 rounded-full bg-school-gold/15 blur-[90px]" />
        <div className="absolute inset-0 bg-noise opacity-25" />
      </div>

      <div className="absolute right-4 top-4 z-20">
        <ThemeToggle />
      </div>

      <div className="relative z-10 grid w-full lg:grid-cols-2">
        <div className="hidden flex-col justify-center px-8 py-12 lg:flex lg:px-12 xl:px-16">
          <Link href="/" aria-label="Back to website home" className="mb-10 inline-block w-fit">
            <SchoolLogo size="lg" light />
          </Link>

          <div className="animate-fade-up max-w-lg">
            <div className="badge-exclusive mb-6">Members only</div>
            <h1 className="font-display text-4xl font-extrabold leading-tight text-white xl:text-5xl">
              Welcome back to{' '}
              <span className="text-shimmer">SchoolPilot</span>
            </h1>
            <p className="mt-4 text-base leading-relaxed text-slate-300">
              Sign in to manage academics, fees, attendance, and communication — all from one secure dashboard.
            </p>

            <ul className="mt-8 space-y-3">
              {PORTAL_FEATURES.map((feature) => (
                <li key={feature} className="flex items-center gap-3 text-sm text-slate-400">
                  <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-school-green/20 text-school-green">
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </span>
                  {feature}
                </li>
              ))}
            </ul>
          </div>

          <div className="animate-fade-up mt-12 max-w-md" style={{ animationDelay: '0.15s' }}>
            <DashboardPreview className="scale-90 origin-left opacity-90" />
          </div>
        </div>

        <div className="flex flex-col items-center justify-center px-4 py-10 sm:px-6 lg:px-12 lg:py-16">
          <div className="mb-8 flex justify-center lg:hidden">
            <Link href="/" aria-label="Back to website home">
              <SchoolLogo size="lg" light />
            </Link>
          </div>

          <div className="w-full max-w-md">
            <form
              id="login-form"
              onSubmit={tempToken ? handle2FA : handleSubmit}
              className="card-luxury rounded-3xl border border-white/10 bg-white/[0.04] p-8 shadow-luxury backdrop-blur-xl sm:p-10"
              aria-labelledby="login-heading"
            >
              <div className="mx-auto mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-school-royal to-blue-600 text-white shadow-soft">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499a1.875 1.875 0 011.563-.43 6 6 0 017.029-5.912z" />
                </svg>
              </div>

              <h2 id="login-heading" className="text-center font-display text-2xl font-bold text-school-navy dark:text-school-text">
                {tempToken ? 'Two-Factor Authentication' : 'Portal Login'}
              </h2>
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
                <button type="submit" disabled={loading} className="btn-exclusive w-full" aria-busy={loading}>
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
                    <Link href="/forgot-password" className="font-medium text-school-royal hover:text-school-gold">
                      Forgot password?
                    </Link>
                  </p>
                )}
              </FieldGroup>
            </form>

            <p className="mt-6 text-center text-sm text-slate-400">
              New school?{' '}
              <Link href="/register-school" className="font-semibold text-school-gold hover:underline">
                Start free trial
              </Link>
            </p>
            <p className="mt-3 text-center text-sm">
              <Link href="/" className="text-slate-500 hover:text-school-gold">← Back to website</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
