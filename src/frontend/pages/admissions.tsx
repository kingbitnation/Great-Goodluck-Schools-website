import Link from 'next/link'
import PublicCmsPage from '../components/public/PublicCmsPage'
import Reveal from '../components/public/Reveal'

export default function AdmissionsPage() {
  return (
    <PublicCmsPage slug="admissions" fallbackTitle="Admissions" fallbackSubtitle="Join our learning community">
      {(page) => (
        <>
          <Reveal>
            <p className="max-w-2xl text-slate-600">{(page.body.paragraphs || []).join(' ')}</p>
          </Reveal>

          {page.body.highlight && (
            <Reveal delay={80}>
              <div className="mt-8 rounded-3xl border border-school-gold/30 bg-school-gold/10 p-7">
                <p className="font-display text-xl font-semibold text-school-navy">{page.body.highlight.title}</p>
                <p className="mt-2 text-sm text-slate-600">{page.body.highlight.desc}</p>
                <Link href="/apply" className="btn-gold mt-5 inline-flex">Apply Online</Link>
                <Link href="/application/status" className="ml-4 mt-5 inline-flex text-sm font-medium text-school-navy underline">
                  Track application
                </Link>
              </div>
            </Reveal>
          )}

          {page.body.requirements && (
            <Reveal delay={120}>
              <h2 className="mt-12 font-display text-xl font-semibold text-school-navy">Requirements</h2>
              <ul className="mt-5 space-y-3">
                {page.body.requirements.map((r) => (
                  <li key={r} className="flex gap-3 text-slate-700">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-school-gold/20 text-xs font-bold text-amber-800">✓</span>
                    {r}
                  </li>
                ))}
              </ul>
            </Reveal>
          )}
        </>
      )}
    </PublicCmsPage>
  )
}
