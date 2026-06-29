import { SectionLabel, SectionTitle } from './Brand'

const PILLARS = [
  {
    title: 'Fees that actually get paid',
    desc: 'Online payments, receipts, reminders, and bursar dashboards — parents see what they owe without calling the office.',
  },
  {
    title: 'Results without the chaos',
    desc: 'Broadsheet generation, portal publishing, and parent access on release day. No more printing and re-printing.',
  },
  {
    title: 'Staff tools teachers will use',
    desc: 'Attendance, grading, CBT, lesson plans, and messaging in one place — not another app they ignore after week one.',
  },
]

export default function SchoolProof() {
  return (
    <section className="section-pad bg-school-surface">
      <div className="container-school">
        <div className="max-w-2xl">
          <SectionLabel>Why schools switch</SectionLabel>
          <SectionTitle className="mt-4">Less admin noise. More time for learning.</SectionTitle>
          <p className="mt-4 text-school-muted">
            SchoolPilot is designed around the real pain points proprietors deal with every term — not generic SaaS fluff.
          </p>
        </div>

        <div className="mt-10 grid gap-5 lg:grid-cols-3">
          {PILLARS.map((item, i) => (
            <article
              key={item.title}
              className="rounded-card border border-school-border/70 bg-school-bg p-6 sm:p-7"
            >
              <span className="font-display text-4xl font-bold leading-none text-school-royal/20">
                {String(i + 1).padStart(2, '0')}
              </span>
              <h3 className="mt-4 font-display text-lg font-semibold text-school-navy dark:text-school-text">
                {item.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-school-muted">{item.desc}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
