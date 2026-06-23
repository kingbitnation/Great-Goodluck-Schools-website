import { useEffect, useState, type FormEvent } from 'react'
import AppLayout from '../../components/layout/AppLayout'
import { withAuth } from '../../components/withAuth'
import { apiDelete, apiGet, apiPost, apiPut } from '../../lib/api'
import type { AuthUser } from '../../lib/useAuth'

type ClassRow = {
  id: string
  name: string
  level: string
  capacity: number
  _count?: { students: number; subjects: number }
}

type Student = {
  id: string
  admissionNo: string
  user: { firstName: string; lastName: string }
}

type Teacher = {
  id: string
  user: { firstName: string; lastName: string }
}

function ClassesPage({ user }: { user: AuthUser }) {
  const [classes, setClasses] = useState<ClassRow[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [name, setName] = useState('')
  const [level, setLevel] = useState('')
  const [capacity, setCapacity] = useState('50')
  const [editingClassId, setEditingClassId] = useState<string | null>(null)
  const [assignClassId, setAssignClassId] = useState<string | null>(null)
  const [assignMode, setAssignMode] = useState<'students' | 'teachers' | null>(null)
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([])
  const [selectedTeacherIds, setSelectedTeacherIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const qs = user.schoolId ? `?schoolId=${user.schoolId}` : ''
    setLoading(true)
    Promise.all([
      apiGet<ClassRow[]>(`/api/classes${qs}`),
      apiGet<Student[]>(`/api/students${qs}`),
      apiGet<Teacher[]>(`/api/teachers${qs}`),
    ])
      .then(([classesRes, studentsRes, teachersRes]) => {
        setClasses(classesRes)
        setStudents(studentsRes)
        setTeachers(teachersRes)
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [user.schoolId])

  async function handleSaveClass(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    if (!name.trim()) {
      setError('Class name is required')
      return
    }

    if (!level.trim()) {
      setError('Class level is required')
      return
    }

    try {
      const payload = { name, level, capacity: Number(capacity), schoolId: user.schoolId }
      if (editingClassId) {
        await apiPut(`/api/classes/${editingClassId}`, payload)
      } else {
        await apiPost('/api/classes', payload)
      }
      const qs = user.schoolId ? `?schoolId=${user.schoolId}` : ''
      const classesRes = await apiGet<ClassRow[]>(`/api/classes${qs}`)
      setClasses(classesRes)
      setName('')
      setLevel('')
      setCapacity('50')
      setEditingClassId(null)
      setError(null)
    } catch (err: any) {
      setError(err.message)
    }
  }

  function handleEditClass(cls: ClassRow) {
    setEditingClassId(cls.id)
    setName(cls.name)
    setLevel(cls.level)
    setCapacity(String(cls.capacity))
  }

  async function handleDeleteClass(id: string) {
    if (!confirm('Delete this class?')) return
    try {
      await apiDelete(`/api/classes/${id}`)
      setClasses((prev) => prev.filter((cls) => cls.id !== id))
    } catch (err: any) {
      setError(err.message)
    }
  }

  function openAssign(clsId: string, mode: 'students' | 'teachers') {
    setAssignClassId(clsId)
    setAssignMode(mode)
    setSelectedStudentIds([])
    setSelectedTeacherIds([])
  }

  async function handleAssignStudents() {
    if (!assignClassId) return
    try {
      await apiPost(`/api/classes/${assignClassId}/assign-students`, { studentIds: selectedStudentIds })
      setAssignClassId(null)
      setAssignMode(null)
      setSelectedStudentIds([])
      setError(null)
    } catch (err: any) {
      setError(err.message)
    }
  }

  async function handleAssignTeachers() {
    if (!assignClassId) return
    try {
      await apiPost(`/api/classes/${assignClassId}/assign-teachers`, { teacherIds: selectedTeacherIds })
      setAssignClassId(null)
      setAssignMode(null)
      setSelectedTeacherIds([])
      setError(null)
    } catch (err: any) {
      setError(err.message)
    }
  }

  return (
    <AppLayout user={user} title="Classes">
      <form onSubmit={handleSaveClass} className="mb-6 rounded-lg border border-gray-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">Manage classes</h2>
        {error && <div className="mb-4 rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}
        <div className="grid gap-3 md:grid-cols-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Class name"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <input
            value={level}
            onChange={(e) => setLevel(e.target.value)}
            placeholder="Level"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <input
            type="number"
            value={capacity}
            onChange={(e) => setCapacity(e.target.value)}
            placeholder="Capacity"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div className="mt-4 flex gap-3">
          <button className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700" type="submit">
            {editingClassId ? 'Save class' : 'Create class'}
          </button>
          {editingClassId && (
            <button
              type="button"
              onClick={() => {
                setEditingClassId(null)
                setName('')
                setLevel('')
                setCapacity('50')
                setError(null)
              }}
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              Cancel edit
            </button>
          )}
        </div>
      </form>

      {loading ? (
        <p className="text-gray-500">Loading classes...</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-500">
              <tr>
                <th className="px-4 py-3 font-medium">Class</th>
                <th className="px-4 py-3 font-medium">Level</th>
                <th className="px-4 py-3 font-medium">Capacity</th>
                <th className="px-4 py-3 font-medium">Students</th>
                <th className="px-4 py-3 font-medium">Subjects</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {classes.map((cls) => (
                <tr key={cls.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{cls.name}</td>
                  <td className="px-4 py-3 text-gray-600">{cls.level}</td>
                  <td className="px-4 py-3">{cls.capacity}</td>
                  <td className="px-4 py-3">{cls._count?.students ?? 0}</td>
                  <td className="px-4 py-3">{cls._count?.subjects ?? 0}</td>
                  <td className="px-4 py-3 space-x-2">
                    <button
                      type="button"
                      onClick={() => handleEditClass(cls)}
                      className="rounded bg-blue-50 px-3 py-1 text-blue-700 hover:bg-blue-100"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteClass(cls.id)}
                      className="rounded bg-red-50 px-3 py-1 text-red-700 hover:bg-red-100"
                    >
                      Delete
                    </button>
                    <button
                      type="button"
                      onClick={() => openAssign(cls.id, 'students')}
                      className="rounded bg-green-50 px-3 py-1 text-green-700 hover:bg-green-100"
                    >
                      Assign students
                    </button>
                    <button
                      type="button"
                      onClick={() => openAssign(cls.id, 'teachers')}
                      className="rounded bg-indigo-50 px-3 py-1 text-indigo-700 hover:bg-indigo-100"
                    >
                      Assign teachers
                    </button>
                  </td>
                </tr>
              ))}
              {classes.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">No classes configured</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {assignClassId && assignMode && (
        <div className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-slate-900">Assign {assignMode}</p>
              <p className="mt-1 text-sm text-slate-500">
                Select {assignMode === 'students' ? 'students' : 'teachers'} to assign to the class.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setAssignClassId(null)
                setAssignMode(null)
                setSelectedStudentIds([])
                setSelectedTeacherIds([])
              }}
              className="rounded border border-slate-300 bg-white px-3 py-1 text-sm text-slate-700 hover:bg-slate-50"
            >
              Close
            </button>
          </div>
          <div className="mt-4">
            {assignMode === 'students' ? (
              <select
                multiple
                value={selectedStudentIds}
                onChange={(e) => setSelectedStudentIds(Array.from(e.target.selectedOptions, (o) => o.value))}
                className="h-52 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                {students.map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.user.firstName} {student.user.lastName} — {student.admissionNo}
                  </option>
                ))}
              </select>
            ) : (
              <select
                multiple
                value={selectedTeacherIds}
                onChange={(e) => setSelectedTeacherIds(Array.from(e.target.selectedOptions, (o) => o.value))}
                className="h-52 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                {teachers.map((teacher) => (
                  <option key={teacher.id} value={teacher.id}>
                    {teacher.user.firstName} {teacher.user.lastName}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div className="mt-4 flex gap-3">
            <button
              type="button"
              onClick={assignMode === 'students' ? handleAssignStudents : handleAssignTeachers}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Save assignment
            </button>
            <button
              type="button"
              onClick={() => {
                setAssignClassId(null)
                setAssignMode(null)
                setSelectedStudentIds([])
                setSelectedTeacherIds([])
              }}
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </AppLayout>
  )
}

export default withAuth(ClassesPage, { roles: ['SuperAdmin', 'SchoolAdmin'] })
