import { useEffect, useState } from 'react'
import Link from 'next/link'
import PublicLayout from '../components/layout/PublicLayout'
import Seo from '../components/Seo'
import PricingCards, { BillingIntervalToggle, type Plan } from '../components/billing/PricingCards'
import FeatureComparison from '../components/billing/FeatureComparison'
import { SectionLabel, SectionTitle } from '../components/public/Brand'
import Reveal from '../components/public/Reveal'
import ModuleMarquee from '../components/public/ModuleMarquee'
import type { BillingInterval } from '../lib/design-tokens'
import { apiBaseUrl } from '../lib/apiBase'

const TRUST_ITEMS = [
  '14-day free trial',
  'No credit card required',
  'Pay by bank transfer',
  'Cancel anytime',
]

const INCLUDED = [
  { label: 'Student & parent portals', icon: 'feature-icon-blue' },
  { label: 'Fee collection & receipts', icon: 'feature-icon-gold' },
  { label: 'Results & broadsheets', icon: 'feature-icon-green' },
  { label: '24/7 email support', icon: 'feature-icon-violet' },
]

export default function PricingPage() {
  const [plans, setPlans] = useState<Plan[]>([])
  const [interval, setInterval] = useState<BillingInterval>('monthly')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`${apiBaseUrl()}/api/subscription-plans`)
      .then((r) => r.json())
      .then(setPlans)
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
        <section className="hero-mesh relative -mt-[72px] overflow-hidden bg-school-navy pt-[72px] text-white">
          <div className="pointer-events-none absolute inset-0">
            <div className="animate-blob absolute -left-32 top-0 h-96 w-96 rounded-full bg-school-royal/30 blur-3xl" />
            <div className="animate-blob animation-delay-2000 absolute right-0 top-1/4 h-80 w-80 rounded-full bg-school-gold/20 blur-3xl" />
            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:64px_64px]" />
          </div>

          <div className="container-school relative py-14 text-center sm:py-20">
            <Reveal>
              <SectionLabel light>Plans & Pricing</SectionLabel>
              <SectionTitle light className="mt-4 text-balance">
                Simple, transparent pricing for every school size
              </SectionTitle>
              <p className="mx-auto mt-4 max-w-2xl text-slate-300">
                From small academies to large school networks — scale as you grow. All plans include a
                14-day free trial with full access.
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
            </Reveal>
          </div>
          <div className="h-px bg-gradient-to-r from-transparent via-school-royal/50 to-transparent" />
        </section>

        <ModuleMarquee />

        <section className="section-pad -mt-6 relative z-10 sm:-mt-10">
          <div className="container-school">
            {loading ? (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-5">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-80 animate-pulse rounded-2xl bg-school-border/40" />
                ))}
              </div>
            ) : (
              <>
                <PricingCards plans={plans} interval={interval} />
                <FeatureComparison plans={plans} />
              </>
            )}
          </div>
        </section>

        <section className="section-pad mesh-bg">
          <div className="container-school">
            <Reveal>
              <div className="text-center">
                <SectionLabel>Every plan includes</SectionLabel>
                <SectionTitle className="mt-4">Core features out of the box</SectionTitle>
              </div>
            </Reveal>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {INCLUDED.map((item, i) => (
                <Reveal key={item.label} delay={i * 80}>
                  <div className="flex items-center gap-4 rounded-card border border-school-border/60 bg-school-surface p-5 shadow-soft">
                    <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${item.icon}`}>
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <p className="text-sm font-semibold text-school-navy dark:text-school-text">{item.label}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section className="section-pad">
          <div className="container-school">
            <Reveal>
              <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-school-navy via-[#1e3a5f] to-school-royal p-8 text-center shadow-royal sm:p-14">
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,rgba(245,158,11,0.15),transparent_50%)]" />
                <div className="relative">
                  <h3 className="font-display text-2xl font-bold text-white sm:text-3xl">Need a custom solution?</h3>
                  <p className="mx-auto mt-3 max-w-xl text-slate-300">
                    Ultimate plan includes white-glove onboarding, custom SLA, and dedicated infrastructure for
                    large school networks.
                  </p>
                  <div className="mt-8 flex flex-wrap justify-center gap-4">
                    <Link href="/contact" className="btn-gold shadow-glow">
                      Talk to sales
                    </Link>
                    <Link href="/register-school" className="btn-outline">
                      Start free trial
                    </Link>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </section>
      </PublicLayout>
    </>
  )
}
