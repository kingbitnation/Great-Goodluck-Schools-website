import Link from 'next/link'
import DashboardPreview from './DashboardPreview'

export default function Hero() {
  return (
    <section className="relative -mt-[72px] overflow-hidden bg-school-navy pt-[72px] text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_80%_-10%,rgba(37,99,235,0.35),transparent)]" />
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-school-gold/40 to-transparent" />
      </div>

      <div className="container-school relative grid items-center gap-12 py-16 sm:py-20 lg:grid-cols-2 lg:gap-14 lg:py-24">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-school-gold">
            Built for Nigerian schools
          </p>

          <h1 className="font-display mt-5 text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-5xl lg:text-[3.4rem]">
            One platform for fees, exams, results, and daily school operations.
          </h1>

          <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-300 sm:text-lg">
            SchoolPilot helps proprietors, teachers, parents, and students work from the same system —
            not five different apps and a stack of spreadsheets.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/register-school" className="btn-gold">
              Start 14-day free trial
            </Link>
            <Link href="/pricing" className="btn-outline">
              View pricing
            </Link>
          </div>

          <dl className="mt-10 grid grid-cols-2 gap-4 border-t border-white/10 pt-8 sm:grid-cols-4">
            {[
              { label: 'Modules', value: '15+' },
              { label: 'Setup', value: 'Days' },
              { label: 'Payments', value: 'NGN' },
              { label: 'Support', value: '24/7' },
            ].map((item) => (
              <div key={item.label}>
                <dt className="text-xs uppercase tracking-wide text-slate-400">{item.label}</dt>
                <dd className="font-display mt-1 text-xl font-bold text-white">{item.value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="lg:pl-2">
          <DashboardPreview />
        </div>
      </div>
    </section>
  )
}
