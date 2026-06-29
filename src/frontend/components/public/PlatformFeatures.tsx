import Link from 'next/link'
import { SectionLabel, SectionTitle } from './Brand'

const CATEGORIES = [
  {
    title: 'Academics',
    accent: 'border-school-royal bg-school-royal/5',
    dot: 'bg-school-royal',
    items: ['Results & broadsheets', 'CBT exams', 'LMS & video lessons', 'Assignments', 'Timetable', 'Live classes', 'Certificates & QR verify'],
  },
  {
    title: 'Finance',
    accent: 'border-school-gold bg-school-gold/5',
    dot: 'bg-school-gold',
    items: ['Fee management', 'Online payments', 'Manual payment verify', 'Receipts', 'Fee adjustments', 'Revenue analytics'],
  },
  {
    title: 'People',
    accent: 'border-school-green bg-school-green/5',
    dot: 'bg-school-green',
    items: ['Student portal', 'Parent portal', 'Teacher portal', 'Attendance', 'ID cards', 'Admissions CRM', 'Alumni network'],
  },
  {
    title: 'Operations',
    accent: 'border-violet-500 bg-violet-500/5',
    dot: 'bg-violet-500',
    items: ['Library', 'Hostel', 'Transport & GPS', 'Biometrics', 'School shop', 'Internal messaging'],
  },
  {
    title: 'HR & Payroll',
    accent: 'border-orange-500 bg-orange-500/5',
    dot: 'bg-orange-500',
    items: ['HR dashboard', 'Job postings', 'Leave management', 'Payroll runs', 'Payslips', 'Salary grades'],
  },
  {
    title: 'AI & Intelligence',
    accent: 'border-cyan-500 bg-cyan-500/5',
    dot: 'bg-cyan-500',
    items: ['AI tutor', 'AI exam generator', 'AI marking', 'AI lesson plans', 'Parent AI summaries', 'Usage & credits'],
  },
]

export default function PlatformFeatures() {
  return (
    <section className="energy-band section-pad">
      <div className="container-school">
        <div className="flex flex-col items-start justify-between gap-6 lg:flex-row lg:items-end">
          <div className="max-w-2xl">
            <SectionLabel>Full platform</SectionLabel>
            <SectionTitle className="mt-4">Everything your school runs on — in one place</SectionTitle>
            <p className="mt-4 text-school-muted">
              40+ capabilities across academics, finance, operations, and AI. No bolt-ons. No juggling five different tools.
            </p>
          </div>
          <Link href="/pricing" className="btn-royal shrink-0">
            See plans & pricing
          </Link>
        </div>

        <div className="mt-12 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {CATEGORIES.map((cat) => (
            <article
              key={cat.title}
              className={`card-energy rounded-card border-l-4 ${cat.accent} p-6`}
            >
              <div className="flex items-center gap-2">
                <span className={`h-2.5 w-2.5 rounded-full ${cat.dot}`} />
                <h3 className="font-display text-lg font-bold text-school-navy dark:text-school-text">
                  {cat.title}
                </h3>
              </div>
              <ul className="mt-4 space-y-2">
                {cat.items.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-school-muted">
                    <svg className="mt-0.5 h-4 w-4 shrink-0 text-school-green" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    {item}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
