import Link from 'next/link'
import { useEffect, useState } from 'react'
import { withAuth } from '../../components/withAuth'
import AppLayout from '../../components/layout/AppLayout'
import { apiGet } from '../../lib/api'
import type { AuthUser } from '../../lib/useAuth'

type AlumniProfile = {
  id: string
  fullName: string
  graduationYear?: number | null
  openToMentor: boolean
}

function AlumniPortalPage({ user }: { user: AuthUser }) {
  const [profile, setProfile] = useState<AlumniProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user.role === 'Alumni') {
      apiGet<AlumniProfile | null>('/api/alumni/me')
        .then(setProfile)
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [user.role])

  const links = [
    { href: '/alumni/directory', label: 'Directory', desc: 'Find fellow graduates' },
    { href: '/alumni/events', label: 'Events', desc: 'RSVP to reunions and meetups' },
    { href: '/alumni/donate', label: 'Give Back', desc: 'Support your alma mater' },
    { href: '/alumni/mentorship', label: 'Mentorship', desc: 'Connect mentors and mentees' },
  ]

  return (
    <AppLayout user={user} title="Alumni Portal">
      <div className="p-8 max-w-5xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Alumni Portal</h1>
        <p className="text-gray-600 mb-8">Stay connected with your school community.</p>

        {user.role === 'Alumni' && !loading && (
          <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-5 mb-8">
            {profile ? (
              <>
                <p className="font-semibold text-indigo-900">Welcome back, {profile.fullName}</p>
                <p className="text-sm text-indigo-700 mt-1">
                  Class of {profile.graduationYear || '—'}
                  {profile.openToMentor ? ' · Open to mentor' : ''}
                </p>
              </>
            ) : (
              <p className="text-indigo-800">
                Complete your alumni profile —{' '}
                <Link href="/alumni/join" className="underline font-medium">join the network</Link>
              </p>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {links.map((item) => (
            <Link key={item.href} href={item.href} className="bg-white rounded-lg shadow p-6 hover:shadow-md transition block">
              <h2 className="text-lg font-bold text-blue-700">{item.label}</h2>
              <p className="text-sm text-gray-600 mt-1">{item.desc}</p>
            </Link>
          ))}
        </div>

        {(user.role === 'SchoolAdmin' || user.role === 'SuperAdmin') && (
          <p className="mt-8 text-sm">
            <Link href="/admin/alumni" className="text-blue-600 hover:underline">Admin alumni dashboard →</Link>
          </p>
        )}
      </div>
    </AppLayout>
  )
}

export default withAuth(AlumniPortalPage, { roles: ['SuperAdmin', 'SchoolAdmin', 'Alumni', 'Student', 'Parent', 'Teacher'] })
