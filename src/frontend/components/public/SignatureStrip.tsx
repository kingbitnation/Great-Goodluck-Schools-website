const ITEMS = [
  'Fees & Bursary',
  'CBT Exams',
  'LMS',
  'Payroll',
  'Biometrics',
  'AI Suite',
  'Parent Portal',
  'Live Classes',
  'School Shop',
  'Transport GPS',
  'Results',
  'Admissions CRM',
]

export default function SignatureStrip() {
  const track = [...ITEMS, ...ITEMS]

  return (
    <div className="exclusive-strip overflow-hidden border-y border-school-gold/20 bg-[#071528] py-4">
      <div className="marquee-track flex w-max items-center gap-10">
        {track.map((label, i) => (
          <span key={`${label}-${i}`} className="flex shrink-0 items-center gap-10">
            <span className="font-display text-xs font-bold uppercase tracking-[0.35em] text-school-gold/90">
              {label}
            </span>
            <span className="h-1 w-1 rounded-full bg-school-gold/50" aria-hidden />
          </span>
        ))}
      </div>
    </div>
  )
}
