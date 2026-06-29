import Link from 'next/link'
import { SectionLabel, SectionTitle } from './Brand'

const STEPS = [
  {
    step: '01',
    title: 'Claim your school',
    desc: 'Select your tier. Submit credentials. We verify — you get full access in minutes.',
    border: 'border-school-royal/50',
    text: 'text-school-royal',
  },
  {
    step: '02',
    title: 'Deploy your team',
    desc: 'Import classes, assign roles, open portals for staff, parents, and students.',
    border: 'border-school-gold/50',
    text: 'text-school-gold',
  },
  {
    step: '03',
    title: 'Run the term',
    desc: 'Fees, CBT, results, payroll — one command centre. No duct tape required.',
    border: 'border-school-green/50',
    text: 'text-school-green',
  },
]

export default function HowItWorks() {
  return (
    <section className="exclusive-scene relative overflow-hidden py-20 sm:py-28">
      <div className="pointer-events-none absolute inset-0 bg-noise opacity-25" />
      <div className="container-school relative">
        <div className="flex flex-col items-start justify-between gap-6 lg:flex-row lg:items-end">
          <div className="max-w-xl">
            <SectionLabel light>Onboarding</SectionLabel>
            <SectionTitle light className="mt-4">
              Live in days.{' '}
              <span className="font-serif italic text-school-gold">Not quarters.</span>
            </SectionTitle>
          </div>
          <Link href="/register-school" className="btn-exclusive shrink-0">
            Start now
          </Link>
        </div>

        <ol className="mt-14 grid gap-6 md:grid-cols-3">
          {STEPS.map((s) => (
            <li
              key={s.step}
              className={`card-luxury rounded-2xl border bg-white/[0.04] p-7 backdrop-blur-md ${s.border}`}
            >
              <span className={`font-display text-4xl font-black ${s.text}`}>{s.step}</span>
              <h3 className="mt-4 font-display text-xl font-bold text-white">{s.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-slate-400">{s.desc}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
