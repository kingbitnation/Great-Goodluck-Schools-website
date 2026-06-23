import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import AppLayout from '../../../components/layout/AppLayout'
import { withAuth } from '../../../components/withAuth'
import { apiGet, apiPut } from '../../../lib/api'
import type { AuthUser } from '../../../lib/useAuth'

function StudentProfile({ user }: { user: AuthUser }) {
  const router = useRouter()
  const { id } = router.query
  const [student, setStudent] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<any>({})

  useEffect(() => {
    if (!id) return
    setLoading(true)
    apiGet(`/api/students/${id}`)
      .then((s: any) => {
        setStudent(s)
        setForm({ firstName: s.user.firstName, lastName: s.user.lastName, email: s.user.email, admissionNo: s.admissionNo, classId: s.classId })
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [id])

  async function handleSave() {
    try {
      setLoading(true)
      const payload = { email: form.email, firstName: form.firstName, lastName: form.lastName, admissionNo: form.admissionNo, classId: form.classId }
      const res = await apiPut(`/api/students/${id}`, payload)
      setStudent(res.student || res)
      setEditing(false)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AppLayout user={user} title={student ? `${student.user.firstName} ${student.user.lastName}` : 'Student'}>
      {loading && <p className="text-gray-500">Loading...</p>}
      {error && <div className="text-red-600">{error}</div>}
      {student && (
        <div className="space-y-4">
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <h3 className="font-semibold">Profile</h3>
            {!editing ? (
              <div className="mt-2">
                <p><strong>Email:</strong> {student.user.email}</p>
                <p><strong>Name:</strong> {student.user.firstName} {student.user.lastName}</p>
                <p><strong>Admission No:</strong> {student.admissionNo}</p>
                <p><strong>Class:</strong> {student.class?.name || 'Unassigned'}</p>
                <button onClick={() => setEditing(true)} className="mt-2 rounded bg-blue-600 px-3 py-1 text-white">Edit</button>
              </div>
            ) : (
              <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-2">
                <input value={form.email} onChange={(e)=>setForm({...form,email:e.target.value})} placeholder="Email" className="w-full rounded-md border px-3 py-2" />
                <input value={form.firstName} onChange={(e)=>setForm({...form,firstName:e.target.value})} placeholder="First name" className="w-full rounded-md border px-3 py-2" />
                <input value={form.lastName} onChange={(e)=>setForm({...form,lastName:e.target.value})} placeholder="Last name" className="w-full rounded-md border px-3 py-2" />
                <input value={form.admissionNo} onChange={(e)=>setForm({...form,admissionNo:e.target.value})} placeholder="Admission No" className="w-full rounded-md border px-3 py-2" />
                <div className="col-span-2 flex gap-2">
                  <button onClick={handleSave} className="rounded bg-green-600 px-3 py-1 text-white">Save</button>
                  <button onClick={()=>setEditing(false)} className="rounded bg-gray-200 px-3 py-1">Cancel</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </AppLayout>
  )
}

export default withAuth(StudentProfile, { roles: ['SuperAdmin', 'SchoolAdmin', 'Teacher'] })
