import { useEffect, useState } from 'react'
import Link from 'next/link'
import PublicLayout from '../components/layout/PublicLayout'
import Seo from '../components/Seo'
import PricingCards, { BillingIntervalToggle, type Plan } from '../components/billing/PricingCards'
import FeatureComparison from '../components/billing/FeatureComparison'
import { SectionLabel, SectionTitle } from '../components/public/Brand'
import Reveal from '../components/public/Reveal'
import type { BillingInterval } from '../lib/design-tokens'

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000'

export default function PricingPage() {
  const [plans, setPlans] = useState<Plan[]>([])
  const [interval, setInterval] = useState<BillingInterval>('monthly')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`${API_BASE}/api/subscription-plans`)
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
      <PublicLayout title="Simple, transparent pricing" subtitle="14-day free trial · Pay by bank transfer" noHero fullWidth>
        <section className="section-pad bg-gradient-to-b from-school-navy via-[#1e3a5f] to-school-bg dark:to-school-dark-bg">
          <div className="container-school text-center">
            <Reveal>
              <SectionLabel light>Plans & Pricing</SectionLabel>
              <SectionTitle light className="mt-4">
                Choose the right plan for your school
              </SectionTitle>
              <p className="mx-auto mt-4 max-w-2xl text-slate-300">
                From small academies to large school networks — scale as you grow. All plans include a 14-day free trial with full access.
              </p>
              <div className="mt-8 flex justify-center">
                <BillingIntervalToggle value={interval} onChange={setInterval} />
              </div>
            </Reveal>
          </div>
        </section>

        <section className="section-pad -mt-8">
          <div className="container-school">
            {loading ? (
              <p className="text-center text-slate-500">Loading plans…</p>
            ) : (
              <>
                <PricingCards plans={plans} interval={interval} />
                <FeatureComparison plans={plans} />
              </>
            )}
            <Reveal>
              <div className="mt-16 rounded-2xl bg-school-royal/5 border border-school-royal/20 p-8 text-center">
                <h3 className="font-display text-xl font-bold text-school-navy dark:text-white">Need a custom solution?</h3>
                <p className="mt-2 text-slate-600">Ultimate plan includes white-glove onboarding, custom SLA, and dedicated infrastructure.</p>
                <Link href="/contact" className="btn-royal mt-6 inline-flex">Talk to Sales</Link>
              </div>
            </Reveal>
          </div>
        </section>
      </PublicLayout>
    </>
  )
}
