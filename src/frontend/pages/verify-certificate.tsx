import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import PublicLayout from '../components/layout/PublicLayout'

type VerifyResult = {
  valid: boolean
  revoked?: boolean
  source?: string
  certificateType?: string
  title?: string
  certificateNumber?: string
  recipientName?: string
  studentName?: string
  schoolName?: string
  courseTitle?: string
  description?: string
  sessionLabel?: string
  className?: string
  issuedAt?: string
  error?: string
}

export default function VerifyCertificatePage() {
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
      const res = await fetch(`${base}/api/public/certificates/verify/${encodeURIComponent(verifyCode)}`)
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

  const typeLabel = (t?: string) => {
    if (!t) return 'Certificate'
    if (t === 'course_completion') return 'Course completion'
    if (t === 'graduation') return 'Graduation'
    if (t === 'attendance') return 'Attendance'
    if (t === 'excellence') return 'Excellence'
    return t
  }

  const displayName = result?.recipientName || result?.studentName

  return (
    <PublicLayout title="Verify Certificate" subtitle="Confirm graduation, attendance, excellence, and course credentials">
      <div className="mx-auto max-w-lg px-4 py-12">
        <form onSubmit={handleSubmit} className="content-card space-y-4 p-6">
          <label className="block text-sm font-medium text-school-navy">Verification code or scan QR from certificate</label>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Enter code from certificate"
            className="w-full"
          />
          <button type="submit" disabled={loading} className="btn-gold w-full">
            {loading ? 'Verifying...' : 'Verify'}
          </button>
        </form>

        {result && (
          <div className={`mt-6 content-card p-6 ${result.valid ? 'border-green-200' : 'border-red-200'}`}>
            {result.valid ? (
              <>
                <p className="font-semibold text-green-700">Valid certificate</p>
                <p className="text-sm text-slate-500 mt-1">{typeLabel(result.certificateType)} · {result.title || result.courseTitle}</p>
                <dl className="mt-4 space-y-2 text-sm">
                  <div><dt className="text-slate-500">Recipient</dt><dd className="font-medium">{displayName}</dd></div>
                  <div><dt className="text-slate-500">School</dt><dd className="font-medium">{result.schoolName}</dd></div>
                  {result.courseTitle && (
                    <div><dt className="text-slate-500">Course</dt><dd className="font-medium">{result.courseTitle}</dd></div>
                  )}
                  {result.className && (
                    <div><dt className="text-slate-500">Class</dt><dd>{result.className}</dd></div>
                  )}
                  {result.sessionLabel && (
                    <div><dt className="text-slate-500">Session</dt><dd>{result.sessionLabel}</dd></div>
                  )}
                  {result.description && (
                    <div><dt className="text-slate-500">Details</dt><dd>{result.description}</dd></div>
                  )}
                  <div><dt className="text-slate-500">Certificate No.</dt><dd>{result.certificateNumber}</dd></div>
                  <div><dt className="text-slate-500">Issued</dt><dd>{result.issuedAt ? new Date(result.issuedAt).toLocaleDateString() : '—'}</dd></div>
                </dl>
              </>
            ) : (
              <p className="text-red-700">{result.revoked ? 'This certificate has been revoked' : (result.error || 'Certificate not found')}</p>
            )}
          </div>
        )}
      </div>
    </PublicLayout>
  )
}
