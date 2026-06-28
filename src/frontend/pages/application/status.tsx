import { useState } from 'react'
import Link from 'next/link'
import PublicLayout from '../../components/layout/PublicLayout'
import Reveal from '../../components/public/Reveal'

type TrackResult = {
  referenceNo: string
  studentName: string
  gradeApplied: string
  status: string
  schoolName: string
  examScore?: number | null
  submittedAt: string
  timeline: Array<{ toStatus: string; note?: string; createdAt: string }>
  interviews: Array<{ scheduledAt: string; location?: string; outcome?: string }>
}

export default function ApplicationStatusPage() {
  const [referenceNo, setReferenceNo] = useState('')
  const [email, setEmail] = useState('')
  const [result, setResult] = useState<TrackResult | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleTrack(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const base = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000'
      const params = new URLSearchParams({ referenceNo, email })
      const res = await fetch(`${base}/api/public/admissions/track?${params}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Not found')
      setResult(data)
    } catch (err: any) {
      setError(err.message || 'Application not found')
    } finally {
      setLoading(false)
    }
  }

  return (
    <PublicLayout title="Track Application" subtitle="Check your admission application status">
      <Reveal>
        <form onSubmit={handleTrack} className="glass-card mx-auto max-w-lg rounded-3xl p-7 sm:p-9">
          <input
            required
            placeholder="Reference number (e.g. APP-...)"
            value={referenceNo}
            onChange={(e) => setReferenceNo(e.target.value)}
            className="w-full"
          />
          <input
            required
            type="email"
            placeholder="Parent email used on application"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-4 w-full"
          />
          <button type="submit" disabled={loading} className="btn-gold mt-6 w-full">
            {loading ? 'Looking up…' : 'Track status'}
          </button>
          {error && <p className="mt-4 text-center text-sm text-red-600">{error}</p>}
        </form>

        {result && (
          <div className="glass-card mx-auto mt-8 max-w-lg rounded-3xl p-7">
            <h2 className="font-display text-xl font-semibold text-school-navy">{result.studentName}</h2>
            <p className="font-mono text-sm text-slate-500">{result.referenceNo}</p>
            <p className="mt-2 text-sm">{result.schoolName} · {result.gradeApplied}</p>
            <p className="mt-4 inline-block rounded-full bg-school-gold/20 px-3 py-1 text-sm font-medium capitalize text-school-navy">
              {result.status.replace(/_/g, ' ')}
            </p>
            {result.examScore != null && (
              <p className="mt-2 text-sm text-slate-600">Entrance exam score: {result.examScore}%</p>
            )}
            <h3 className="mt-6 text-sm font-semibold uppercase tracking-wide text-slate-500">Timeline</h3>
            <ul className="mt-3 space-y-3 text-sm">
              {result.timeline.map((log, i) => (
                <li key={i} className="border-l-2 border-school-gold pl-3">
                  <span className="font-medium capitalize">{log.toStatus.replace(/_/g, ' ')}</span>
                  <span className="ml-2 text-slate-400">{new Date(log.createdAt).toLocaleDateString()}</span>
                  {log.note && <p className="text-slate-600">{log.note}</p>}
                </li>
              ))}
            </ul>
            {result.interviews.length > 0 && (
              <>
                <h3 className="mt-6 text-sm font-semibold uppercase tracking-wide text-slate-500">Interviews</h3>
                <ul className="mt-2 space-y-1 text-sm text-slate-600">
                  {result.interviews.map((iv, i) => (
                    <li key={i}>
                      {new Date(iv.scheduledAt).toLocaleString()}
                      {iv.location ? ` · ${iv.location}` : ''}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}

        <p className="mx-auto mt-6 max-w-lg text-center text-sm text-slate-500">
          New applicant? <Link href="/apply" className="text-school-navy underline">Apply online</Link>
        </p>
      </Reveal>
    </PublicLayout>
  )
}
