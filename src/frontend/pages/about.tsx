import Link from 'next/link'
import PublicCmsPage from '../components/public/PublicCmsPage'
import Reveal from '../components/public/Reveal'
import { SectionLabel, SectionTitle } from '../components/public/Brand'

export default function AboutPage() {
  return (
    <PublicCmsPage slug="about" fallbackTitle="About Us" fallbackSubtitle="A legacy of excellence">
      {(page) => (
        <>
          <Reveal>
            <p className="max-w-3xl text-lg leading-relaxed text-school-muted">
              {(page.body.paragraphs || []).join(' ')}
            </p>
          </Reveal>

          {page.body.values && (
            <div className="mt-12 grid gap-5 sm:grid-cols-3">
              {page.body.values.map((v, i) => (
                <Reveal key={v.title} delay={i * 80}>
                  <div className="content-card h-full p-6">
                    <h3 className="font-display font-semibold text-school-navy">{v.title}</h3>
                    <p className="mt-2 text-sm text-school-muted">{v.desc}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          )}

          <div className="mt-12 grid gap-5 sm:grid-cols-2">
            {page.body.vision && (
              <Reveal>
                <div className="rounded-3xl bg-school-navy p-8 text-white">
                  <SectionLabel light>Vision</SectionLabel>
                  <p className="mt-4 leading-relaxed text-slate-300">{page.body.vision}</p>
                </div>
              </Reveal>
            )}
            {page.body.mission && (
              <Reveal delay={100}>
                <div className="rounded-3xl bg-school-gold p-8 text-school-navy">
                  <p className="text-xs font-bold uppercase tracking-widest opacity-70">Mission</p>
                  <p className="mt-4 font-medium leading-relaxed">{page.body.mission}</p>
                </div>
              </Reveal>
            )}
          </div>

          <Reveal>
            <Link href="/apply" className="btn-gold mt-10 inline-flex">Apply Now</Link>
          </Reveal>
        </>
      )}
    </PublicCmsPage>
  )
}
