import { SectionLabel, SectionTitle } from './Brand'

const STEPS = [
  {
    step: '01',
    title: 'Register your school',
    desc: 'Choose a plan, add your school details, and upload verification documents.',
  },
  {
    step: '02',
    title: 'Onboard your team',
    desc: 'Import classes, invite teachers, and give parents and students portal access.',
  },
  {
    step: '03',
    title: 'Run term operations',
    desc: 'Collect fees, run CBT, publish results, and manage payroll from one dashboard.',
  },
]

export default function HowItWorks() {
  return (
    <section className="section-pad border-y border-school-border/60 bg-school-bg">
      <div className="container-school">
        <div className="max-w-xl">
          <SectionLabel>How it works</SectionLabel>
          <SectionTitle className="mt-4">Go live in days, not months</SectionTitle>
        </div>

        <ol className="mt-10 grid gap-6 md:grid-cols-3">
          {STEPS.map((s) => (
            <li key={s.step} className="rounded-card border border-school-border/70 bg-school-surface p-6">
              <span className="font-display text-sm font-bold text-school-royal">{s.step}</span>
              <h3 className="mt-3 font-display text-lg font-semibold text-school-navy dark:text-school-text">
                {s.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-school-muted">{s.desc}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
