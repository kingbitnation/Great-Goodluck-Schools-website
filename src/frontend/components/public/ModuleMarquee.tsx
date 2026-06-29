const MODULES = [
  'Student Portal',
  'Fee Management',
  'CBT Exams',
  'LMS Courses',
  'Payroll',
  'Admissions CRM',
  'School Shop',
  'AI Tutor',
  'Live Classes',
  'Transport',
  'Hostel',
  'Biometrics',
  'Results & Broadsheets',
  'Parent App',
  'Alumni Network',
]

export default function ModuleMarquee() {
  const items = [...MODULES, ...MODULES]

  return (
    <section className="overflow-hidden border-y border-school-border/60 bg-school-surface py-5">
      <div className="marquee-track flex w-max gap-3">
        {items.map((label, i) => (
          <span
            key={`${label}-${i}`}
            className="inline-flex shrink-0 items-center gap-2 rounded-pill border border-school-border bg-school-bg px-4 py-2 text-sm font-medium text-school-navy dark:text-school-text"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-school-royal" aria-hidden />
            {label}
          </span>
        ))}
      </div>
    </section>
  )
}
