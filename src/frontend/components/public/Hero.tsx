import Link from 'next/link'
import { SchoolPilotPrimaryLogo } from './Brand'

export default function Hero() {
  return (
    <section className="relative -mt-[72px] overflow-hidden bg-school-navy pt-[72px] text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-20 top-20 h-72 w-72 rounded-full bg-school-royal/20 blur-3xl" />
        <div className="absolute -right-20 bottom-10 h-80 w-80 rounded-full bg-school-gold/10 blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(37,99,235,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(37,99,235,0.06)_1px,transparent_1px)] bg-[size:48px_48px] opacity-50" />
      </div>

      <div className="container-school relative grid items-center gap-12 py-16 sm:py-20 lg:grid-cols-2 lg:py-28">
        <div className="animate-fade-up">
          <span className="badge-royal border border-school-royal/30 text-[#93c5fd]">
            Multi-School SaaS Platform
          </span>
          <h1 className="font-display mt-6 text-3xl font-bold leading-tight sm:text-4xl lg:text-5xl xl:text-6xl">
            <span className="text-[#F8FAFC]">School</span>
            <span className="text-school-royal">Pilot</span>
          </h1>
          <p className="mt-3 font-display text-sm font-medium uppercase tracking-widest text-school-muted">
            Navigating Education · Empowering Futures
          </p>
          <p className="mt-5 max-w-lg text-sm leading-relaxed text-[#cbd5e1] sm:text-base">
            The all-in-one ERP + LMS + CBT + AI platform for schools. Manage academics, fees,
            admissions, payroll, and more — from one beautiful dashboard.
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <Link href="/register-school" className="btn-gold">Register your school</Link>
            <Link href="/pricing" className="btn-outline">View Pricing</Link>
          </div>
        </div>

        <div className="animate-fade-up relative hidden lg:block" style={{ animationDelay: '0.15s' }}>
          <div className="glass-card relative overflow-hidden rounded-3xl border-white/10 bg-[#F8FAFC]/95 p-8 shadow-royal">
            <div className="flex flex-col items-center justify-center rounded-2xl bg-school-bg px-6 py-10">
              <SchoolPilotPrimaryLogo size="lg" />
              <p className="mt-6 font-display text-lg font-semibold text-school-navy">Built for Nigerian Schools</p>
              <p className="text-sm text-school-muted">ERP · LMS · CBT · AI · Payroll</p>
            </div>
          </div>
          <div className="absolute -bottom-4 -left-4 rounded-2xl border border-school-green/30 bg-school-green px-5 py-3 shadow-soft-lg">
            <p className="font-display text-2xl font-bold text-white">500+</p>
            <p className="text-xs font-semibold text-[#d1fae5]">Schools Ready</p>
          </div>
        </div>
      </div>

      <div className="h-1 bg-gradient-to-r from-transparent via-school-royal/60 to-transparent" />
    </section>
  )
}
