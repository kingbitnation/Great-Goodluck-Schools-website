import Reveal from './Reveal'
import { SectionLabel, SectionTitle } from './Brand'

const TESTIMONIALS = [
  {
    quote: 'We moved from spreadsheets to SchoolPilot in two weeks. Parents pay fees online and results go live the same day.',
    name: 'Mrs. Adeyemi',
    role: 'Proprietor, Lagos',
    initials: 'MA',
    accent: 'from-blue-500 to-indigo-600',
  },
  {
    quote: 'CBT, attendance, and payroll in one place — our teachers actually use it every morning.',
    name: 'Mr. Chukwu',
    role: 'School Admin, Abuja',
    initials: 'MC',
    accent: 'from-amber-500 to-orange-600',
  },
  {
    quote: 'The parent portal cut our phone calls in half. Fee reminders and report cards are automatic now.',
    name: 'Mrs. Okonkwo',
    role: 'Bursar, Port Harcourt',
    initials: 'MO',
    accent: 'from-emerald-500 to-teal-600',
  },
]

export default function Testimonials() {
  return (
    <section className="section-pad mesh-bg">
      <div className="container-school">
        <Reveal>
          <div className="text-center">
            <SectionLabel>Loved by schools</SectionLabel>
            <SectionTitle className="mt-4">What administrators say</SectionTitle>
          </div>
        </Reveal>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {TESTIMONIALS.map((t, i) => (
            <Reveal key={t.name} delay={i * 100}>
              <blockquote className="content-card relative h-full p-6 sm:p-8">
                <div className={`absolute -top-3 left-6 h-1 w-12 rounded-full bg-gradient-to-r ${t.accent}`} />
                <p className="text-sm leading-relaxed text-school-muted">&ldquo;{t.quote}&rdquo;</p>
                <footer className="mt-6 flex items-center gap-3">
                  <div
                    className={`flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br ${t.accent} text-sm font-bold text-white`}
                  >
                    {t.initials}
                  </div>
                  <div>
                    <p className="font-semibold text-school-navy dark:text-school-text">{t.name}</p>
                    <p className="text-xs text-school-muted">{t.role}</p>
                  </div>
                </footer>
              </blockquote>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
