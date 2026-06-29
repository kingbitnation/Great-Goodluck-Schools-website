import { useEffect, useState } from 'react'
import Link from 'next/link'
import PublicLayout from '../components/layout/PublicLayout'
import Seo from '../components/Seo'
import PricingCards, { BillingIntervalToggle, type Plan } from '../components/billing/PricingCards'
import FeatureComparison from '../components/billing/FeatureComparison'
import { SectionLabel, SectionTitle } from '../components/public/Brand'
import { fetchSubscriptionPlans } from '../lib/fetchPlans'
import type { BillingInterval } from '../lib/design-tokens'

const TRUST_ITEMS = [
  '14-day free trial',
  'No credit card required',
  'Pay by bank transfer',
  'Cancel anytime',
]

const INCLUDED = [
  'Student & parent portals',
  'Fee collection & receipts',
  'Results & broadsheets',
  'Email support',
]

export default function PricingPage() {
  const [plans, setPlans] = useState<Plan[]>([])
  const [interval, setInterval] = useState<BillingInterval>('monthly')
  const [loading, setLoading] = useState(true)
  const [usingFallback, setUsingFallback] = useState(false)

  useEffect(() => {
    fetchSubscriptionPlans()
      .then((data) => {
        setPlans(data)
        setUsingFallback(data[0]?.id?.startsWith('fallback-') ?? false)
      })
      .finally(() => setLoading(false))
  }, [])

  return (
    <>
      <Seo
        title="Pricing"
        description="SchoolPilot subscription plans — from Starter to Ultimate. 14-day free trial on all plans."
        path="/pricing"
      />
      <PublicLayout title="" subtitle="" noHero fullWidth>
        <section className="relative -mt-[72px] overflow-hidden bg-school-navy pt-[72px] text-white">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(37,99,235,0.4),transparent)]" />
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-school-royal via-school-gold to-school-green" />
          <div className="container-school relative py-14 text-center sm:py-20">
            <SectionLabel light>Plans & Pricing</SectionLabel>
            <SectionTitle light className="mt-4 text-balance">
              Straightforward plans in Naira
            </SectionTitle>
            <p className="mx-auto mt-4 max-w-2xl text-slate-300">
              Pick a plan that fits your school size. Every plan includes a 14-day trial with full access.
            </p>
            <div className="mt-8 flex justify-center">
              <BillingIntervalToggle value={interval} onChange={setInterval} variant="dark" />
            </div>
            <ul className="mt-8 flex flex-wrap justify-center gap-x-5 gap-y-2">
              {TRUST_ITEMS.map((item) => (
                <li key={item} className="flex items-center gap-2 text-sm text-slate-400">
                  <svg className="h-4 w-4 shrink-0 text-school-green" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="section-pad -mt-8 relative z-10">
          <div className="container-school">
            {usingFallback && !loading && (
              <p className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-center text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100">
                Showing standard plan prices. Live billing syncs when the backend is connected.
              </p>
            )}
            {loading ? (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-5">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-80 animate-pulse rounded-2xl bg-school-border/40" />
                ))}
              </div>
            ) : plans.length === 0 ? (
              <p className="text-center text-school-muted">No plans available right now. Please contact us.</p>
            ) : (
              <>
                <PricingCards plans={plans} interval={interval} />
                <FeatureComparison plans={plans} />
              </>
            )}
          </div>
        </section>

        <section className="border-y border-school-border/60 bg-school-bg py-8">
          <div className="container-school">
            <p className="text-center text-sm font-semibold uppercase tracking-wide text-school-muted">
              Every plan includes
            </p>
            <ul className="mt-4 flex flex-wrap justify-center gap-3">
              {INCLUDED.map((item) => (
                <li
                  key={item}
                  className="rounded-pill border border-school-border bg-school-surface px-4 py-2 text-sm font-medium text-school-navy dark:text-school-text"
                >
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="section-pad">
          <div className="container-school">
            <div className="rounded-3xl border border-school-border bg-school-surface p-8 text-center sm:p-12">
              <h3 className="font-display text-2xl font-bold text-school-navy dark:text-school-text sm:text-3xl">
                Need Ultimate or a custom rollout?
              </h3>
              <p className="mx-auto mt-3 max-w-xl text-school-muted">
                Large school groups get dedicated onboarding, custom SLA, and infrastructure tailored to their network.
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-4">
                <Link href="/contact" className="btn-royal">
                  Talk to King Bit
                </Link>
                <Link href="/register-school" className="btn-navy">
                  Start free trial
                </Link>
              </div>
            </div>
          </div>
        </section>
      </PublicLayout>
    </>
  )
}
