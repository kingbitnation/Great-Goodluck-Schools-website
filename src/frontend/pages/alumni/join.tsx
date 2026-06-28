import { useEffect, useState } from 'react'
import Link from 'next/link'
import PublicLayout from '../../components/layout/PublicLayout'
import Reveal from '../../components/public/Reveal'

type SchoolInfo = { id: string; name: string }

export default function AlumniJoinPage() {
  const [school, setSchool] = useState<SchoolInfo | null>(null)
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    graduationYear: '',
    className: '',
    company: '',
    currentRole: '',
    bio: '',
    openToMentor: false,
  })
  const [status, setStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle')
  const [error, setError] = useState('')

  useEffect(() => {
    const base = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000'
    fetch(`${base}/api/public/alumni/school`)
      .then((r) => r.json())
      .then(setSchool)
      .catch(() => setSchool(null))
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!school?.id) return setError('School not found')
    setStatus('loading')
    setError('')
    try {
      const base = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000'
      const res = await fetch(`${base}/api/alumni/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolId: school.id,
          ...form,
          graduationYear: form.graduationYear ? Number(form.graduationYear) : null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Registration failed')
      setStatus('ok')
    } catch (err) {
      setStatus('error')
      setError(err instanceof Error ? err.message : 'Registration failed')
    }
  }

  return (
    <PublicLayout title="Join Alumni Network" subtitle="Stay connected with your alma mater">
      <Reveal>
        <form onSubmit={handleSubmit} className="glass-card mx-auto max-w-lg rounded-3xl p-7 sm:p-9">
          {school && <p className="text-sm text-slate-600 mb-4">Registering with {school.name}</p>}
          <div className="grid grid-cols-2 gap-3">
            <input required placeholder="First name" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} className="w-full" />
            <input required placeholder="Last name" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} className="w-full" />
          </div>
          <input required type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="mt-4 w-full" />
          <input placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="mt-4 w-full" />
          <div className="grid grid-cols-2 gap-3 mt-4">
            <input type="number" placeholder="Graduation year" value={form.graduationYear} onChange={(e) => setForm({ ...form, graduationYear: e.target.value })} className="w-full" />
            <input placeholder="Class" value={form.className} onChange={(e) => setForm({ ...form, className: e.target.value })} className="w-full" />
          </div>
          <input placeholder="Current role" value={form.currentRole} onChange={(e) => setForm({ ...form, currentRole: e.target.value })} className="mt-4 w-full" />
          <input placeholder="Company" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} className="mt-4 w-full" />
          <textarea rows={3} placeholder="Bio" value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} className="mt-4 w-full" />
          <label className="mt-4 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.openToMentor} onChange={(e) => setForm({ ...form, openToMentor: e.target.checked })} />
            I am open to mentoring current students
          </label>
          <button type="submit" disabled={status === 'loading'} className="btn-gold mt-6 w-full">
            {status === 'loading' ? 'Submitting...' : 'Join Network'}
          </button>
          {status === 'ok' && (
            <p className="mt-4 text-center text-sm text-emerald-600">
              Welcome to the alumni network!{' '}
              <Link href="/alumni/directory" className="underline">Browse directory</Link>
            </p>
          )}
          {error && <p className="mt-4 text-center text-sm text-red-600">{error}</p>}
        </form>
      </Reveal>
    </PublicLayout>
  )
}
