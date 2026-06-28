import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import PublicLayout from '../components/layout/PublicLayout'

type VerifyResult = {
  valid: boolean
  status?: string
  cardType?: string
  cardNumber?: string
  holderName?: string
  roleLabel?: string
  departmentOrClass?: string
  idNumber?: string
  schoolName?: string
  issuedAt?: string
  expiresAt?: string
  expired?: boolean
  revoked?: boolean
  error?: string
}

export default function VerifyIdCardPage() {
  const router = useRouter()
  const [result, setResult] = useState<VerifyResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [code, setCode] = useState('')

  useEffect(() => {
    const q = router.query.code
    if (typeof q === 'string' && q) {
      setCode(q)
      verify(q)
    }
  }, [router.query.code])

  async function verify(verifyCode: string) {
    setLoading(true)
    try {
      const base = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000'
      const res = await fetch(`${base}/api/public/id-cards/verify/${encodeURIComponent(verifyCode)}`)
      const body = await res.json()
      setResult(body)
    } catch {
      setResult({ valid: false, error: 'Verification failed' })
    } finally {
      setLoading(false)
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (code.trim()) verify(code.trim())
  }

  return (
    <PublicLayout title="Verify ID Card" subtitle="Confirm student and staff identity cards">
      <div className="mx-auto max-w-lg px-4 py-12">
        <form onSubmit={handleSubmit} className="content-card space-y-4 p-6">
          <label className="block text-sm font-medium text-school-navy">Verification code or QR scan result</label>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Enter code from ID card"
            className="w-full"
          />
          <button type="submit" disabled={loading} className="btn-gold w-full">
            {loading ? 'Verifying...' : 'Verify ID card'}
          </button>
        </form>

        {result && (
          <div className={`mt-6 content-card p-6 ${result.valid ? 'border-green-200' : 'border-red-200'}`}>
            {result.valid ? (
              <>
                <p className="font-semibold text-green-700">Valid ID card</p>
                <p className="text-sm text-slate-500 mt-1 capitalize">{result.cardType} · {result.roleLabel}</p>
                <dl className="mt-4 space-y-2 text-sm">
                  <div><dt className="text-slate-500">Name</dt><dd className="font-medium">{result.holderName}</dd></div>
                  <div><dt className="text-slate-500">School</dt><dd className="font-medium">{result.schoolName}</dd></div>
                  {result.departmentOrClass && (
                    <div><dt className="text-slate-500">{result.cardType === 'staff' ? 'Department' : 'Class'}</dt><dd>{result.departmentOrClass}</dd></div>
                  )}
                  {result.idNumber && (
                    <div><dt className="text-slate-500">ID number</dt><dd>{result.idNumber}</dd></div>
                  )}
                  <div><dt className="text-slate-500">Card number</dt><dd className="font-mono">{result.cardNumber}</dd></div>
                  <div><dt className="text-slate-500">Issued</dt><dd>{result.issuedAt ? new Date(result.issuedAt).toLocaleDateString() : '—'}</dd></div>
                  <div><dt className="text-slate-500">Expires</dt><dd>{result.expiresAt ? new Date(result.expiresAt).toLocaleDateString() : '—'}</dd></div>
                </dl>
              </>
            ) : (
              <p className="text-red-700">
                {result.revoked ? 'This ID card has been revoked' : result.expired ? 'This ID card has expired' : (result.error || 'ID card not found')}
              </p>
            )}
          </div>
        )}
      </div>
    </PublicLayout>
  )
}
