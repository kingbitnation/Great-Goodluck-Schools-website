import { useEffect, useState } from 'react'
import { withAuth } from '../../components/withAuth'
import AppLayout from '../../components/layout/AppLayout'
import { apiGet } from '../../lib/api'
import type { AuthUser } from '../../lib/useAuth'

type AuditLog = {
  id: string
  action: string
  resource: string
  resourceId: string | null
  ipAddress: string | null
  createdAt: string
  user: {
    email: string
    firstName: string
    lastName: string
    role: { name: string }
  } | null
}

function AuditLogsPage({ user }: { user: AuthUser }) {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    apiGet<AuditLog[]>('/api/audit-logs?limit=100')
      .then(setLogs)
      .catch(() => setError('Failed to load audit logs'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <AppLayout user={user} title="Audit logs">
      <div className="mx-auto max-w-6xl p-6">
        <h1 className="mb-6 text-2xl font-bold text-school-navy">Activity audit log</h1>
        {loading && <p className="text-slate-500">Loading...</p>}
        {error && <p className="text-red-600">{error}</p>}
        {!loading && !error && (
          <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-4 py-3">Time</th>
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Resource</th>
                  <th className="px-4 py-3">IP</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-b last:border-0">
                    <td className="whitespace-nowrap px-4 py-3">{new Date(log.createdAt).toLocaleString()}</td>
                    <td className="px-4 py-3">
                      {log.user ? (
                        <span>{log.user.firstName} {log.user.lastName} <span className="text-slate-500">({log.user.role.name})</span></span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 font-medium">{log.action}</td>
                    <td className="px-4 py-3">{log.resource}{log.resourceId ? ` #${log.resourceId.slice(0, 8)}` : ''}</td>
                    <td className="px-4 py-3 text-slate-500">{log.ipAddress || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {logs.length === 0 && <p className="p-8 text-center text-slate-500">No audit entries yet</p>}
          </div>
        )}
      </div>
    </AppLayout>
  )
}

export default withAuth(AuditLogsPage, { roles: ['SuperAdmin', 'SchoolAdmin'] })
