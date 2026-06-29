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
    'SchoolPilot was built to solve a real problem: schools juggling fees in one app, results in another, and parent updates on WhatsApp.',
    'We designed one platform so administrators, teachers, students, and parents work from the same source of truth — with tools that fit how Nigerian schools actually operate.',
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
    <section className="section-pad bg-slate-50 dark:bg-school-surface">
      <div className="container-school">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <SectionLabel>Leadership</SectionLabel>
            <SectionTitle className="mt-4">Why we built SchoolPilot</SectionTitle>
            <div className="mt-6 space-y-4 text-base leading-relaxed text-school-muted">
              {founder.paragraphs.map((p) => (
                <p key={p.slice(0, 48)}>{p}</p>
              ))}
            </div>
            <div className="mt-8 flex items-center gap-4 border-t border-school-border pt-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-school-royal font-display text-sm font-bold text-white">
                {founder.initials}
              </div>
              <div>
                <p className="font-semibold text-school-navy dark:text-school-text">{founder.name}</p>
                <p className="text-sm text-school-muted">{founder.title}</p>
              </div>
            </div>
          </div>
          <blockquote className="rounded-2xl border border-school-border bg-white p-8 shadow-soft dark:bg-school-surface">
            <p className="text-lg leading-relaxed text-school-navy dark:text-school-text">
              &ldquo;Schools deserve software that is reliable, affordable, and built with their daily workflow in mind — not copied from foreign systems.&rdquo;
            </p>
            <footer className="mt-4 text-sm text-school-muted">— {founder.name}</footer>
          </blockquote>
        </div>
      </div>
    </section>
  )
}
