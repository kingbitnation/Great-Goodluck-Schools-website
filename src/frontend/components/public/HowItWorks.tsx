import Reveal from './Reveal'
import { SectionLabel, SectionTitle } from './Brand'

const STEPS = [
  {
    step: '01',
    title: 'Register your school',
    desc: 'Pick a plan, verify your school, and upload branding in minutes.',
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    ),
    gradient: 'from-school-royal to-blue-600',
  },
  {
    step: '02',
    title: 'Onboard staff & students',
    desc: 'Import classes, assign roles, and invite teachers, parents, and students.',
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
    ),
    gradient: 'from-school-gold to-amber-600',
  },
  {
    step: '03',
    title: 'Run everything in one hub',
    desc: 'Fees, exams, results, shop, payroll, and AI — all from one dashboard.',
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
    ),
    gradient: 'from-school-green to-emerald-600',
  },
]

export default function HowItWorks() {
  return (
    <section className="section-pad bg-white dark:bg-school-surface">
      <div className="container-school">
        <Reveal>
          <div className="text-center">
            <SectionLabel>How it works</SectionLabel>
            <SectionTitle className="mt-4">Go live in days, not months</SectionTitle>
          </div>
        </Reveal>
        <div className="mt-14 grid gap-8 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <Reveal key={s.step} delay={i * 120}>
              <div className="relative text-center">
                {i < STEPS.length - 1 && (
                  <div className="absolute left-[calc(50%+3rem)] top-10 hidden h-px w-[calc(100%-6rem)] bg-gradient-to-r from-school-border to-transparent md:block" />
                )}
                <div
                  className={`mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br ${s.gradient} text-white shadow-soft-lg`}
                >
                  <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    {s.icon}
                  </svg>
                </div>
                <p className="mt-4 font-display text-xs font-bold uppercase tracking-widest text-school-royal">{s.step}</p>
                <h3 className="mt-2 font-display text-lg font-semibold text-school-navy dark:text-school-text">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-school-muted">{s.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
