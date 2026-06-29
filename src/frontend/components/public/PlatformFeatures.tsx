import Link from 'next/link'
import { SectionLabel, SectionTitle } from './Brand'

const CATEGORIES = [
  {
    title: 'Academics',
    accent: 'text-school-royal',
    line: 'from-school-royal to-blue-400',
    items: ['Results & broadsheets', 'CBT exams', 'LMS & video lessons', 'Assignments', 'Timetable', 'Live classes', 'Certificates & QR verify'],
  },
  {
    title: 'Finance',
    accent: 'text-school-gold',
    line: 'from-school-gold to-amber-300',
    items: ['Fee management', 'Online payments', 'Manual payment verify', 'Receipts', 'Fee adjustments', 'Revenue analytics'],
  },
  {
    title: 'People',
    accent: 'text-school-green',
    line: 'from-school-green to-emerald-300',
    items: ['Student portal', 'Parent portal', 'Teacher portal', 'Attendance', 'ID cards', 'Admissions CRM', 'Alumni network'],
  },
  {
    title: 'Operations',
    accent: 'text-violet-400',
    line: 'from-violet-500 to-purple-300',
    items: ['Library', 'Hostel', 'Transport & GPS', 'Biometrics', 'School shop', 'Internal messaging'],
  },
  {
    title: 'HR & Payroll',
    accent: 'text-orange-400',
    line: 'from-orange-500 to-amber-400',
    items: ['HR dashboard', 'Job postings', 'Leave management', 'Payroll runs', 'Payslips', 'Salary grades'],
  },
  {
    title: 'AI & Intelligence',
    accent: 'text-cyan-400',
    line: 'from-cyan-400 to-blue-300',
    items: ['AI tutor', 'AI exam generator', 'AI marking', 'AI lesson plans', 'Parent AI summaries', 'Usage & credits'],
  },
]

export default function PlatformFeatures() {
  return (
    <section className="section-pad bg-school-bg">
      <div className="container-school">
        <div className="flex flex-col items-start justify-between gap-6 border-b border-school-border/60 pb-10 lg:flex-row lg:items-end">
          <div className="max-w-2xl">
            <SectionLabel>Full arsenal</SectionLabel>
            <SectionTitle className="mt-4">
              Every module.{' '}
              <span className="font-serif italic text-school-royal">One throne.</span>
            </SectionTitle>
            <p className="mt-4 text-school-muted">
              40+ capabilities — no Frankenstein integrations. This is the complete operating system.
            </p>
          </div>
          <Link href="/pricing" className="btn-exclusive-dark shrink-0">
            Unlock pricing
          </Link>
        </div>

        <div className="mt-12 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {CATEGORIES.map((cat) => (
            <article
              key={cat.title}
              className="card-luxury-light group rounded-2xl border border-school-border/80 bg-school-surface p-6 shadow-soft"
            >
              <div className={`mb-4 h-0.5 w-12 bg-gradient-to-r ${cat.line}`} />
              <h3 className={`font-display text-lg font-bold ${cat.accent}`}>{cat.title}</h3>
              <ul className="mt-4 space-y-2.5">
                {cat.items.map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-sm text-school-muted">
                    <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-school-gold" />
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
