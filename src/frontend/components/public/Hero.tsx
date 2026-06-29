import Link from 'next/link'
import DashboardPreview from './DashboardPreview'

export default function Hero() {
  return (
    <section className="exclusive-scene relative -mt-[72px] min-h-[92vh] overflow-hidden bg-[#050d1a] pt-[72px] text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="animate-orb absolute -left-40 top-20 h-[28rem] w-[28rem] rounded-full bg-school-royal/25 blur-[100px]" />
        <div className="animate-orb animation-delay-2000 absolute -right-32 top-1/3 h-80 w-80 rounded-full bg-school-gold/15 blur-[90px]" />
        <div className="animate-orb animation-delay-4000 absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-school-green/10 blur-[80px]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_0%,rgba(37,99,235,0.2),transparent)]" />
        <div className="absolute inset-0 opacity-[0.35] mix-blend-overlay bg-noise" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:56px_56px]" />
      </div>

      <div className="container-school relative flex min-h-[calc(92vh-72px)] flex-col justify-center py-16 lg:py-20">
        <div className="grid items-center gap-14 lg:grid-cols-2 lg:gap-16">
          <div className="animate-fade-up">
            <div className="badge-exclusive">
              <span className="h-1.5 w-1.5 rounded-full bg-school-gold shadow-[0_0_8px_#f59e0b]" />
              Crafted by King Bit · Nigeria
            </div>

            <p className="font-serif mt-8 text-2xl italic text-school-gold/90 sm:text-3xl">
              Exclusive.
            </p>

            <h1 className="font-display mt-3 text-[2.75rem] font-extrabold leading-[1.02] tracking-tight sm:text-6xl lg:text-[4.25rem]">
              The school OS for those who{' '}
              <span className="text-shimmer">refuse to settle.</span>
            </h1>

            <p className="mt-6 max-w-lg text-base leading-relaxed text-slate-400 sm:text-lg">
              SchoolPilot isn&apos;t another app stack. It&apos;s one sovereign platform — fees, exams,
              payroll, parents, and AI — engineered for proprietors who run serious institutions.
            </p>

            <div className="mt-10 flex flex-wrap items-center gap-4">
              <Link href="/register-school" className="btn-exclusive">
                Claim your trial
              </Link>
              <Link href="/pricing" className="btn-ghost-light">
                View exclusives
              </Link>
            </div>

            <div className="mt-12 flex flex-wrap gap-6 border-t border-white/10 pt-8">
              {[
                { n: '40+', l: 'Modules' },
                { n: '₦', l: 'Naira-native' },
                { n: '14', l: 'Day trial' },
              ].map((s) => (
                <div key={s.l}>
                  <p className="font-display text-2xl font-bold text-white">{s.n}</p>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">{s.l}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="animate-fade-up relative lg:pl-4" style={{ animationDelay: '0.15s' }}>
            <div className="absolute -inset-4 rounded-[2rem] bg-gradient-to-br from-school-gold/20 via-transparent to-school-royal/20 blur-2xl" />
            <DashboardPreview className="relative" />
          </div>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-school-gold/60 to-transparent" />
    </section>
  )
}
