import { SectionLabel, SectionTitle } from './Brand'

const STEPS = [
  {
    step: '01',
    title: 'Register your school',
    desc: 'Choose a plan, add your school details, and upload verification documents.',
    color: 'bg-school-royal text-white',
  },
  {
    step: '02',
    title: 'Onboard your team',
    desc: 'Import classes, invite teachers, and give parents and students portal access.',
    color: 'bg-school-gold text-school-navy',
  },
  {
    step: '03',
    title: 'Run term operations',
    desc: 'Collect fees, run CBT, publish results, and manage payroll from one dashboard.',
    color: 'bg-school-green text-white',
  },
]

export default function HowItWorks() {
  return (
    <section className="section-pad border-y-4 border-school-royal/20 bg-school-navy text-white">
      <div className="container-school">
        <div className="max-w-xl">
          <SectionLabel light>How it works</SectionLabel>
          <SectionTitle light className="mt-4">Go live in days, not months</SectionTitle>
        </div>

        <ol className="mt-10 grid gap-6 md:grid-cols-3">
          {STEPS.map((s) => (
            <li
              key={s.step}
              className="card-energy rounded-card border border-white/10 bg-white/5 p-6 backdrop-blur-sm"
            >
              <span className={`inline-flex h-10 w-10 items-center justify-center rounded-xl font-display text-sm font-bold ${s.color}`}>
                {s.step}
              </span>
              <h3 className="mt-4 font-display text-lg font-bold">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-300">{s.desc}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
