import Reveal from './Reveal'
import { SectionLabel, SectionTitle } from './Brand'
import type { PublicPageBody } from '../../lib/publicApi'

type PrincipalMessageProps = {
  data?: PublicPageBody['principal'] | null
}

export default function PrincipalMessage({ data }: PrincipalMessageProps) {
  const principal = data || {
    name: 'Dr. Adaeze Okonkwo',
    title: 'Principal',
    initials: 'DA',
    paragraphs: [
      'Welcome to SchoolPilot — a place where every child is seen, valued, and challenged to reach their fullest potential.',
      'Our commitment goes beyond the classroom. With modern facilities, dedicated teachers, and a digital learning platform, we prepare students for life.',
    ],
  }

  return (
    <section className="section-pad bg-white">
      <div className="container-school">
        <Reveal>
          <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
            <div className="relative">
              <div className="absolute -inset-3 rounded-3xl bg-gradient-to-br from-school-gold/20 to-transparent" />
              <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-school-navy to-[#142d5c] shadow-soft-lg">
                <div className="flex aspect-[4/5] max-h-[480px] flex-col items-center justify-end p-8 sm:aspect-auto sm:min-h-[420px]">
                  <div className="flex h-28 w-28 items-center justify-center rounded-full bg-school-gold/20 text-4xl font-bold text-school-gold ring-4 ring-school-gold/30">
                    {principal.initials}
                  </div>
                  <p className="mt-5 font-display text-xl font-bold text-white">{principal.name}</p>
                  <p className="text-sm text-school-gold">{principal.title}</p>
                </div>
              </div>
            </div>

            <div>
              <SectionLabel>From the Principal</SectionLabel>
              <SectionTitle className="mt-4">A Message of Welcome</SectionTitle>
              <div className="mt-6 space-y-4 text-slate-600 leading-relaxed">
                {principal.paragraphs.map((p) => (
                  <p key={p.slice(0, 40)}>{p}</p>
                ))}
              </div>
              <p className="mt-6 font-display text-lg font-semibold italic text-school-navy">
                — {principal.name}, {principal.title}
              </p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
