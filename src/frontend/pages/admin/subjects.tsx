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

type SubjectFormErrors = {
  code?: string
  name?: string
  classId?: string
}

function SubjectsPage({ user }: { user: AuthUser }) {
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([])
  const [teachers, setTeachers] = useState<{ id: string; user: { firstName: string; lastName: string } }[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<SubjectFormErrors>({})
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [classId, setClassId] = useState('')
  const [teacherId, setTeacherId] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    setLoading(true)
    const qs = user.schoolId ? `?schoolId=${user.schoolId}` : ''
    Promise.all([
      apiGet<Subject[]>(`/api/subjects${qs}`),
      apiGet<{ id: string; name: string }[]>(`/api/classes${qs}`),
      apiGet<{ id: string; user: { firstName: string; lastName: string } }[]>(`/api/teachers${qs}`),
    ])
      .then(([subjectsRes, classesRes, teachersRes]) => {
        setSubjects(subjectsRes)
        setClasses(classesRes)
        setTeachers(teachersRes)
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [user.schoolId])

  function resetForm() {
    setCode('')
    setName('')
    setDescription('')
    setClassId('')
    setTeacherId('')
    setFieldErrors({})
    setEditingId(null)
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
      const saved = editingId
        ? await apiPut<Subject>(`/api/subjects/${editingId}`, payload)
        : await apiPost<Subject>('/api/subjects', payload)

      const qs = user.schoolId ? `?schoolId=${user.schoolId}` : ''
      const subjectsRes = await apiGet<Subject[]>(`/api/subjects${qs}`)
      setSubjects(subjectsRes)
      resetForm()
    } catch (err: any) {
      setError(err.message)
      if (err?.fields) setFieldErrors(err.fields)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleEditSubject(subject: Subject) {
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
      setSubjects((prev) => prev.filter((subject) => subject.id !== id))
    } catch (err: any) {
      setError(err.message)
    }
  }

  return (
    <AppLayout user={user} title="Subjects">
      <form onSubmit={handleSaveSubject} className="mb-6 rounded-lg border border-gray-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">Manage subjects</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Subject code"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
            {fieldErrors.code && <p className="mt-1 text-xs text-red-600">{fieldErrors.code}</p>}
          </div>
          <div>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Subject name"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
            {fieldErrors.name && <p className="mt-1 text-xs text-red-600">{fieldErrors.name}</p>}
          </div>
          <div>
            <select
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
            >
              <option value="">Select class</option>
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id}>{cls.name}</option>
              ))}
            </select>
            {fieldErrors.classId && <p className="mt-1 text-xs text-red-600">{fieldErrors.classId}</p>}
          </div>
          <div>
            <select
              value={teacherId}
              onChange={(e) => setTeacherId(e.target.value)}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
            >
              <option value="">Assign teacher (optional)</option>
              {teachers.map((teacher) => (
                <option key={teacher.id} value={teacher.id}>
                  {teacher.user.firstName} {teacher.user.lastName}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description"
              rows={3}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={submitting}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {editingId ? 'Update subject' : 'Create subject'}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              Cancel edit
            </button>
          )}
        </div>
      </form>

      {error && <div className="mb-4 rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-500">
            <tr>
              <th className="px-4 py-3 font-medium">Code</th>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Class</th>
              <th className="px-4 py-3 font-medium">Teacher</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {subjects.map((subject) => (
              <tr key={subject.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-gray-700">{subject.code}</td>
                <td className="px-4 py-3 font-medium text-gray-900">{subject.name}</td>
                <td className="px-4 py-3 text-gray-600">{subject.class.name}</td>
                <td className="px-4 py-3 text-gray-600">{subject.teacher ? `${subject.teacher.user.firstName} ${subject.teacher.user.lastName}` : 'Unassigned'}</td>
                <td className="px-4 py-3 space-x-2">
                  <button
                    type="button"
                    onClick={() => handleEditSubject(subject)}
                    className="rounded bg-blue-50 px-3 py-1 text-blue-700 hover:bg-blue-100"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteSubject(subject.id)}
                    className="rounded bg-red-50 px-3 py-1 text-red-700 hover:bg-red-100"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {subjects.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-500">No subjects found</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </AppLayout>
  )
}

export default withAuth(SubjectsPage, { roles: ['SuperAdmin', 'SchoolAdmin'] })
