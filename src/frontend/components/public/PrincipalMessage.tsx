import { SectionLabel, SectionTitle } from './Brand'
import type { PublicPageBody } from '../../lib/publicApi'

type PrincipalMessageProps = {
  data?: PublicPageBody['principal'] | null
}

const DEFAULT = {
  name: 'King Bit',
  title: 'Founder, SchoolPilot',
  initials: 'KB',
  paragraphs: [
    'We built SchoolPilot because running a school in Nigeria should not mean drowning in spreadsheets, late fee follow-ups, and parents calling every results season.',
    'This platform is for proprietors who want one serious system — fees, exams, attendance, payroll, and parent communication — without stitching five different tools together.',
  ],
}

function normalizePrincipal(data?: PublicPageBody['principal'] | null) {
  if (!data) return DEFAULT
  const name = data.name?.includes('Adaeze') || data.name?.includes('Okonkwo') ? 'King Bit' : data.name
  return {
    ...data,
    name: name || DEFAULT.name,
    title: data.title || DEFAULT.title,
    initials: name === 'King Bit' ? 'KB' : (data.initials || DEFAULT.initials),
    paragraphs: data.paragraphs?.length ? data.paragraphs : DEFAULT.paragraphs,
  }
}

export default function PrincipalMessage({ data }: PrincipalMessageProps) {
  const founder = normalizePrincipal(data)

  return (
    <section className="section-pad border-t border-school-border/60 bg-school-bg">
      <div className="container-school">
        <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] lg:gap-16">
          <div className="relative order-2 lg:order-1">
            <div className="absolute -left-3 top-6 hidden h-24 w-1 rounded-full bg-school-gold lg:block" />
            <SectionLabel>From the founder</SectionLabel>
            <SectionTitle className="mt-4 text-school-navy dark:text-school-text">
              A Message of Welcome
            </SectionTitle>
            <div className="mt-6 space-y-4 text-base leading-relaxed text-school-muted">
              {founder.paragraphs.map((p) => (
                <p key={p.slice(0, 48)}>{p}</p>
              ))}
            </div>
            <p className="mt-8 font-display text-lg font-semibold text-school-navy dark:text-school-text">
              — {founder.name}
              <span className="mt-0.5 block text-sm font-normal text-school-muted">{founder.title}</span>
            </p>
          </div>

          <div className="order-1 lg:order-2">
            <div className="relative overflow-hidden rounded-3xl border border-school-border/80 bg-school-navy shadow-soft-lg">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(245,158,11,0.18),transparent_55%)]" />
              <div className="relative flex min-h-[320px] flex-col justify-between p-8 sm:p-10">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-school-gold">SchoolPilot</p>
                  <p className="mt-6 font-display text-3xl font-bold leading-snug text-white sm:text-4xl">
                    &ldquo;Education deserves software that actually works.&rdquo;
                  </p>
                </div>
                <div className="mt-10 flex items-center gap-4 border-t border-white/10 pt-8">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-school-gold font-display text-xl font-bold text-school-navy">
                    {founder.initials}
                  </div>
                  <div>
                    <p className="font-display text-lg font-bold text-white">{founder.name}</p>
                    <p className="text-sm text-slate-300">{founder.title}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
