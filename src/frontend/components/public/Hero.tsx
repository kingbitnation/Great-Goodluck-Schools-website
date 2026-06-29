import Link from 'next/link'
import DashboardPreview from './DashboardPreview'

const TRUST_ITEMS = ['14-day free trial', 'No card required', 'Nigeria-ready payments', '24/7 support']

export default function Hero() {
  return (
    <section className="hero-mesh relative -mt-[72px] overflow-hidden bg-school-navy pt-[72px] text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="animate-blob absolute -left-32 top-0 h-96 w-96 rounded-full bg-school-royal/30 blur-3xl" />
        <div className="animate-blob animation-delay-2000 absolute right-0 top-1/4 h-80 w-80 rounded-full bg-school-gold/20 blur-3xl" />
        <div className="animate-blob animation-delay-4000 absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-school-green/15 blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:64px_64px]" />
      </div>

      <div className="container-school relative grid items-center gap-12 py-14 sm:py-20 lg:grid-cols-2 lg:gap-16 lg:py-24">
        <div className="animate-fade-up">
          <div className="inline-flex items-center gap-2 rounded-pill border border-white/15 bg-white/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-school-gold backdrop-blur-sm">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-school-green opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-school-green" />
            </span>
            All-in-one school operating system
          </div>

          <h1 className="font-display mt-6 text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl">
            Run your entire school on{' '}
            <span className="text-gradient-hero">one powerful platform</span>
          </h1>

          <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-300 sm:text-lg">
            SchoolPilot combines ERP, LMS, CBT, fees, payroll, and AI — so administrators, teachers,
            parents, and students stay connected in real time.
          </p>

          <div className="mt-8 flex flex-wrap gap-4">
            <Link href="/register-school" className="btn-gold shadow-glow">
              Start free trial
            </Link>
            <Link href="/pricing" className="btn-outline">
              See pricing
            </Link>
          </div>

          <ul className="mt-8 flex flex-wrap gap-x-5 gap-y-2">
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

        <div className="animate-fade-up lg:pl-4" style={{ animationDelay: '0.12s' }}>
          <DashboardPreview />
        </div>
      </div>

      <div className="h-px bg-gradient-to-r from-transparent via-school-royal/50 to-transparent" />
    </section>
  )
}
