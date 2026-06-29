import { SectionLabel, SectionTitle } from './Brand'

const PILLARS = [
  {
    title: 'Fees that command respect',
    desc: 'Parents pay online. Bursars reconcile in real time. Receipts land instantly. No more chasing cash at the gate.',
    accent: 'from-school-gold/80 to-amber-600/40',
  },
  {
    title: 'Results on your terms',
    desc: 'Broadsheet to portal in one flow. Release day becomes a moment — not a meltdown of phone calls and print runs.',
    accent: 'from-school-royal/80 to-blue-600/40',
  },
  {
    title: 'Tools teachers actually trust',
    desc: 'Attendance, CBT, grading, and AI marking in one cockpit. Built for the pace of a real Nigerian school day.',
    accent: 'from-school-green/80 to-emerald-600/40',
  },
]

export default function SchoolProof() {
  return (
    <section className="section-pad exclusive-dark relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-noise opacity-20" />
      <div className="container-school relative">
        <div className="max-w-2xl">
          <SectionLabel light>The standard</SectionLabel>
          <SectionTitle light className="mt-4">
            Built different.{' '}
            <span className="font-serif font-normal italic text-school-gold">On purpose.</span>
          </SectionTitle>
        </div>

        <div className="mt-12 grid gap-6 lg:grid-cols-3">
          {PILLARS.map((item, i) => (
            <article
              key={item.title}
              className="card-luxury group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-7 backdrop-blur-sm"
            >
              <div className={`absolute inset-x-0 top-0 h-px bg-gradient-to-r ${item.accent}`} />
              <span className="font-display text-5xl font-black text-white/[0.06]">
                {String(i + 1).padStart(2, '0')}
              </span>
              <h3 className="mt-4 font-display text-xl font-bold text-white">{item.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-slate-400">{item.desc}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
