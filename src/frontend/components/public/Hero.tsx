import Link from 'next/link'
import DashboardPreview from './DashboardPreview'

export default function Hero() {
  return (
    <section className="relative -mt-[72px] overflow-hidden bg-school-navy pt-[72px] text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_55%_at_70%_-15%,rgba(37,99,235,0.45),transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_40%_at_0%_100%,rgba(245,158,11,0.12),transparent)]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:48px_48px]" />
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-school-royal via-school-gold to-school-green" />
      </div>

      <div className="container-school relative grid items-center gap-12 py-16 sm:py-20 lg:grid-cols-2 lg:gap-14 lg:py-24">
        <div className="border-l-4 border-school-gold pl-6 sm:pl-8">
          <p className="inline-flex items-center gap-2 text-sm font-bold uppercase tracking-[0.2em] text-school-gold">
            <span className="h-2 w-2 animate-pulse rounded-full bg-school-green" />
            Built for Nigerian schools
          </p>

          <h1 className="font-display mt-5 text-4xl font-extrabold leading-[1.06] tracking-tight sm:text-5xl lg:text-[3.5rem]">
            Run your entire school on{' '}
            <span className="text-school-gold">one powerful platform.</span>
          </h1>

          <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-300 sm:text-lg">
            Fees, CBT, results, payroll, parent comms, and AI — SchoolPilot keeps proprietors, teachers,
            parents, and students on the same system.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/register-school" className="btn-gold shadow-glow">
              Start 14-day free trial
            </Link>
            <Link href="/pricing" className="btn-outline">
              View pricing
            </Link>
          </div>

          <dl className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: 'Modules', value: '40+' },
              { label: 'Roles', value: '12+' },
              { label: 'Currency', value: '₦ NGN' },
              { label: 'Support', value: '24/7' },
            ].map((item) => (
              <div key={item.label} className="rounded-xl border border-white/10 bg-white/5 px-3 py-3 backdrop-blur-sm">
                <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{item.label}</dt>
                <dd className="font-display mt-1 text-lg font-bold text-white sm:text-xl">{item.value}</dd>
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
