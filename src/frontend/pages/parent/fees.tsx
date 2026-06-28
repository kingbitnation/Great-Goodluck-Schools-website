import { useEffect, useState } from 'react'
import { withAuth } from '../../components/withAuth'
import AppLayout from '../../components/layout/AppLayout'
import FeesPortal from '../../components/fees/FeesPortal'
import { apiGet } from '../../lib/api'
import type { AuthUser } from '../../lib/useAuth'

type Child = {
  id: string
  user: { firstName: string; lastName: string }
  class?: { name: string }
}

function ParentFeesPage({ user }: { user: AuthUser }) {
  const [children, setChildren] = useState<Child[]>([])
  const [selectedChild, setSelectedChild] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    apiGet<Child[]>('/api/parents/children')
      .then((data) => {
        setChildren(data)
        if (data.length > 0) setSelectedChild(data[0].id)
      })
      .catch(() => setError('Failed to load children'))
  }, [])

  if (error) {
    return <AppLayout user={user} title="Fees"><div className="p-8 text-red-600">{error}</div></AppLayout>
  }

  if (!children.length) {
    return <AppLayout user={user} title="Fees"><div className="p-8 text-slate-500">No children linked to your account.</div></AppLayout>
  }

  const child = children.find((c) => c.id === selectedChild)

  return (
    <div>
      <div className="mx-auto max-w-6xl px-6 pt-6">
        <label className="text-sm font-medium text-slate-600">Paying for</label>
        <select value={selectedChild} onChange={(e) => setSelectedChild(e.target.value)} className="mt-1 max-w-md">
          {children.map((c) => (
            <option key={c.id} value={c.id}>
              {c.user.firstName} {c.user.lastName} ({c.class?.name || 'No class'})
            </option>
          ))}
        </select>
      </div>
      {selectedChild && (
        <FeesPortal
          user={user}
          studentId={selectedChild}
          title={`Fees — ${child?.user.firstName || ''} ${child?.user.lastName || ''}`}
          pageTitle="Fees"
        />
      )}
    </div>
  )
}

export default withAuth(ParentFeesPage, { roles: ['Parent'] })
