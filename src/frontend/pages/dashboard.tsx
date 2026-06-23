import { useEffect, useState } from 'react'
import AppLayout from '../components/layout/AppLayout'
import StatCard from '../components/ui/StatCard'
import { withAuth } from '../components/withAuth'
import { apiGet } from '../lib/api'
import { navForRole, ROLE_LABELS } from '../lib/navigation'
import type { AuthUser } from '../lib/useAuth'
import Link from 'next/link'

type Stats = Record<string, number>

function DashboardPage({ user }: { user: AuthUser }) {
  const [stats, setStats] = useState<Stats | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    apiGet<Stats>('/api/dashboard/stats')
      .then(setStats)
      .catch((e) => setError(e.message))
  }, [])

  const quickLinks = navForRole(user.role).filter((item) => item.href !== '/dashboard')

  return (
    <AppLayout user={user} title="Dashboard">
      <p className="mb-6 text-gray-600">
        Welcome back, {user.firstName}. You are signed in as{' '}
        <span className="font-medium text-gray-900">{ROLE_LABELS[user.role] || user.role}</span>
        {user.schoolName ? ` at ${user.schoolName}` : ''}.
      </p>
      {['SuperAdmin', 'SchoolAdmin'].includes(user.role) && (
        <section className="mb-8 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Admin actions</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <Link
              href="/admin/students"
              className="rounded-lg border border-gray-200 bg-blue-50 px-4 py-3 text-sm font-medium text-blue-700 hover:border-blue-300 hover:bg-blue-100"
            >
              Register a student
            </Link>
            <Link
              href="/admin/teachers"
              className="rounded-lg border border-gray-200 bg-blue-50 px-4 py-3 text-sm font-medium text-blue-700 hover:border-blue-300 hover:bg-blue-100"
            >
              Onboard a teacher
            </Link>
          </div>
        </section>
      )}

      {error && (
        <div className="mb-6 rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {Object.entries(stats).map(([key, value]) => (
            <StatCard
              key={key}
              label={key.charAt(0).toUpperCase() + key.slice(1)}
              value={value}
            />
          ))}
        </div>
      )}

      {quickLinks.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-3">
            Quick links
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {quickLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-800 hover:border-blue-300 hover:bg-blue-50 transition-colors"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </section>
      )}
    </AppLayout>
  )
}

export default withAuth(DashboardPage)
