import Link from 'next/link'
import PublicCmsPage from '../components/public/PublicCmsPage'
import Reveal from '../components/public/Reveal'

export default function AcademicsPage() {
  return (
    <PublicCmsPage slug="academics" fallbackTitle="Academics" fallbackSubtitle="Programs and curriculum">
      {(page) => (
        <>
          <Reveal>
            <div className="max-w-3xl space-y-4 text-base leading-relaxed text-school-muted sm:text-lg">
              {(page.body.paragraphs || []).map((p) => (
                <p key={p.slice(0, 40)}>{p}</p>
              ))}
            </div>
          </Reveal>

          {page.body.features && page.body.features.length > 0 && (
            <div className="mt-12">
              <h2 className="font-display text-2xl font-bold text-slate-900 dark:text-white">Programs we offer</h2>
              <div className="mt-6 grid gap-5 sm:grid-cols-2">
                {page.body.features.map((f, i) => (
                  <Reveal key={f.title} delay={i * 60}>
                    <div className="content-card h-full border-l-4 border-l-school-royal p-6">
                      <h3 className="font-display font-semibold text-slate-900 dark:text-white">{f.title}</h3>
                      <p className="mt-2 text-sm leading-relaxed text-school-muted">{f.desc}</p>
                    </div>
                  </Reveal>
                ))}
              </div>
            </div>
          )}

          {page.body.bullets && page.body.bullets.length > 0 && (
            <Reveal delay={120}>
              <div className="mt-12 rounded-3xl border border-school-border bg-white p-8 dark:bg-slate-800/50">
                <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white">What students experience</h2>
                <ul className="mt-6 grid gap-3 sm:grid-cols-2">
                  {page.body.bullets.map((b) => (
                    <li key={b} className="flex gap-3 text-sm text-slate-700 dark:text-slate-200">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-school-green/15 text-xs font-bold text-school-green">
                        ✓
                      </span>
                      {b}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          )}

          <Reveal delay={160}>
            <div className="mt-12 flex flex-wrap items-center gap-4 rounded-3xl bg-school-royal/10 px-8 py-7">
              <div className="flex-1 min-w-[200px]">
                <p className="font-display text-lg font-semibold text-slate-900 dark:text-white">Ready to enrol?</p>
                <p className="mt-1 text-sm text-school-muted">View admission requirements and apply online.</p>
              </div>
              <Link href="/admissions" className="btn-royal">
                View admissions
              </Link>
            </div>
          </Reveal>
        </>
      )}
    </PublicCmsPage>
  )
}
