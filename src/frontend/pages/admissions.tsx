import Link from 'next/link'
import PublicCmsPage from '../components/public/PublicCmsPage'
import Reveal from '../components/public/Reveal'

const ADMISSION_STEPS = [
  { step: '1', title: 'Apply online', desc: 'Complete the application form with student and parent details.' },
  { step: '2', title: 'Submit documents', desc: 'Upload birth certificate, photos, and previous school records.' },
  { step: '3', title: 'Assessment', desc: 'Attend entrance test or interview where required for your year group.' },
  { step: '4', title: 'Offer & enrolment', desc: 'Receive admission decision, pay fees, and collect portal credentials.' },
]

export default function AdmissionsPage() {
  return (
    <PublicCmsPage slug="admissions" fallbackTitle="Admissions" fallbackSubtitle="Join our learning community">
      {(page) => (
        <>
          <Reveal>
            <div className="max-w-2xl space-y-4 text-base leading-relaxed text-school-muted">
              {(page.body.paragraphs || []).map((p) => (
                <p key={p.slice(0, 40)}>{p}</p>
              ))}
            </div>
          </Reveal>

          {page.body.highlight && (
            <Reveal delay={80}>
              <div className="mt-8 rounded-3xl border border-school-gold/30 bg-school-gold/10 p-7 sm:p-8">
                <p className="font-display text-xl font-semibold text-slate-900 dark:text-white">{page.body.highlight.title}</p>
                <p className="mt-2 text-sm text-school-muted">{page.body.highlight.desc}</p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Link href="/apply" className="btn-gold inline-flex">
                    Apply online
                  </Link>
                  <Link href="/application/status" className="inline-flex items-center text-sm font-semibold text-school-royal hover:underline">
                    Track application →
                  </Link>
                </div>
              </div>
            </Reveal>
          )}

          <Reveal delay={100}>
            <h2 className="mt-12 font-display text-xl font-bold text-slate-900 dark:text-white">How to apply</h2>
            <ol className="mt-6 grid gap-4 sm:grid-cols-2">
              {ADMISSION_STEPS.map((s, i) => (
                <li key={s.step} className="content-card flex gap-4 p-5">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-school-navy text-sm font-bold text-white">
                    {s.step}
                  </span>
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-white">{s.title}</p>
                    <p className="mt-1 text-sm text-school-muted">{s.desc}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Reveal>

          {page.body.requirements && page.body.requirements.length > 0 && (
            <Reveal delay={140}>
              <h2 className="mt-12 font-display text-xl font-bold text-slate-900 dark:text-white">Required documents</h2>
              <ul className="mt-5 space-y-3">
                {page.body.requirements.map((r) => (
                  <li key={r} className="flex gap-3 text-slate-700 dark:text-slate-200">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-school-gold/20 text-xs font-bold text-amber-800 dark:text-school-gold">
                      ✓
                    </span>
                    {r}
                  </li>
                ))}
              </ul>
            </Reveal>
          )}

          <Reveal delay={180}>
            <div className="mt-12 rounded-3xl bg-school-navy px-8 py-8 text-white">
              <p className="font-display text-lg font-semibold">Questions about admission?</p>
              <p className="mt-2 text-sm text-slate-300">Our admissions office is happy to help with year-group availability and the application process.</p>
              <Link href="/contact" className="btn-gold mt-5 inline-flex">
                Contact admissions
              </Link>
            </div>
          </Reveal>
        </>
      )}
    </PublicCmsPage>
  )
}
