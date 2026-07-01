import { useEffect, useState, type FormEvent } from 'react'
import { useRouter } from 'next/router'
import AppLayout from '../../components/layout/AppLayout'
import { withAuth } from '../../components/withAuth'
import { apiDelete, apiGet, apiPost } from '../../lib/api'
import type { AuthUser } from '../../lib/useAuth'

type Student = {
  id: string
  admissionNo: string
  user: { firstName: string; lastName: string; email: string }
  class?: { name: string; level: string } | null
}

type StudentFormErrors = {
  email?: string
  password?: string
  firstName?: string
  lastName?: string
  admissionNo?: string
  dob?: string
  gender?: string
  address?: string
}

const fieldClass = 'portal-input w-full rounded-md border px-3 py-2 text-sm'

function StudentsPage({ user }: { user: AuthUser }) {
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<StudentFormErrors>({})
  const [query, setQuery] = useState('')
  const [classFilter, setClassFilter] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(12)
  const [total, setTotal] = useState<number | null>(null)
  const [classOptions, setClassOptions] = useState<{ id: string; name: string }[]>([])
  const [selectedClassId, setSelectedClassId] = useState('')
  const [promotionStudentId, setPromotionStudentId] = useState<string | null>(null)
  const [promotionClassId, setPromotionClassId] = useState('')
  const [promotionError, setPromotionError] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    loadPage(page)
  }, [user.schoolId, query, classFilter, page, pageSize])

  useEffect(() => {
    const qs = new URLSearchParams()
    if (user.schoolId) qs.set('schoolId', user.schoolId)
    apiGet<{ id: string; name: string }[]>(`/api/classes?${qs.toString()}`)
      .then(setClassOptions)
      .catch((e) => setError(e.message))
  }, [user.schoolId])

  const [email, setEmail] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [password, setPassword] = useState('')
  const [admissionNo, setAdmissionNo] = useState('')
  const [dob, setDob] = useState('')
  const [gender, setGender] = useState('')
  const [address, setAddress] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<string | null>(null)

  async function handleExportStudents() {
    const token = localStorage.getItem('sp_token') || localStorage.getItem('sms_token')
    const base = typeof window !== 'undefined' ? '' : (process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000')
    const qs = user.schoolId ? `?schoolId=${user.schoolId}` : ''
    const res = await fetch(`${base}/api/export/students${qs}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      credentials: 'include',
    })
    if (!res.ok) {
      setError('Export failed')
      return
    }
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'students-export.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleImportCsv(file: File) {
    setImporting(true)
    setImportResult(null)
    setError(null)
    try {
      const csv = await file.text()
      const res = await apiPost<{ created: number; skipped: number; errors: Array<{ row: number; error: string }> }>(
        '/api/import/students',
        { csv, schoolId: user.schoolId, defaultPassword: 'ChangeMe123!' }
      )
      setImportResult(`Imported ${res.created} students. Skipped ${res.skipped}.`)
      if (res.errors.length) setError(`${res.errors.length} row(s) had errors.`)
      loadPage(1)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setImporting(false)
    }
  }

  async function handleAddStudent(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    setFieldErrors({})

    const validationErrors: StudentFormErrors = {}
    if (!/\S+@\S+\.\S+/.test(email)) validationErrors.email = 'Please enter a valid email'
    if (password.length < 6) validationErrors.password = 'Password must be at least 6 characters'
    if (!firstName.trim()) validationErrors.firstName = 'First name is required'
    if (!lastName.trim()) validationErrors.lastName = 'Last name is required'
    if (dob && Number.isNaN(Date.parse(dob))) validationErrors.dob = 'Date of birth is invalid'
    if (gender && !['Male', 'Female', 'Other'].includes(gender)) validationErrors.gender = 'Please select a valid gender'

    if (Object.keys(validationErrors).length) {
      setFieldErrors(validationErrors)
      setSubmitting(false)
      return
    }

    try {
      await apiPost('/api/students', {
        email,
        password,
        firstName,
        lastName,
        admissionNo,
        classId: selectedClassId || undefined,
        dob,
        gender,
        address,
      })
      setEmail('')
      setFirstName('')
      setLastName('')
      setPassword('')
      setAdmissionNo('')
      setSelectedClassId('')
      setDob('')
      setGender('')
      setAddress('')
      setFieldErrors({})
      setPage(1)
      await loadPage(1)
    } catch (err: any) {
      setError(err.message)
      if (err?.fields) setFieldErrors(err.fields)
    } finally {
      setSubmitting(false)
    }
  }

  async function loadPage(p = page) {
    setLoading(true)
    const qs = new URLSearchParams()
    if (user.schoolId) qs.set('schoolId', user.schoolId)
    if (query) qs.set('q', query)
    if (classFilter) qs.set('classId', classFilter)
    qs.set('page', String(p))
    qs.set('pageSize', String(pageSize))
    try {
      const res = await apiGet<{ data: Student[]; total: number }>(`/api/students/search?${qs.toString()}`)
      setStudents(res.data)
      setTotal(res.total)
      setError(null)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleDeleteStudent(id: string) {
    if (!confirm('Delete this student? This action cannot be undone.')) return
    try {
      await apiDelete(`/api/students/${id}`)
      loadPage(page)
    } catch (e: any) {
      setError(e.message)
    }
  }

  function startPromotion(studentId: string) {
    setPromotionStudentId(studentId)
    setPromotionError(null)
    setPromotionClassId('')
  }

  async function confirmPromotion() {
    if (!promotionStudentId || !promotionClassId) {
      setPromotionError('Select a class before promoting.')
      return
    }
    try {
      await apiPost(`/api/students/${promotionStudentId}/promote`, { newClassId: promotionClassId })
      setPromotionStudentId(null)
      setPromotionClassId('')
      setPromotionError(null)
      loadPage(page)
    } catch (e: any) {
      setPromotionError(e.message)
    }
  }

  const selectedPromotionStudent = students.find((s) => s.id === promotionStudentId)

  return (
    <AppLayout user={user} title="Students">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <button type="button" onClick={handleExportStudents} className="rounded-md border border-school-border px-3 py-2 text-sm text-school-text hover:bg-school-surface">
          Export CSV
        </button>
        <label className="cursor-pointer rounded-md border border-school-border px-3 py-2 text-sm text-school-text hover:bg-school-surface">
          {importing ? 'Importing…' : 'Import CSV'}
          <input type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => e.target.files?.[0] && handleImportCsv(e.target.files[0])} />
        </label>
        {importResult && <p className="text-sm text-green-700">{importResult}</p>}
      </div>

      <form onSubmit={handleAddStudent} className="content-card mb-6 p-5">
        <h2 className="mb-4 text-sm font-semibold text-school-text">Register student</h2>
        <p className="mb-4 text-xs text-school-muted">The field beside email is the student&apos;s login password (not their email again).</p>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-school-muted">Email</label>
            <input required value={email} onChange={(e) => setEmail(e.target.value)} className={fieldClass} type="email" autoComplete="off" />
            {fieldErrors.email && <p className="mt-1 text-xs text-red-600">{fieldErrors.email}</p>}
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-school-muted">Login password</label>
            <input required value={password} onChange={(e) => setPassword(e.target.value)} className={fieldClass} type="password" autoComplete="new-password" />
            {fieldErrors.password && <p className="mt-1 text-xs text-red-600">{fieldErrors.password}</p>}
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-school-muted">First name</label>
            <input required value={firstName} onChange={(e) => setFirstName(e.target.value)} className={fieldClass} />
            {fieldErrors.firstName && <p className="mt-1 text-xs text-red-600">{fieldErrors.firstName}</p>}
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-school-muted">Last name</label>
            <input required value={lastName} onChange={(e) => setLastName(e.target.value)} className={fieldClass} />
            {fieldErrors.lastName && <p className="mt-1 text-xs text-red-600">{fieldErrors.lastName}</p>}
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-school-muted">Class (optional)</label>
            <select value={selectedClassId} onChange={(e) => setSelectedClassId(e.target.value)} className={fieldClass}>
              <option value="">No class yet</option>
              {classOptions.map((cls) => (
                <option key={cls.id} value={cls.id}>{cls.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-school-muted">Date of birth (optional)</label>
            <input value={dob} onChange={(e) => setDob(e.target.value)} className={fieldClass} type="date" />
            {fieldErrors.dob && <p className="mt-1 text-xs text-red-600">{fieldErrors.dob}</p>}
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-school-muted">Gender (optional)</label>
            <select value={gender} onChange={(e) => setGender(e.target.value)} className={fieldClass}>
              <option value="">Select gender</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-school-muted">Admission number (optional)</label>
            <input value={admissionNo} onChange={(e) => setAdmissionNo(e.target.value)} className={fieldClass} placeholder="Auto-generated if empty" />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-xs font-medium text-school-muted">Address (optional)</label>
            <input value={address} onChange={(e) => setAddress(e.target.value)} className={fieldClass} />
          </div>
        </div>
        <button type="submit" disabled={submitting} className="btn-gold mt-4">
          {submitting ? 'Registering...' : 'Register student'}
        </button>
      </form>

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">{error}</div>
      )}

      {loading ? (
        <p className="text-school-muted">Loading students...</p>
      ) : students.length === 0 ? (
        <div className="content-card border-dashed p-8 text-center">
          <p className="text-school-text">No students enrolled yet.</p>
          <p className="mt-1 text-sm text-school-muted">Use the form above to register your first student.</p>
        </div>
      ) : (
        <div className="content-card overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-school-border p-4 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-col gap-3 md:flex-row md:items-center">
              <div className="flex items-center gap-2">
                <label className="text-sm text-school-muted">Search</label>
                <input
                  value={query}
                  onChange={(e) => { setQuery(e.target.value); setPage(1) }}
                  placeholder="Name, email, or admission no."
                  className={`${fieldClass} md:w-80`}
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-school-muted">Class</label>
                <select value={classFilter} onChange={(e) => { setClassFilter(e.target.value); setPage(1) }} className={fieldClass}>
                  <option value="">All classes</option>
                  {classOptions.map((cls) => (
                    <option key={cls.id} value={cls.id}>{cls.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-school-muted">Per page</label>
                <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1) }} className={fieldClass}>
                  {[12, 25, 50, 100].map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="text-sm text-school-muted">Showing {students.length} of {total ?? 0}</div>
          </div>
          <table className="min-w-full text-sm">
            <thead className="bg-school-bg text-left text-school-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Admission No</th>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Class</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-school-border">
              {students.map((s) => (
                <tr key={s.id} className="hover:bg-school-bg/50">
                  <td className="px-4 py-3 font-mono">{s.admissionNo}</td>
                  <td className="px-4 py-3 font-medium">{s.user.firstName} {s.user.lastName}</td>
                  <td className="px-4 py-3 text-school-muted">{s.user.email}</td>
                  <td className="px-4 py-3">{s.class?.name || 'Unassigned'}</td>
                  <td className="space-x-2 px-4 py-3">
                    <button type="button" onClick={() => router.push(`/admin/students/${s.id}`)} className="rounded bg-school-royal/10 px-3 py-1 text-school-royal">Edit</button>
                    <button type="button" onClick={() => startPromotion(s.id)} className="rounded bg-green-500/10 px-3 py-1 text-green-700 dark:text-green-300">Promote</button>
                    <button type="button" onClick={() => handleDeleteStudent(s.id)} className="rounded bg-red-500/10 px-3 py-1 text-red-700 dark:text-red-300">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex flex-col gap-3 border-t border-school-border bg-school-bg/50 px-4 py-3 md:flex-row md:items-center md:justify-between">
            <div className="text-sm text-school-muted">Page {page}</div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1} className="rounded border border-school-border px-3 py-1 text-sm disabled:opacity-50">Prev</button>
              <button type="button" onClick={() => setPage(page + 1)} disabled={total !== null && page * pageSize >= total} className="rounded border border-school-border px-3 py-1 text-sm disabled:opacity-50">Next</button>
            </div>
          </div>
        </div>
      )}

      {promotionStudentId && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
          <div className="content-card w-full max-w-lg p-5 shadow-xl">
            <p className="text-lg font-semibold">Promote student</p>
            <p className="mt-1 text-sm text-school-muted">
              Assign {selectedPromotionStudent ? `${selectedPromotionStudent.user.firstName} ${selectedPromotionStudent.user.lastName}` : 'this student'} to a new class.
            </p>
            <select value={promotionClassId} onChange={(e) => setPromotionClassId(e.target.value)} className={`${fieldClass} mt-4`}>
              <option value="">Choose destination class</option>
              {classOptions.map((cls) => (
                <option key={cls.id} value={cls.id}>{cls.name}</option>
              ))}
            </select>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setPromotionStudentId(null)} className="rounded border border-school-border px-4 py-2 text-sm">Cancel</button>
              <button type="button" onClick={confirmPromotion} className="btn-gold">Promote student</button>
            </div>
            {promotionError && <p className="mt-2 text-sm text-red-600">{promotionError}</p>}
          </div>
        </div>
      )}
    </AppLayout>
  )
}

export default withAuth(StudentsPage, { roles: ['SuperAdmin', 'SchoolAdmin'] })
