import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { SchoolLogo } from '../../components/public/Brand'
import { apiGet } from '../../lib/api'

export default function PaymentCallback() {
  const router = useRouter()
  const [status, setStatus] = useState<'loading' | 'success' | 'failed'>('loading')
  const [message, setMessage] = useState('Verifying payment…')

  useEffect(() => {
    const reference = router.query.reference
    if (!reference || typeof reference !== 'string') {
      setStatus('failed')
      setMessage('Missing payment reference.')
      return
    }
    apiGet<{ status: string }>(`/api/payments/paystack/verify?reference=${encodeURIComponent(reference)}`)
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
  }, [router.query.reference])

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
