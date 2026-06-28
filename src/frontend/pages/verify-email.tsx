import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { SchoolLogo } from '../components/public/Brand'

export default function VerifyEmail() {
  const router = useRouter()
  const token = typeof router.query.token === 'string' ? router.query.token : ''
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!router.isReady || !token) return
    const base = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000'
    fetch(`${base}/api/auth/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
      .then(async (res) => {
        const body = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(body?.error || 'Verification failed')
        setStatus('ok')
        setMessage(body.message || 'Email verified successfully')
      })
      .catch((err) => {
        setStatus('error')
        setMessage(err.message || 'Invalid or expired link')
      })
  }, [router.isReady, token])

  return (
    <div className="flex min-h-screen items-center justify-center bg-school-navy px-4">
      <div className="glass-card w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-soft-lg">
        <SchoolLogo size="md" light />
        <h2 className="mt-6 font-display text-2xl font-bold text-school-navy">Email verification</h2>
        {status === 'loading' && <p className="mt-4 text-slate-500">Verifying your email...</p>}
        {status === 'ok' && (
          <>
            <p className="mt-4 text-green-700">{message}</p>
            <Link href="/login" className="btn-gold mt-6 inline-block">Sign in</Link>
          </>
        )}
        {status === 'error' && (
          <>
            <p className="mt-4 text-red-600">{message}</p>
            <Link href="/login" className="mt-6 inline-block text-school-gold hover:underline">Back to login</Link>
          </>
        )}
      </div>
    </div>
  )
}
