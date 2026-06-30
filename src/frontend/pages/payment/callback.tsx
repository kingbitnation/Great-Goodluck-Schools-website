import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { SchoolLogo } from '../../components/public/Brand'
import { apiGet } from '../../lib/api'

const VERIFY_PATHS: Record<string, string> = {
  paystack: '/api/payments/paystack/verify',
  flutterwave: '/api/payments/flutterwave/verify',
  stripe: '/api/payments/stripe/verify',
}

export default function PaymentCallback() {
  const router = useRouter()
  const [status, setStatus] = useState<'loading' | 'success' | 'failed'>('loading')
  const [message, setMessage] = useState('Verifying payment…')

  useEffect(() => {
    const reference = router.query.reference
    const gateway = typeof router.query.gateway === 'string' ? router.query.gateway : 'paystack'
    const sessionId = router.query.session_id

    if (!reference && !sessionId) {
      if (router.isReady) {
        setStatus('failed')
        setMessage('Missing payment reference.')
      }
      return
    }

    const path = VERIFY_PATHS[gateway] || VERIFY_PATHS.paystack
    const params = new URLSearchParams()
    if (reference && typeof reference === 'string') params.set('reference', reference)
    if (sessionId && typeof sessionId === 'string') params.set('session_id', sessionId)

    apiGet<{ status: string }>(`${path}?${params.toString()}`)
      .then((res) => {
        if (res.status === 'success') {
          setStatus('success')
          setMessage('Payment confirmed. Your receipt is ready.')
        } else {
          setStatus('failed')
          setMessage(`Payment status: ${res.status}`)
        }
      })
      .catch((e) => {
        setStatus('failed')
        setMessage(e.message || 'Verification failed')
      })
  }, [router.isReady, router.query.reference, router.query.gateway, router.query.session_id])

  return (
    <div className="flex min-h-screen items-center justify-center bg-school-navy px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-xl">
        <SchoolLogo size="md" light />
        <h1 className="mt-6 text-xl font-bold text-school-navy">
          {status === 'loading' ? 'Processing…' : status === 'success' ? 'Payment successful' : 'Payment issue'}
        </h1>
        <p className="mt-4 text-slate-600">{message}</p>
        <Link href="/student/fees" className="btn-gold mt-6 inline-block">Go to fees</Link>
      </div>
    </div>
  )
}
