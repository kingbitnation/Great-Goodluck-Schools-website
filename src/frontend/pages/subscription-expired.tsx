import Link from 'next/link'
import { useEffect, useState } from 'react'
import { SchoolPilotLogo } from '../components/public/Brand'
import Seo from '../components/Seo'

export default function SubscriptionExpiredPage() {
  const [code, setCode] = useState<string | null>(null)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      setCode(params.get('code'))
    }
  }, [])

  const isTrial = code === 'TRIAL_EXPIRED'

  return (
    <>
      <Seo title="Subscription Expired" description="Your SchoolPilot subscription has expired." path="/subscription-expired" />
      <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-school-navy via-[#1e3a5f] to-school-navy px-4">
        <div className="mb-8">
          <SchoolPilotLogo light size="lg" />
        </div>
        <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-8 text-center backdrop-blur-md">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/20 text-3xl">⏱</div>
          <h1 className="font-display text-2xl font-bold text-white">
            {isTrial ? 'Free Trial Ended' : 'Subscription Expired'}
          </h1>
          <p className="mt-3 text-slate-300">
            {isTrial
              ? 'Your 14-day free trial has ended. Subscribe to a plan to restore full access to your school portal.'
              : 'Your subscription has expired. Renew your plan or contact SchoolPilot support to reactivate your account.'}
          </p>
          <p className="mt-4 text-sm text-slate-400">
            Only a Platform Super Admin can manually reactivate suspended schools. School admins can subscribe from the billing page once reactivated.
          </p>
          <div className="mt-8 flex flex-col gap-3">
            <Link href="/admin/billing" className="btn-royal w-full text-center">
              View Plans & Subscribe
            </Link>
            <Link href="/contact" className="btn-outline w-full text-center">
              Contact Support
            </Link>
            <Link href="/login" className="text-sm text-slate-400 hover:text-white">
              Back to login
            </Link>
          </div>
        </div>
      </div>
    </>
  )
}
