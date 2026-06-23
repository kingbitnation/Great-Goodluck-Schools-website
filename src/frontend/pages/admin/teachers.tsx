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
  department?: string
  qualification?: string
  specialization?: string
  hireDate?: string
}

function TeachersPage({ user }: { user: AuthUser }) {
  const [fieldErrors, setFieldErrors] = useState<TeacherFormErrors>({})
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([])
  const [subjects, setSubjects] = useState<{ id: string; name: string }[]>([])
  const [editingTeacherId, setEditingTeacherId] = useState<string | null>(null)
  const [assignTeacherId, setAssignTeacherId] = useState<string | null>(null)
  const [assignMode, setAssignMode] = useState<'subjects' | 'classes' | null>(null)
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<string[]>([])
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([])

  useEffect(() => {
    const qs = user.schoolId ? `?schoolId=${user.schoolId}` : ''
    setLoading(true)
    Promise.all([
      apiGet<Teacher[]>(`/api/teachers${qs}`),
      apiGet<{ id: string; name: string }[]>(`/api/classes${qs}`),
      apiGet<{ id: string; name: string }[]>(`/api/subjects${qs}`),
    ])
      .then(([teachersRes, classesRes, subjectsRes]) => {
        setTeachers(teachersRes)
        setClasses(classesRes)
        setSubjects(subjectsRes)
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [user.schoolId])

  const [email, setEmail] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [password, setPassword] = useState('password123')
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
    if (!/\S+@\S+\.\S+/.test(email)) {
      validationErrors.email = 'Please enter a valid email'
    }
    if (!editingTeacherId && password.length < 6) {
      validationErrors.password = 'Password must be at least 6 characters'
    }
    if (!firstName.trim()) {
      validationErrors.firstName = 'First name is required'
    }
    if (!lastName.trim()) {
      validationErrors.lastName = 'Last name is required'
    }
    if (hireDate && Number.isNaN(Date.parse(hireDate))) {
      validationErrors.hireDate = 'Hire date is invalid'
    }

    if (Object.keys(validationErrors).length) {
      setFieldErrors(validationErrors)
      setSubmitting(false)
      return
    }

    try {
      const payload = {
        email,
        firstName,
        lastName,
        department,
        qualification,
        specialization,
        hireDate,
        ...(editingTeacherId ? {} : { password }),
      }

      if (editingTeacherId) {
        await apiPut(`/api/teachers/${editingTeacherId}`, payload)
      } else {
        await apiPost('/api/teachers', payload)
      }

      setEmail('')
      setFirstName('')
      setLastName('')
      setPassword('password123')
      setDepartment('')
      setQualification('')
      setSpecialization('')
      setHireDate('')
      setFieldErrors({})
      setEditingTeacherId(null)
      const qs = user.schoolId ? `?schoolId=${user.schoolId}` : ''
      const teachersRes = await apiGet<Teacher[]>(`/api/teachers${qs}`)
      setTeachers(teachersRes)
    } catch (err: any) {
      setError(err.message)
      if (err?.fields) {
        setFieldErrors(err.fields)
      }
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
      setTeachers((prev) => prev.filter((teacher) => teacher.id !== id))
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

  async function handleAssignSubjects() {
    if (!assignTeacherId) return
    try {
      await apiPost(`/api/teachers/${assignTeacherId}/assign-subjects`, { subjectIds: selectedSubjectIds })
      setAssignTeacherId(null)
      setAssignMode(null)
      setSelectedSubjectIds([])
      setError(null)
    } catch (err: any) {
      setError(err.message)
    }
  }

  async function handleAssignClasses() {
    if (!assignTeacherId) return
    try {
      await apiPost(`/api/teachers/${assignTeacherId}/assign-classes`, { classIds: selectedClassIds })
      setAssignTeacherId(null)
      setAssignMode(null)
      setSelectedClassIds([])
      setError(null)
    } catch (err: any) {
      setError(err.message)
    }
  }

  return (
    <AppLayout user={user} title="Teachers">
      <form onSubmit={handleSaveTeacher} className="mb-6 rounded-lg border border-gray-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">Onboard teacher</h2>
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
              required={!editingTeacherId}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                if (fieldErrors.password) setFieldErrors((prev) => ({ ...prev, password: undefined }))
              }}
              placeholder={editingTeacherId ? 'Password (leave blank to keep current)' : 'Password'}
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
          <input
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            placeholder="Department"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <div>
            <input
              value={qualification}
              onChange={(e) => {
                setQualification(e.target.value)
                if (fieldErrors.qualification) setFieldErrors((prev) => ({ ...prev, qualification: undefined }))
              }}
              placeholder="Qualification"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
            {fieldErrors.qualification && <p className="mt-1 text-xs text-red-600">{fieldErrors.qualification}</p>}
          </div>
          <div>
            <input
              value={specialization}
              onChange={(e) => {
                setSpecialization(e.target.value)
                if (fieldErrors.specialization) setFieldErrors((prev) => ({ ...prev, specialization: undefined }))
              }}
              placeholder="Specialization"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
            {fieldErrors.specialization && <p className="mt-1 text-xs text-red-600">{fieldErrors.specialization}</p>}
          </div>
          <div>
            <input
              value={hireDate}
              onChange={(e) => {
                setHireDate(e.target.value)
                if (fieldErrors.hireDate) setFieldErrors((prev) => ({ ...prev, hireDate: undefined }))
              }}
              placeholder="Hire date"
              type="date"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
            {fieldErrors.hireDate && <p className="mt-1 text-xs text-red-600">{fieldErrors.hireDate}</p>}
          </div>
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="mt-4 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {submitting ? 'Saving...' : editingTeacherId ? 'Update teacher' : 'Add teacher'}
        </button>
        {editingTeacherId && (
          <button
            type="button"
            onClick={() => {
              setEditingTeacherId(null)
              setEmail('')
              setFirstName('')
              setLastName('')
              setPassword('password123')
              setDepartment('')
              setQualification('')
              setSpecialization('')
              setHireDate('')
              setFieldErrors({})
            }}
            className="mt-4 ml-3 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel edit
          </button>
        )}
      </form>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {loading ? (
        <p className="text-gray-500">Loading teachers...</p>
      ) : teachers.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center">
          <p className="text-gray-600">No teachers on staff yet.</p>
          <p className="mt-1 text-sm text-gray-400">Teacher onboarding will be added in a future update.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-500">
              <tr>
                <th className="px-4 py-3 font-medium">Staff No</th>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Department</th>
                <th className="px-4 py-3 font-medium">Subjects</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {teachers.map((t) => (
                <tr key={t.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-gray-700">{t.staffNo}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {t.user.firstName} {t.user.lastName}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{t.user.email}</td>
                  <td className="px-4 py-3">{t.department || '—'}</td>
                  <td className="px-4 py-3">{t._count?.subjects ?? 0}</td>
                  <td className="px-4 py-3 space-x-2">
                    <button
                      type="button"
                      onClick={() => handleEditTeacher(t)}
                      className="rounded bg-blue-50 px-3 py-1 text-blue-700 hover:bg-blue-100"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteTeacher(t.id)}
                      className="rounded bg-red-50 px-3 py-1 text-red-700 hover:bg-red-100"
                    >
                      Delete
                    </button>
                    <button
                      type="button"
                      onClick={() => openAssign(t.id, 'subjects')}
                      className="rounded bg-green-50 px-3 py-1 text-green-700 hover:bg-green-100"
                    >
                      Assign subjects
                    </button>
                    <button
                      type="button"
                      onClick={() => openAssign(t.id, 'classes')}
                      className="rounded bg-indigo-50 px-3 py-1 text-indigo-700 hover:bg-indigo-100"
                    >
                      Assign classes
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {assignTeacherId && assignMode && (
        <div className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-slate-900">Assign {assignMode}</p>
              <p className="mt-1 text-sm text-slate-500">Select {assignMode === 'subjects' ? 'subjects' : 'classes'} to assign to the teacher.</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setAssignTeacherId(null)
                setAssignMode(null)
              }}
              className="rounded border border-slate-300 bg-white px-3 py-1 text-sm text-slate-700 hover:bg-slate-50"
            >
              Close
            </button>
          </div>
          <div className="mt-4 space-y-4">
            {assignMode === 'subjects' ? (
              <div>
                <label className="block text-sm font-medium text-slate-700">Subjects</label>
                <select
                  multiple
                  value={selectedSubjectIds}
                  onChange={(e) => setSelectedSubjectIds(Array.from(e.target.selectedOptions, (o) => o.value))}
                  className="mt-2 h-40 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                >
                  {subjects.map((subject) => (
                    <option key={subject.id} value={subject.id}>{subject.name}</option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-slate-700">Classes</label>
                <select
                  multiple
                  value={selectedClassIds}
                  onChange={(e) => setSelectedClassIds(Array.from(e.target.selectedOptions, (o) => o.value))}
                  className="mt-2 h-40 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                >
                  {classes.map((cls) => (
                    <option key={cls.id} value={cls.id}>{cls.name}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={assignMode === 'subjects' ? handleAssignSubjects : handleAssignClasses}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Save assignment
              </button>
              <button
                type="button"
                onClick={() => {
                  setAssignTeacherId(null)
                  setAssignMode(null)
                  setSelectedSubjectIds([])
                  setSelectedClassIds([])
                }}
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  )
}

export default withAuth(TeachersPage, { roles: ['SuperAdmin', 'SchoolAdmin'] })
