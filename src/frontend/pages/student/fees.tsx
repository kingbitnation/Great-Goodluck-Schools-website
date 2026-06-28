import { useEffect, useState } from 'react'
import { withAuth } from '../../components/withAuth'
import AppLayout from '../../components/layout/AppLayout'
import FeesPortal from '../../components/fees/FeesPortal'
import { apiGet } from '../../lib/api'
import type { AuthUser } from '../../lib/useAuth'

type StudentInfo = { id: string; user: { email: string } }

function StudentFeesPage({ user }: { user: AuthUser }) {
  const [studentId, setStudentId] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    apiGet<StudentInfo[]>('/api/students')
      .then((students) => {
        const me = students.find((s) => s.user.email === user.email)
        if (me) setStudentId(me.id)
        else setError('Student profile not found')
      })
      .catch(() => setError('Failed to load profile'))
  }, [user.email])

  if (error) {
    return <AppLayout user={user} title="My Fees"><div className="p-8 text-red-600">{error}</div></AppLayout>
  }
  if (!studentId) {
    return <AppLayout user={user} title="My Fees"><div className="p-8">Loading...</div></AppLayout>
  }

  return <FeesPortal user={user} studentId={studentId} title="Fees & Payments" pageTitle="My Fees" />
}

export default withAuth(StudentFeesPage)
