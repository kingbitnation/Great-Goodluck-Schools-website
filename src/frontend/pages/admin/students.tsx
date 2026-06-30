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

function StudentsPage({ user }: { user: AuthUser }) {
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<StudentFormErrors>({})
  const [query, setQuery] = useState('')
  const [classFilter, setClassFilter] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize] = useState(12)
  const [total, setTotal] = useState<number | null>(null)
  const [classOptions, setClassOptions] = useState<{ id: string; name: string }[]>([])
  const [selectedClassId, setSelectedClassId] = useState('')
  const [promotionStudentId, setPromotionStudentId] = useState<string | null>(null)
  const [promotionClassId, setPromotionClassId] = useState('')
  const [promotionError, setPromotionError] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    loadPage(page)
  }, [user.schoolId, query, classFilter, page])

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
  const [password, setPassword] = useState('password123')
  const [admissionNo, setAdmissionNo] = useState('')
  const [dob, setDob] = useState('')
  const [gender, setGender] = useState('')
  const [address, setAddress] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<string | null>(null)

  async function handleExportStudents() {
    const token = localStorage.getItem('sms_token')
    const base = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000'
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
    if (!/\S+@\S+\.\S+/.test(email)) {
      validationErrors.email = 'Please enter a valid email'
    }
    if (password.length < 6) {
      validationErrors.password = 'Password must be at least 6 characters'
    }
    if (!firstName.trim()) {
      validationErrors.firstName = 'First name is required'
    }
    if (!lastName.trim()) {
      validationErrors.lastName = 'Last name is required'
    }
    if (dob && Number.isNaN(Date.parse(dob))) {
      validationErrors.dob = 'Date of birth is invalid'
    }
    if (gender && !['Male', 'Female', 'Other'].includes(gender)) {
      validationErrors.gender = 'Please select a valid gender'
    }

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
      setPassword('password123')
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
      if (err?.fields) {
        setFieldErrors(err.fields)
      }
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
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  function fetchPage(p = 1) {
    setPage(p)
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
      fetchPage(page)
    } catch (e: any) {
      setPromotionError(e.message)
    }
  }

  const selectedPromotionStudent = students.find((s) => s.id === promotionStudentId)

  return (
    <AppLayout user={user} title="Students">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <button type="button" onClick={handleExportStudents} className="rounded-md border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50">
          Export CSV
        </button>
        <label className="cursor-pointer rounded-md border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50">
          {importing ? 'Importing…' : 'Import CSV'}
          <input type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => e.target.files?.[0] && handleImportCsv(e.target.files[0])} />
        </label>
        {importResult && <p className="text-sm text-green-700">{importResult}</p>}
      </div>
      <form onSubmit={handleAddStudent} className="mb-6 rounded-lg border border-gray-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">Register student</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <input
              required
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                if (fieldErrors.email) setFieldErrors((prev) => ({ ...prev, email: undefined }))
              }}
              placeholder="Email"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
            {fieldErrors.email && <p className="mt-1 text-xs text-red-600">{fieldErrors.email}</p>}
          </div>
          <div>
            <input
              required
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                if (fieldErrors.password) setFieldErrors((prev) => ({ ...prev, password: undefined }))
              }}
              placeholder="Password"
              type="password"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
            {fieldErrors.password && <p className="mt-1 text-xs text-red-600">{fieldErrors.password}</p>}
          </div>
          <div>
            <input
              required
              value={firstName}
              onChange={(e) => {
                setFirstName(e.target.value)
                if (fieldErrors.firstName) setFieldErrors((prev) => ({ ...prev, firstName: undefined }))
              }}
              placeholder="First name"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
            {fieldErrors.firstName && <p className="mt-1 text-xs text-red-600">{fieldErrors.firstName}</p>}
          </div>
          <div>
            <input
              required
              value={lastName}
              onChange={(e) => {
                setLastName(e.target.value)
                if (fieldErrors.lastName) setFieldErrors((prev) => ({ ...prev, lastName: undefined }))
              }}
              placeholder="Last name"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
            {fieldErrors.lastName && <p className="mt-1 text-xs text-red-600">{fieldErrors.lastName}</p>}
          </div>
          <div>
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
            >
              <option value="">Assign class (optional)</option>
              {classOptions.map((cls) => (
                <option key={cls.id} value={cls.id}>{cls.name}</option>
              ))}
            </select>
          </div>
          <div>
            <input
              value={dob}
              onChange={(e) => {
                setDob(e.target.value)
                if (fieldErrors.dob) setFieldErrors((prev) => ({ ...prev, dob: undefined }))
              }}
              placeholder="Date of birth"
              type="date"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
            {fieldErrors.dob && <p className="mt-1 text-xs text-red-600">{fieldErrors.dob}</p>}
          </div>
          <div>
            <select
              value={gender}
              onChange={(e) => {
                setGender(e.target.value)
                if (fieldErrors.gender) setFieldErrors((prev) => ({ ...prev, gender: undefined }))
              }}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
            >
              <option value="">Select gender</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </select>
            {fieldErrors.gender && <p className="mt-1 text-xs text-red-600">{fieldErrors.gender}</p>}
          </div>
          <div>
            <input
              value={admissionNo}
              onChange={(e) => {
                setAdmissionNo(e.target.value)
                if (fieldErrors.admissionNo) setFieldErrors((prev) => ({ ...prev, admissionNo: undefined }))
              }}
              placeholder="Admission no."
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
            {fieldErrors.admissionNo && <p className="mt-1 text-xs text-red-600">{fieldErrors.admissionNo}</p>}
          </div>
          <div>
            <input
              value={address}
              onChange={(e) => {
                setAddress(e.target.value)
                if (fieldErrors.address) setFieldErrors((prev) => ({ ...prev, address: undefined }))
              }}
              placeholder="Address"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
            {fieldErrors.address && <p className="mt-1 text-xs text-red-600">{fieldErrors.address}</p>}
          </div>
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="mt-4 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {submitting ? 'Registering...' : 'Register student'}
        </button>
      </form>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {loading ? (
        <p className="text-gray-500">Loading students...</p>
      ) : students.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center">
          <p className="text-gray-600">No students enrolled yet.</p>
          <p className="mt-1 text-sm text-gray-400">Student registration will be added in a future update.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <div className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-col gap-3 md:flex-row md:items-center">
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600">Search</label>
                <input
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value)
                    setPage(1)
                  }}
                  placeholder="Search by name, email, or admission no"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm md:w-96"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600">Class</label>
                <select
                  value={classFilter}
                  onChange={(e) => {
                    setClassFilter(e.target.value)
                    setPage(1)
                  }}
                  className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="">All classes</option>
                  {classOptions.map((cls) => (
                    <option key={cls.id} value={cls.id}>{cls.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="text-sm text-gray-500">
              Showing {students.length} of {total ?? 0}
            </div>
          </div>
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-500">
              <tr>
                <th className="px-4 py-3 font-medium">Admission No</th>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Class</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {students.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-gray-700">{s.admissionNo}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {s.user.firstName} {s.user.lastName}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{s.user.email}</td>
                  <td className="px-4 py-3">{s.class?.name || 'Unassigned'}</td>
                  <td className="px-4 py-3 space-x-2">
                    <button
                      type="button"
                      onClick={() => router.push(`/admin/students/${s.id}`)}
                      className="rounded bg-blue-50 px-3 py-1 text-blue-700 hover:bg-blue-100"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => startPromotion(s.id)}
                      className="rounded bg-green-50 px-3 py-1 text-green-700 hover:bg-green-100"
                    >
                      Promote
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteStudent(s.id)}
                      className="rounded bg-red-50 px-3 py-1 text-red-700 hover:bg-red-100"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex flex-col gap-3 border-t border-gray-200 bg-gray-50 px-4 py-3 md:flex-row md:items-center md:justify-between">
            <div className="text-sm text-gray-600">Page {page}</div>
            <div className="flex flex-col gap-2 md:flex-row md:items-center">
              <span className="text-sm text-gray-600">Page size: {pageSize}</span>
              <button
                type="button"
                onClick={() => fetchPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="rounded border border-gray-300 bg-white px-3 py-1 text-sm text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Prev
              </button>
              <button
                type="button"
                onClick={() => fetchPage(page + 1)}
                disabled={total !== null && page * pageSize >= total}
                className="rounded border border-gray-300 bg-white px-3 py-1 text-sm text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}
      {promotionStudentId && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-xl border border-yellow-200 bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-lg font-semibold text-yellow-900">Promote student</p>
                <p className="mt-1 text-sm text-yellow-700">
                  Assign {selectedPromotionStudent ? `${selectedPromotionStudent.user.firstName} ${selectedPromotionStudent.user.lastName}` : 'this student'} to a new class.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPromotionStudentId(null)}
                className="rounded border border-yellow-300 bg-white px-3 py-1 text-sm text-yellow-900 hover:bg-yellow-100"
              >
                Close
              </button>
            </div>
            <div className="mt-5 flex flex-col gap-4">
              <select
                value={promotionClassId}
                onChange={(e) => setPromotionClassId(e.target.value)}
                className="w-full rounded-md border border-yellow-300 bg-white px-3 py-2 text-sm"
              >
                <option value="">Choose destination class</option>
                {classOptions.map((cls) => (
                  <option key={cls.id} value={cls.id}>{cls.name}</option>
                ))}
              </select>
              <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setPromotionStudentId(null)}
                  className="rounded border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmPromotion}
                  className="rounded bg-yellow-600 px-4 py-2 text-sm font-medium text-white hover:bg-yellow-700"
                >
                  Promote student
                </button>
              </div>
              {promotionError && <p className="text-sm text-red-700">{promotionError}</p>}
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  )
}

export default withAuth(StudentsPage, { roles: ['SuperAdmin', 'SchoolAdmin'] })
