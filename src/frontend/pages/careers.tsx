import { useEffect, useState } from 'react'
import Link from 'next/link'
import PublicLayout from '../components/layout/PublicLayout'

type Job = {
  id: string
  title: string
  department?: string
  description?: string
  employmentType: string
  schoolName?: string
}

export default function CareersPage() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [applyJob, setApplyJob] = useState<Job | null>(null)
  const [form, setForm] = useState({ fullName: '', email: '', phone: '', coverLetter: '' })
  const [status, setStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle')
  const [referenceNo, setReferenceNo] = useState('')

  useEffect(() => {
    const base = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000'
    fetch(`${base}/api/public/jobs`)
      .then((r) => r.json())
      .then(setJobs)
      .finally(() => setLoading(false))
  }, [])

  async function handleApply(e: React.FormEvent) {
    e.preventDefault()
    if (!applyJob) return
    setStatus('loading')
    try {
      const base = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000'
      const res = await fetch(`${base}/api/public/jobs/${applyJob.id}/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setReferenceNo(data.referenceNo)
      setStatus('ok')
      setForm({ fullName: '', email: '', phone: '', coverLetter: '' })
    } catch {
      setStatus('error')
    }
  }

  return (
    <PublicLayout title="Careers" subtitle="Join our team">
      {loading ? (
        <p className="text-slate-500">Loading openings…</p>
      ) : jobs.length === 0 ? (
        <p className="text-slate-600">No open positions at the moment. Check back soon.</p>
      ) : (
        <div className="max-w-2xl space-y-4">
          {jobs.map((j) => (
            <div key={j.id} className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
              <div>
                <p className="font-semibold">{j.title}</p>
                <p className="text-sm text-gray-500">
                  {j.department || 'General'} · {j.employmentType.replace(/_/g, ' ')}
                </p>
              </div>
              <button type="button" onClick={() => { setApplyJob(j); setStatus('idle') }} className="text-sm font-medium text-blue-600 hover:underline">
                Apply
              </button>
            </div>
          ))}
        </div>
      )}

      {applyJob && status !== 'ok' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form onSubmit={handleApply} className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold">Apply: {applyJob.title}</h3>
            <input required placeholder="Full name" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} className="mt-4 w-full rounded border p-2" />
            <input required type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="mt-3 w-full rounded border p-2" />
            <input placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="mt-3 w-full rounded border p-2" />
            <textarea rows={4} placeholder="Cover letter" value={form.coverLetter} onChange={(e) => setForm({ ...form, coverLetter: e.target.value })} className="mt-3 w-full rounded border p-2" />
            <div className="mt-4 flex gap-2">
              <button type="submit" disabled={status === 'loading'} className="rounded bg-school-navy px-4 py-2 text-sm text-white">
                {status === 'loading' ? 'Submitting…' : 'Submit'}
              </button>
              <button type="button" onClick={() => setApplyJob(null)} className="rounded border px-4 py-2 text-sm">Cancel</button>
            </div>
            {status === 'error' && <p className="mt-2 text-sm text-red-600">Submission failed</p>}
          </form>
        </div>
      )}

      {status === 'ok' && (
        <div className="mt-6 rounded-lg bg-green-50 p-4 text-green-800">
          Application submitted. Reference: <strong className="font-mono">{referenceNo}</strong>
          <button type="button" onClick={() => { setApplyJob(null); setStatus('idle') }} className="ml-4 underline">Close</button>
        </div>
      )}

      <p className="mt-8 text-sm text-slate-500">
        Staff member? <Link href="/login" className="text-school-navy underline">Sign in to the portal</Link>
      </p>
    </PublicLayout>
  )
}
