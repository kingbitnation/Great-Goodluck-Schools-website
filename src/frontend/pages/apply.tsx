import { useState } from 'react'
import Link from 'next/link'
import PublicLayout from '../components/layout/PublicLayout'
import Reveal from '../components/public/Reveal'

export default function ApplyPage() {
  const [form, setForm] = useState({
    studentName: '',
    parentName: '',
    email: '',
    phone: '',
    grade: '',
    message: '',
  })
  const [status, setStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle')
  const [referenceNo, setReferenceNo] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('loading')
    try {
      const base = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000'
      const res = await fetch(`${base}/api/public/admissions/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      setReferenceNo(data.referenceNo || '')
      setStatus('ok')
      setForm({ studentName: '', parentName: '', email: '', phone: '', grade: '', message: '' })
    } catch {
      setStatus('error')
    }
  }

  return (
    <PublicLayout title="Apply Online" subtitle="Start your admission application">
      <Reveal>
        <form onSubmit={handleSubmit} className="glass-card mx-auto max-w-lg rounded-3xl p-7 sm:p-9">
          <input required placeholder="Student full name" value={form.studentName} onChange={(e) => setForm({ ...form, studentName: e.target.value })} className="w-full" />
          <input required placeholder="Parent / guardian name" value={form.parentName} onChange={(e) => setForm({ ...form, parentName: e.target.value })} className="mt-4 w-full" />
          <input required type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="mt-4 w-full" />
          <input required placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="mt-4 w-full" />
          <select required value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value })} className="mt-4 w-full">
            <option value="">Select grade</option>
            <option>Nursery</option>
            <option>Primary 1</option>
            <option>JSS 1</option>
            <option>SSS 1</option>
          </select>
          <textarea rows={4} placeholder="Additional information" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} className="mt-4 w-full" />
          <button type="submit" disabled={status === 'loading'} className="btn-gold mt-6 w-full">
            {status === 'loading' ? 'Submitting...' : 'Submit Application'}
          </button>
          {status === 'ok' && (
            <div className="mt-4 text-center text-sm text-emerald-600">
              <p>Application received.</p>
              {referenceNo && (
                <p className="mt-2 font-mono font-medium">
                  Reference: {referenceNo}
                </p>
              )}
              <p className="mt-2">
                <Link href="/application/status" className="underline">Track your application</Link>
              </p>
            </div>
          )}
          {status === 'error' && <p className="mt-4 text-center text-sm text-red-600">Submission failed. Please try again.</p>}
        </form>
      </Reveal>
    </PublicLayout>
  )
}
