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
    <section className="section-pad relative overflow-hidden bg-[#050d1a]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_30%_50%,rgba(245,158,11,0.08),transparent_60%)]" />
      <div className="container-school relative">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
          <div>
            <SectionLabel light>From the founder</SectionLabel>
            <SectionTitle light className="mt-4">
              A Message of Welcome
            </SectionTitle>
            <div className="mt-8 space-y-5 text-base leading-relaxed text-slate-400">
              {founder.paragraphs.map((p) => (
                <p key={p.slice(0, 48)}>{p}</p>
              ))}
            </div>
            <div className="mt-10 flex items-center gap-4 border-t border-white/10 pt-8">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-school-gold to-amber-600 font-display text-lg font-bold text-school-navy shadow-glow">
                {founder.initials}
              </div>
              <div>
                <p className="font-display text-lg font-bold text-white">{founder.name}</p>
                <p className="text-sm text-school-gold">{founder.title}</p>
              </div>
            </div>
          </div>

          <div className="relative">
            <div className="absolute -inset-1 rounded-3xl bg-gradient-to-br from-school-gold/30 via-school-royal/20 to-transparent blur-sm" />
            <blockquote className="card-luxury relative rounded-3xl border border-white/10 bg-white/[0.04] p-8 backdrop-blur-md sm:p-10">
              <p className="text-xs font-bold uppercase tracking-[0.3em] text-school-gold">SchoolPilot</p>
              <p className="font-serif mt-6 text-3xl italic leading-snug text-white sm:text-4xl">
                &ldquo;Education deserves software that actually works — and proprietors deserve
                software that respects them.&rdquo;
              </p>
              <footer className="mt-8 text-sm text-slate-500">— {founder.name}</footer>
            </blockquote>
          </div>
        </div>
      </div>
    </section>
  )
}
