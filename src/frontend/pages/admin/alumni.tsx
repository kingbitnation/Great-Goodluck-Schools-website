import Link from 'next/link'
import { useEffect, useState } from 'react'
import { withAuth } from '../../components/withAuth'
import AppLayout from '../../components/layout/AppLayout'
import { apiGet } from '../../lib/api'
import type { AuthUser } from '../../lib/useAuth'

type AlumniStats = {
  members: number
  mentors: number
  events: number
  donationsTotal: number
  donationCount: number
  activeMentorships: number
}

function AdminAlumniPage({ user }: { user: AuthUser }) {
  const [stats, setStats] = useState<AlumniStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiGet<AlumniStats>('/api/alumni/stats')
      .then(setStats)
      .finally(() => setLoading(false))
  }, [])

  const links = [
    { href: '/alumni/directory', label: 'Directory', desc: 'Browse alumni profiles' },
    { href: '/alumni/events', label: 'Events', desc: 'Reunions and meetups' },
    { href: '/admin/alumni-donations', label: 'Confirm donations', desc: 'Verify bank transfer donations' },
    { href: '/alumni/donate', label: 'Public donate page', desc: 'Donation landing page' },
    { href: '/alumni/mentorship', label: 'Mentorship', desc: 'Match mentors and mentees' },
  ]

  return (
    <AppLayout user={user} title="Alumni">
      <div className="p-8 max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Alumni Management</h1>
        <p className="text-school-muted mb-8">Directory, events, donations, and mentorship programs.</p>

        {loading ? (
          <div className="text-gray-500">Loading...</div>
        ) : stats && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-10">
            {[
              { label: 'Members', value: stats.members },
              { label: 'Mentors', value: stats.mentors },
              { label: 'Events', value: stats.events },
              { label: 'Donations', value: stats.donationCount },
              { label: 'Raised', value: `₦${stats.donationsTotal.toLocaleString()}` },
              { label: 'Active mentorships', value: stats.activeMentorships },
            ].map((c) => (
              <div key={c.label} className="bg-white rounded-lg shadow p-4">
                <p className="text-sm text-gray-500">{c.label}</p>
                <p className="text-xl font-bold mt-1">{c.value}</p>
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {links.map((item) => (
            <Link key={item.href} href={item.href} className="content-card block p-6 hover:shadow-soft-lg">
              <h2 className="text-lg font-bold text-school-royal">{item.label}</h2>
              <p className="mt-1 text-sm text-school-muted">{item.desc}</p>
            </Link>
          ))}
        </div>
      </div>
    </AppLayout>
  )
}

export default withAuth(AdminAlumniPage, { roles: ['SuperAdmin', 'SchoolAdmin'] })
