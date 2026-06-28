import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { withAuth } from '../../components/withAuth'
import AppLayout from '../../components/layout/AppLayout'
import { apiGet, apiPut } from '../../lib/api'
import type { AuthUser } from '../../lib/useAuth'
import Link from 'next/link'

type Onboarding = {
  profileDone: boolean
  brandingDone: boolean
  subscriptionDone: boolean
  usersDone: boolean
  completedAt: string | null
}

function SetupWizardPage({ user }: { user: AuthUser }) {
  const router = useRouter()
  const justRegistered = router.query.registered === '1'
  const schoolId = user.schoolId || ''
  const [onboarding, setOnboarding] = useState<Onboarding | null>(null)
  const [schoolName, setSchoolName] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!schoolId) return
    apiGet<{ onboarding: Onboarding; school: { name: string; setupCompleted: boolean } }>(`/api/schools/${schoolId}/onboarding`)
      .then((data) => {
        setOnboarding(data.onboarding)
        setSchoolName(data.school.name)
      })
      .finally(() => setLoading(false))
  }, [schoolId])

  async function markDone(field: keyof Onboarding) {
    if (!schoolId) return
    const updated = await apiPut<Onboarding>(`/api/schools/${schoolId}/onboarding`, { [field]: true })
    setOnboarding(updated)
  }

  const steps = [
    { key: 'profileDone' as const, label: 'School profile', href: '/admin/school-branding', desc: 'Name, contact, bank details' },
    { key: 'brandingDone' as const, label: 'Branding', href: '/admin/school-branding', desc: 'Logo, colors, custom domain' },
    { key: 'subscriptionDone' as const, label: 'Subscription', href: '/admin/subscription', desc: 'Choose and pay for your plan' },
    { key: 'usersDone' as const, label: 'Add users', href: '/admin/teachers', desc: 'Invite teachers and staff' },
  ]

  if (!schoolId) {
    return <AppLayout user={user} title="Setup"><div className="p-8">No school linked to your account.</div></AppLayout>
  }

  if (loading) {
    return <AppLayout user={user} title="Setup"><div className="p-8">Loading...</div></AppLayout>
  }

  const completed = steps.filter((s) => onboarding?.[s.key]).length

  return (
    <AppLayout user={user} title="School setup">
      <div className="mx-auto max-w-3xl p-6">
        <h1 className="text-2xl font-bold text-school-navy">Setup wizard — {schoolName}</h1>
        {justRegistered && (
          <div className="mt-4 rounded-xl border border-school-green/30 bg-school-green/10 px-4 py-3 text-sm text-school-navy">
            <p className="font-semibold">Welcome to SchoolPilot!</p>
            <p className="mt-1 text-school-muted">
              Your school is live on a trial. We are verifying your bank payment and documents — you can complete setup
              while you wait.
            </p>
          </div>
        )}
        <p className="mt-2 text-slate-600">{completed} of {steps.length} steps complete</p>
        <div className="mt-4 h-2 rounded-full bg-slate-200">
          <div className="h-2 rounded-full bg-school-gold transition-all" style={{ width: `${(completed / steps.length) * 100}%` }} />
        </div>

        <ul className="mt-8 space-y-4">
          {steps.map((step) => (
            <li key={step.key} className="content-card flex items-center justify-between gap-4 p-5">
              <div>
                <p className="font-semibold">{step.label}</p>
                <p className="text-sm text-slate-500">{step.desc}</p>
              </div>
              <div className="flex items-center gap-3">
                {onboarding?.[step.key] ? (
                  <span className="text-sm font-medium text-green-600">Done</span>
                ) : (
                  <>
                    <Link href={step.href} className="text-sm text-school-gold hover:underline">Open</Link>
                    <button type="button" onClick={() => markDone(step.key)} className="rounded-lg border px-3 py-1 text-xs">Mark done</button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>

        {onboarding?.completedAt && (
          <p className="mt-6 text-center text-green-700 font-medium">Setup complete! Welcome to your portal.</p>
        )}
      </div>
    </AppLayout>
  )
}

export default withAuth(SetupWizardPage, { roles: ['SchoolAdmin'] })
