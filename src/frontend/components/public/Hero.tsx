import Link from 'next/link'
import DashboardPreview from './DashboardPreview'

export default function Hero() {
  return (
    <section className="relative -mt-[72px] min-h-[88vh] overflow-hidden bg-gradient-to-b from-school-navy via-[#0a1628] to-school-navy pt-[72px] text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-32 top-24 h-96 w-96 rounded-full bg-school-royal/20 blur-3xl" />
        <div className="absolute -right-24 bottom-20 h-80 w-80 rounded-full bg-school-gold/10 blur-3xl" />
      </div>

      <div className="container-school relative flex min-h-[calc(88vh-72px)] flex-col justify-center py-16 lg:py-20">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-school-gold">
              School management platform
            </p>

            <h1 className="font-display mt-8 text-4xl font-bold leading-tight tracking-tight sm:text-5xl lg:text-[3.25rem]">
              One system for your entire school
            </h1>

            <p className="mt-6 max-w-lg text-base leading-relaxed text-slate-300 sm:text-lg">
              SchoolPilot brings fees, exams, attendance, payroll, parent communication, and AI tools
              into a single platform built for Nigerian schools.
            </p>

            <div className="mt-10 flex flex-wrap items-center gap-4">
              <Link href="/register-school" className="btn-gold">
                Start 14-day trial
              </Link>
              <Link href="/pricing" className="rounded-pill border border-white/25 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10">
                View pricing
              </Link>
            </div>

            <div className="mt-12 flex flex-wrap gap-8 border-t border-white/10 pt-8">
              {[
                { n: '40+', l: 'Modules' },
                { n: 'Multi', l: 'Role portals' },
                { n: '14', l: 'Day free trial' },
              ].map((s) => (
                <div key={s.l}>
                  <p className="font-display text-2xl font-bold">{s.n}</p>
                  <p className="text-xs font-medium uppercase tracking-wider text-slate-400">{s.l}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="relative lg:pl-4">
            <DashboardPreview className="relative shadow-2xl" />
          </div>
        </div>
      </div>
    </section>
  )
}
