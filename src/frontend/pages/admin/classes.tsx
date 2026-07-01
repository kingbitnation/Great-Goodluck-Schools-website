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

type Student = { id: string; admissionNo: string; user: { firstName: string; lastName: string } }
type Teacher = { id: string; user: { firstName: string; lastName: string } }
type Subject = { id: string; name: string; code: string; classId?: string | null }

const fieldClass = 'portal-input w-full rounded-md border px-3 py-2 text-sm'

function ClassesPage({ user }: { user: AuthUser }) {
  const [classes, setClasses] = useState<ClassRow[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [name, setName] = useState('')
  const [level, setLevel] = useState('')
  const [capacity, setCapacity] = useState('50')
  const [editingClassId, setEditingClassId] = useState<string | null>(null)
  const [assignClassId, setAssignClassId] = useState<string | null>(null)
  const [assignMode, setAssignMode] = useState<'students' | 'teachers' | 'subjects' | null>(null)
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([])
  const [selectedTeacherIds, setSelectedTeacherIds] = useState<string[]>([])
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function reload() {
    const qs = user.schoolId ? `?schoolId=${user.schoolId}` : ''
    const [classesRes, studentsRes, teachersRes, subjectsRes] = await Promise.all([
      apiGet<ClassRow[]>(`/api/classes${qs}`),
      apiGet<Student[]>(`/api/students${qs}`),
      apiGet<Teacher[]>(`/api/teachers${qs}`),
      apiGet<Subject[]>(`/api/subjects${qs}`),
    ])
    setClasses(classesRes)
    setStudents(studentsRes)
    setTeachers(teachersRes)
    setSubjects(subjectsRes)
  }

  useEffect(() => {
    setLoading(true)
    reload().catch((e) => setError(e.message)).finally(() => setLoading(false))
  }, [user.schoolId])

  async function handleSaveClass(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    if (!name.trim() || !level.trim()) {
      setError('Class name and level are required')
      return
    }
    try {
      const payload = { name, level, capacity: Number(capacity), schoolId: user.schoolId }
      if (editingClassId) await apiPut(`/api/classes/${editingClassId}`, payload)
      else await apiPost('/api/classes', payload)
      await reload()
      setName(''); setLevel(''); setCapacity('50'); setEditingClassId(null)
    } catch (err: any) {
      setError(err.message)
    }
  }

  function openAssign(clsId: string, mode: 'students' | 'teachers' | 'subjects') {
    setAssignClassId(clsId)
    setAssignMode(mode)
    setSelectedStudentIds([])
    setSelectedTeacherIds([])
    setSelectedSubjectIds([])
  }

  async function handleAssign() {
    if (!assignClassId || !assignMode) return
    try {
      if (assignMode === 'students') {
        await apiPost(`/api/classes/${assignClassId}/assign-students`, { studentIds: selectedStudentIds })
      } else if (assignMode === 'teachers') {
        await apiPost(`/api/classes/${assignClassId}/assign-teachers`, { teacherIds: selectedTeacherIds })
      } else {
        await apiPost(`/api/classes/${assignClassId}/assign-subjects`, { subjectIds: selectedSubjectIds })
      }
      await reload()
      setAssignClassId(null); setAssignMode(null)
    } catch (err: any) {
      setError(err.message)
    }
  }

  return (
    <AppLayout user={user} title="Classes">
      <form onSubmit={handleSaveClass} className="content-card mb-6 p-5">
        <h2 className="mb-4 text-sm font-semibold text-school-text">Manage classes</h2>
        {error && <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">{error}</div>}
        <div className="grid gap-3 md:grid-cols-3">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Class name" className={fieldClass} />
          <input value={level} onChange={(e) => setLevel(e.target.value)} placeholder="Level" className={fieldClass} />
          <input type="number" value={capacity} onChange={(e) => setCapacity(e.target.value)} placeholder="Capacity" className={fieldClass} />
        </div>
        <button className="btn-gold mt-4" type="submit">{editingClassId ? 'Save class' : 'Create class'}</button>
      </form>

      {loading ? (
        <p className="text-school-muted">Loading classes...</p>
      ) : (
        <div className="content-card overflow-hidden">
          <table className="min-w-full text-sm">
            <thead className="bg-school-bg text-left text-school-muted">
              <tr>
                <th className="px-4 py-3">Class</th>
                <th className="px-4 py-3">Level</th>
                <th className="px-4 py-3">Capacity</th>
                <th className="px-4 py-3">Students</th>
                <th className="px-4 py-3">Subjects</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-school-border">
              {classes.map((cls) => (
                <tr key={cls.id}>
                  <td className="px-4 py-3 font-medium">{cls.name}</td>
                  <td className="px-4 py-3">{cls.level}</td>
                  <td className="px-4 py-3">{cls.capacity}</td>
                  <td className="px-4 py-3">{cls._count?.students ?? 0}</td>
                  <td className="px-4 py-3">{cls._count?.subjects ?? 0}</td>
                  <td className="space-x-1 px-4 py-3">
                    <button type="button" onClick={() => openAssign(cls.id, 'subjects')} className="rounded bg-purple-500/10 px-2 py-1 text-purple-700 dark:text-purple-300">Subjects</button>
                    <button type="button" onClick={() => openAssign(cls.id, 'students')} className="rounded bg-green-500/10 px-2 py-1 text-green-700 dark:text-green-300">Students</button>
                    <button type="button" onClick={() => openAssign(cls.id, 'teachers')} className="rounded bg-indigo-500/10 px-2 py-1 text-indigo-700 dark:text-indigo-300">Teachers</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {assignClassId && assignMode && (
        <div className="content-card mt-6 p-5">
          <p className="font-semibold text-school-text">Assign {assignMode} to class</p>
          <select
            multiple
            value={assignMode === 'students' ? selectedStudentIds : assignMode === 'teachers' ? selectedTeacherIds : selectedSubjectIds}
            onChange={(e) => {
              const vals = Array.from(e.target.selectedOptions, (o) => o.value)
              if (assignMode === 'students') setSelectedStudentIds(vals)
              else if (assignMode === 'teachers') setSelectedTeacherIds(vals)
              else setSelectedSubjectIds(vals)
            }}
            className={`${fieldClass} mt-3 h-52`}
          >
            {assignMode === 'students' && students.map((s) => (
              <option key={s.id} value={s.id}>{s.user.firstName} {s.user.lastName} — {s.admissionNo}</option>
            ))}
            {assignMode === 'teachers' && teachers.map((t) => (
              <option key={t.id} value={t.id}>{t.user.firstName} {t.user.lastName}</option>
            ))}
            {assignMode === 'subjects' && subjects.map((sub) => (
              <option key={sub.id} value={sub.id}>{sub.name} ({sub.code}){sub.classId === assignClassId ? ' — already assigned' : ''}</option>
            ))}
          </select>
          <div className="mt-4 flex gap-2">
            <button type="button" onClick={handleAssign} className="btn-gold">Save assignment</button>
            <button type="button" onClick={() => { setAssignClassId(null); setAssignMode(null) }} className="rounded border border-school-border px-4 py-2 text-sm">Cancel</button>
          </div>
        </div>
      )}
    </AppLayout>
  )
}

export default withAuth(ClassesPage, { roles: ['SuperAdmin', 'SchoolAdmin'] })
