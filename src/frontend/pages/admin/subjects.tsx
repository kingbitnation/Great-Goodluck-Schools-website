import { useEffect, useState, type FormEvent } from 'react'
import AppLayout from '../../components/layout/AppLayout'
import { withAuth } from '../../components/withAuth'
import { apiDelete, apiGet, apiPost, apiPut } from '../../lib/api'
import type { AuthUser } from '../../lib/useAuth'

type Subject = {
  id: string
  code: string
  name: string
  description?: string
  class: { id: string; name: string }
  teacher?: { id: string; user: { firstName: string; lastName: string } } | null
}

type SubjectFormErrors = { code?: string; name?: string; classId?: string }

const fieldClass = 'portal-input w-full rounded-md border px-3 py-2 text-sm'

function SubjectsPage({ user }: { user: AuthUser }) {
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([])
  const [teachers, setTeachers] = useState<{ id: string; user: { firstName: string; lastName: string } }[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<SubjectFormErrors>({})
  const [query, setQuery] = useState('')
  const [classFilter, setClassFilter] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(12)
  const [total, setTotal] = useState(0)
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [classId, setClassId] = useState('')
  const [teacherId, setTeacherId] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const qs = user.schoolId ? `?schoolId=${user.schoolId}` : ''
    apiGet<{ id: string; name: string }[]>(`/api/classes${qs}`)
      .then(setClasses)
      .catch((e) => setError(e.message))
    apiGet<{ id: string; user: { firstName: string; lastName: string } }[]>(`/api/teachers${qs}`)
      .then(setTeachers)
      .catch(() => {})
  }, [user.schoolId])

  useEffect(() => {
    loadPage(page)
  }, [user.schoolId, query, classFilter, page, pageSize])

  async function loadPage(p = page) {
    setLoading(true)
    const qs = new URLSearchParams()
    if (user.schoolId) qs.set('schoolId', user.schoolId)
    if (query) qs.set('q', query)
    if (classFilter) qs.set('classId', classFilter)
    qs.set('page', String(p))
    qs.set('pageSize', String(pageSize))
    try {
      const res = await apiGet<{ data: Subject[]; total: number }>(`/api/subjects/search?${qs.toString()}`)
      setSubjects(res.data)
      setTotal(res.total)
      setError(null)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  function resetForm() {
    setCode(''); setName(''); setDescription(''); setClassId(''); setTeacherId('')
    setFieldErrors({}); setEditingId(null)
  }

  async function handleSaveSubject(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    setFieldErrors({})
    const validationErrors: SubjectFormErrors = {}
    if (!code.trim()) validationErrors.code = 'Subject code is required'
    if (!name.trim()) validationErrors.name = 'Subject name is required'
    if (!classId.trim()) validationErrors.classId = 'Class is required'
    if (Object.keys(validationErrors).length) {
      setFieldErrors(validationErrors)
      setSubmitting(false)
      return
    }
    try {
      const payload = { code, name, description, classId, teacherId: teacherId || undefined, schoolId: user.schoolId }
      if (editingId) await apiPut(`/api/subjects/${editingId}`, payload)
      else await apiPost('/api/subjects', payload)
      resetForm()
      setPage(1)
      await loadPage(1)
    } catch (err: any) {
      setError(err.message)
      if (err?.fields) setFieldErrors(err.fields)
    } finally {
      setSubmitting(false)
    }
  }

  function handleEditSubject(subject: Subject) {
    setEditingId(subject.id)
    setCode(subject.code)
    setName(subject.name)
    setDescription(subject.description ?? '')
    setClassId(subject.class.id)
    setTeacherId(subject.teacher?.id ?? '')
  }

  async function handleDeleteSubject(id: string) {
    if (!confirm('Delete this subject?')) return
    try {
      await apiDelete(`/api/subjects/${id}`)
      loadPage(page)
    } catch (err: any) {
      setError(err.message)
    }
  }

  return (
    <AppLayout user={user} title="Subjects">
      <form onSubmit={handleSaveSubject} className="content-card mb-6 p-5">
        <h2 className="mb-4 text-sm font-semibold text-school-text">Manage subjects</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs text-school-muted">Subject code</label>
            <input value={code} onChange={(e) => setCode(e.target.value)} className={fieldClass} />
            {fieldErrors.code && <p className="mt-1 text-xs text-red-600">{fieldErrors.code}</p>}
          </div>
          <div>
            <label className="mb-1 block text-xs text-school-muted">Subject name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className={fieldClass} />
            {fieldErrors.name && <p className="mt-1 text-xs text-red-600">{fieldErrors.name}</p>}
          </div>
          <div>
            <label className="mb-1 block text-xs text-school-muted">Class</label>
            <select value={classId} onChange={(e) => setClassId(e.target.value)} className={fieldClass}>
              <option value="">Select class</option>
              {classes.map((cls) => <option key={cls.id} value={cls.id}>{cls.name}</option>)}
            </select>
            {fieldErrors.classId && <p className="mt-1 text-xs text-red-600">{fieldErrors.classId}</p>}
          </div>
          <div>
            <label className="mb-1 block text-xs text-school-muted">Teacher (optional)</label>
            <select value={teacherId} onChange={(e) => setTeacherId(e.target.value)} className={fieldClass}>
              <option value="">Unassigned</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>{t.user.firstName} {t.user.lastName}</option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-xs text-school-muted">Description (optional)</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className={fieldClass} />
          </div>
        </div>
        <div className="mt-4 flex gap-3">
          <button type="submit" disabled={submitting} className="btn-gold">{editingId ? 'Update subject' : 'Create subject'}</button>
          {editingId && <button type="button" onClick={resetForm} className="rounded border border-school-border px-4 py-2 text-sm">Cancel</button>}
        </div>
      </form>

      {error && <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">{error}</div>}

      <div className="content-card overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-school-border p-4 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="flex items-center gap-2">
              <label className="text-sm text-school-muted">Search</label>
              <input
                value={query}
                onChange={(e) => { setQuery(e.target.value); setPage(1) }}
                placeholder="Code or name"
                className={`${fieldClass} md:w-64`}
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-school-muted">Class</label>
              <select value={classFilter} onChange={(e) => { setClassFilter(e.target.value); setPage(1) }} className={fieldClass}>
                <option value="">All classes</option>
                {classes.map((cls) => <option key={cls.id} value={cls.id}>{cls.name}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-school-muted">Per page</label>
              <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1) }} className={fieldClass}>
                {[12, 25, 50].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          </div>
          <p className="text-sm text-school-muted">Showing {subjects.length} of {total}</p>
        </div>

        {loading ? (
          <p className="p-8 text-school-muted">Loading subjects...</p>
        ) : subjects.length === 0 ? (
          <p className="p-8 text-center text-school-muted">No subjects found. Create one above.</p>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="bg-school-bg text-left text-school-muted">
              <tr>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Class</th>
                <th className="px-4 py-3">Teacher</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-school-border">
              {subjects.map((subject) => (
                <tr key={subject.id}>
                  <td className="px-4 py-3 font-mono">{subject.code}</td>
                  <td className="px-4 py-3 font-medium">{subject.name}</td>
                  <td className="px-4 py-3">{subject.class?.name || '—'}</td>
                  <td className="px-4 py-3">{subject.teacher ? `${subject.teacher.user.firstName} ${subject.teacher.user.lastName}` : 'Unassigned'}</td>
                  <td className="space-x-2 px-4 py-3">
                    <button type="button" onClick={() => handleEditSubject(subject)} className="rounded bg-school-royal/10 px-3 py-1 text-school-royal">Edit</button>
                    <button type="button" onClick={() => handleDeleteSubject(subject.id)} className="rounded bg-red-500/10 px-3 py-1 text-red-700 dark:text-red-300">Delete</button>
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
    </AppLayout>
  )
}

export default withAuth(SubjectsPage, { roles: ['SuperAdmin', 'SchoolAdmin'] })
