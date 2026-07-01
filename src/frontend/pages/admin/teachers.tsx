import { useEffect, useState, type FormEvent } from 'react'
import AppLayout from '../../components/layout/AppLayout'
import { withAuth } from '../../components/withAuth'
import { apiDelete, apiGet, apiPost, apiPut } from '../../lib/api'
import type { AuthUser } from '../../lib/useAuth'

type Teacher = {
  id: string
  staffNo: string
  department?: string
  qualification?: string
  specialization?: string
  hireDate?: string
  user: { firstName: string; lastName: string; email: string }
  _count?: { subjects: number }
}

type TeacherFormErrors = {
  email?: string
  password?: string
  firstName?: string
  lastName?: string
  hireDate?: string
}

const fieldClass = 'portal-input w-full rounded-md border px-3 py-2 text-sm'

function TeachersPage({ user }: { user: AuthUser }) {
  const [fieldErrors, setFieldErrors] = useState<TeacherFormErrors>({})
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(12)
  const [total, setTotal] = useState(0)
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([])
  const [subjects, setSubjects] = useState<{ id: string; name: string }[]>([])
  const [editingTeacherId, setEditingTeacherId] = useState<string | null>(null)
  const [assignTeacherId, setAssignTeacherId] = useState<string | null>(null)
  const [assignMode, setAssignMode] = useState<'subjects' | 'classes' | null>(null)
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<string[]>([])
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([])

  useEffect(() => {
    const qs = user.schoolId ? `?schoolId=${user.schoolId}` : ''
    apiGet<{ id: string; name: string }[]>(`/api/classes${qs}`).then(setClasses).catch(() => {})
    apiGet<{ id: string; name: string }[]>(`/api/subjects${qs}`).then(setSubjects).catch(() => {})
  }, [user.schoolId])

  useEffect(() => {
    loadPage(page)
  }, [user.schoolId, query, page, pageSize])

  async function loadPage(p = page) {
    setLoading(true)
    const qs = new URLSearchParams()
    if (user.schoolId) qs.set('schoolId', user.schoolId)
    if (query) qs.set('q', query)
    qs.set('page', String(p))
    qs.set('pageSize', String(pageSize))
    try {
      const res = await apiGet<{ data: Teacher[]; total: number }>(`/api/teachers/search?${qs.toString()}`)
      setTeachers(res.data)
      setTotal(res.total)
      setError(null)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const [email, setEmail] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [password, setPassword] = useState('')
  const [department, setDepartment] = useState('')
  const [qualification, setQualification] = useState('')
  const [specialization, setSpecialization] = useState('')
  const [hireDate, setHireDate] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSaveTeacher(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    setFieldErrors({})
    const validationErrors: TeacherFormErrors = {}
    if (!/\S+@\S+\.\S+/.test(email)) validationErrors.email = 'Please enter a valid email'
    if (!editingTeacherId && password.length < 6) validationErrors.password = 'Password must be at least 6 characters'
    if (!firstName.trim()) validationErrors.firstName = 'First name is required'
    if (!lastName.trim()) validationErrors.lastName = 'Last name is required'
    if (hireDate && Number.isNaN(Date.parse(hireDate))) validationErrors.hireDate = 'Hire date is invalid'
    if (Object.keys(validationErrors).length) {
      setFieldErrors(validationErrors)
      setSubmitting(false)
      return
    }
    try {
      const payload = { email, firstName, lastName, department, qualification, specialization, hireDate, ...(editingTeacherId ? {} : { password }) }
      if (editingTeacherId) await apiPut(`/api/teachers/${editingTeacherId}`, payload)
      else await apiPost('/api/teachers', payload)
      setEmail(''); setFirstName(''); setLastName(''); setPassword('')
      setDepartment(''); setQualification(''); setSpecialization(''); setHireDate('')
      setEditingTeacherId(null)
      setPage(1)
      await loadPage(1)
    } catch (err: any) {
      setError(err.message)
      if (err?.fields) setFieldErrors(err.fields)
    } finally {
      setSubmitting(false)
    }
  }

  function handleEditTeacher(teacher: Teacher) {
    setEditingTeacherId(teacher.id)
    setEmail(teacher.user.email)
    setFirstName(teacher.user.firstName)
    setLastName(teacher.user.lastName)
    setPassword('')
    setDepartment(teacher.department || '')
    setQualification(teacher.qualification || '')
    setSpecialization(teacher.specialization || '')
    setHireDate('')
  }

  async function handleDeleteTeacher(id: string) {
    if (!confirm('Delete this teacher?')) return
    try {
      await apiDelete(`/api/teachers/${id}`)
      loadPage(page)
    } catch (err: any) {
      setError(err.message)
    }
  }

  function openAssign(teacherId: string, mode: 'subjects' | 'classes') {
    setAssignTeacherId(teacherId)
    setAssignMode(mode)
    setSelectedSubjectIds([])
    setSelectedClassIds([])
  }

  async function handleAssign() {
    if (!assignTeacherId || !assignMode) return
    try {
      if (assignMode === 'subjects') {
        await apiPost(`/api/teachers/${assignTeacherId}/assign-subjects`, { subjectIds: selectedSubjectIds })
      } else {
        await apiPost(`/api/teachers/${assignTeacherId}/assign-classes`, { classIds: selectedClassIds })
      }
      setAssignTeacherId(null)
      setAssignMode(null)
    } catch (err: any) {
      setError(err.message)
    }
  }

  return (
    <AppLayout user={user} title="Teachers">
      <form onSubmit={handleSaveTeacher} className="content-card mb-6 p-5">
        <h2 className="mb-4 text-sm font-semibold text-school-text">{editingTeacherId ? 'Edit teacher' : 'Onboard teacher'}</h2>
        <p className="mb-4 text-xs text-school-muted">The field beside email is the teacher&apos;s login password.</p>
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs text-school-muted">Email</label>
            <input required value={email} onChange={(e) => setEmail(e.target.value)} className={fieldClass} type="email" />
            {fieldErrors.email && <p className="mt-1 text-xs text-red-600">{fieldErrors.email}</p>}
          </div>
          <div>
            <label className="mb-1 block text-xs text-school-muted">Login password</label>
            <input required={!editingTeacherId} value={password} onChange={(e) => setPassword(e.target.value)} className={fieldClass} type="password" placeholder={editingTeacherId ? 'Leave blank to keep current' : ''} />
            {fieldErrors.password && <p className="mt-1 text-xs text-red-600">{fieldErrors.password}</p>}
          </div>
          <div>
            <label className="mb-1 block text-xs text-school-muted">First name</label>
            <input required value={firstName} onChange={(e) => setFirstName(e.target.value)} className={fieldClass} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-school-muted">Last name</label>
            <input required value={lastName} onChange={(e) => setLastName(e.target.value)} className={fieldClass} />
          </div>
          <input value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="Department" className={fieldClass} />
          <input value={qualification} onChange={(e) => setQualification(e.target.value)} placeholder="Qualification" className={fieldClass} />
          <input value={specialization} onChange={(e) => setSpecialization(e.target.value)} placeholder="Specialization" className={fieldClass} />
          <input value={hireDate} onChange={(e) => setHireDate(e.target.value)} type="date" className={fieldClass} />
        </div>
        <button type="submit" disabled={submitting} className="btn-gold mt-4">{submitting ? 'Saving...' : editingTeacherId ? 'Update teacher' : 'Add teacher'}</button>
      </form>

      {error && <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">{error}</div>}

      <div className="content-card overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-school-border p-4 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <input value={query} onChange={(e) => { setQuery(e.target.value); setPage(1) }} placeholder="Search name, email, staff no." className={`${fieldClass} md:w-72`} />
            <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1) }} className={fieldClass}>
              {[12, 25, 50].map((n) => <option key={n} value={n}>{n} per page</option>)}
            </select>
          </div>
          <p className="text-sm text-school-muted">Showing {teachers.length} of {total}</p>
        </div>

        {loading ? (
          <p className="p-8 text-school-muted">Loading teachers...</p>
        ) : teachers.length === 0 ? (
          <p className="p-8 text-center text-school-muted">No teachers found. Add one above.</p>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="bg-school-bg text-left text-school-muted">
              <tr>
                <th className="px-4 py-3">Staff No</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Department</th>
                <th className="px-4 py-3">Subjects</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-school-border">
              {teachers.map((t) => (
                <tr key={t.id}>
                  <td className="px-4 py-3 font-mono">{t.staffNo}</td>
                  <td className="px-4 py-3 font-medium">{t.user.firstName} {t.user.lastName}</td>
                  <td className="px-4 py-3 text-school-muted">{t.user.email}</td>
                  <td className="px-4 py-3">{t.department || '—'}</td>
                  <td className="px-4 py-3">{t._count?.subjects ?? 0}</td>
                  <td className="space-x-1 px-4 py-3">
                    <button type="button" onClick={() => handleEditTeacher(t)} className="rounded bg-school-royal/10 px-2 py-1 text-school-royal">Edit</button>
                    <button type="button" onClick={() => openAssign(t.id, 'subjects')} className="rounded bg-green-500/10 px-2 py-1 text-green-700 dark:text-green-300">Subjects</button>
                    <button type="button" onClick={() => handleDeleteTeacher(t.id)} className="rounded bg-red-500/10 px-2 py-1 text-red-700 dark:text-red-300">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="flex justify-between border-t border-school-border px-4 py-3">
          <span className="text-sm text-school-muted">Page {page}</span>
          <div className="flex gap-2">
            <button type="button" onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1} className="rounded border border-school-border px-3 py-1 text-sm disabled:opacity-50">Prev</button>
            <button type="button" onClick={() => setPage(page + 1)} disabled={page * pageSize >= total} className="rounded border border-school-border px-3 py-1 text-sm disabled:opacity-50">Next</button>
          </div>
        </div>
      </div>

      {assignTeacherId && assignMode && (
        <div className="content-card mt-6 p-5">
          <p className="font-semibold">Assign {assignMode}</p>
          <select
            multiple
            value={assignMode === 'subjects' ? selectedSubjectIds : selectedClassIds}
            onChange={(e) => {
              const vals = Array.from(e.target.selectedOptions, (o) => o.value)
              if (assignMode === 'subjects') setSelectedSubjectIds(vals)
              else setSelectedClassIds(vals)
            }}
            className={`${fieldClass} mt-3 h-40`}
          >
            {(assignMode === 'subjects' ? subjects : classes).map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </select>
          <div className="mt-4 flex gap-2">
            <button type="button" onClick={handleAssign} className="btn-gold">Save</button>
            <button type="button" onClick={() => setAssignTeacherId(null)} className="rounded border border-school-border px-4 py-2 text-sm">Cancel</button>
          </div>
        </div>
      )}
    </AppLayout>
  )
}

export default withAuth(TeachersPage, { roles: ['SuperAdmin', 'SchoolAdmin'] })
