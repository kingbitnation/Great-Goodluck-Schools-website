import Link from 'next/link'
import { useEffect, useState } from 'react'
import PublicLayout from '../components/layout/PublicLayout'
import Seo from '../components/Seo'
import Hero from '../components/public/Hero'
import StatsSection from '../components/public/StatsSection'
import ContentCard from '../components/public/ContentCard'
import PrincipalMessage from '../components/public/PrincipalMessage'
import Reveal from '../components/public/Reveal'
import { SectionLabel, SectionTitle } from '../components/public/Brand'
import { fetchPublic, type HomeData, type PublicPost, type PublicEvent } from '../lib/publicApi'

const FALLBACK_FEATURES = [
  { title: 'Digital Portal', desc: 'Results, fees, CBT, and LMS in one secure platform.' },
  { title: 'Expert Faculty', desc: '80+ qualified teachers dedicated to every student.' },
  { title: 'Modern Facilities', desc: 'Science labs, library, sports, and ICT centres.' },
  { title: 'Moral Education', desc: 'Character development woven into daily school life.' },
]

function CardImage({ emoji }: { emoji: string }) {
  return (
    <div className="flex h-40 items-center justify-center text-5xl">{emoji}</div>
  )
}

function badgeVariant(badge?: string | null): 'new' | 'gold' | 'navy' {
  if (badge === 'Important') return 'gold'
  if (badge === 'Update') return 'navy'
  return 'new'
}

export default function Home() {
  const [home, setHome] = useState<HomeData | null>(null)

  useEffect(() => {
    fetchPublic<HomeData>('/api/public/home')
      .then(setHome)
      .catch(() => {})
  }, [])

  const features = home?.features?.length ? home.features : FALLBACK_FEATURES
  const news = home?.featuredNews || []
  const events = home?.featuredEvents || []

  return (
    <>
      <Seo
        title="Home"
        description="SchoolPilot — navigating education, empowering futures. Multi-school ERP, LMS, CBT, and AI platform."
        path="/"
      />
      <PublicLayout title="" subtitle="" noHero fullWidth>
      <Hero />
      <StatsSection stats={home?.stats} />

      <section className="section-pad">
        <div className="container-school">
          <Reveal>
            <div className="text-center">
              <SectionLabel>Why SchoolPilot</SectionLabel>
              <SectionTitle className="mt-4">Everything Your School Needs</SectionTitle>
              <p className="mx-auto mt-4 max-w-2xl text-school-muted">
                From attendance to AI tutoring — one platform for students, parents, teachers, and administrators.
              </p>
            </div>
          </Reveal>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((f, i) => (
              <Reveal key={f.title} delay={i * 80}>
                <div className="glass-card h-full p-6 transition duration-300 hover:-translate-y-1 hover:shadow-soft-lg">
                  <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-school-royal/10 text-school-royal">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h3 className="font-display font-semibold text-school-navy">{f.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-school-muted">{f.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="section-pad bg-white">
        <div className="container-school">
          <Reveal>
            <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
              <div>
                <SectionLabel>Latest News</SectionLabel>
                <SectionTitle className="mt-4">School Announcements</SectionTitle>
              </div>
              <Link href="/news" className="text-sm font-semibold text-school-navy hover:text-school-gold">View all news →</Link>
            </div>
          </Reveal>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {news.length === 0 ? (
              <p className="text-slate-500 col-span-full">No announcements yet.</p>
            ) : (
              news.map((n: PublicPost, i) => (
                <Reveal key={n.id} delay={i * 100}>
                  <ContentCard
                    href={`/blog/${n.slug}`}
                    badge={n.badge || 'News'}
                    badgeVariant={badgeVariant(n.badge)}
                    title={n.title}
                    excerpt={n.excerpt || ''}
                    meta={new Date(n.publishedAt).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })}
                    image={<CardImage emoji={n.icon || '📢'} />}
                  />
                </Reveal>
              ))
            )}
          </div>
        </div>
      </section>

      <section className="section-pad">
        <div className="container-school">
          <Reveal>
            <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
              <div>
                <SectionLabel>Upcoming Events</SectionLabel>
                <SectionTitle className="mt-4">School Calendar</SectionTitle>
              </div>
              <Link href="/events" className="text-sm font-semibold text-school-navy hover:text-school-gold">Full calendar →</Link>
            </div>
          </Reveal>
          <div className="mt-10 grid gap-5 sm:grid-cols-2">
            {events.length === 0 ? (
              <p className="text-slate-500">No upcoming events.</p>
            ) : (
              events.map((e: PublicEvent, i) => (
                <Reveal key={e.id} delay={i * 80}>
                  <article className="content-card flex gap-5 p-5 sm:p-6">
                    <div className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-2xl bg-school-navy text-center text-white">
                      <span className="text-xs font-bold uppercase text-school-gold">{e.monthShort}</span>
                      <span className="font-display text-xl font-bold leading-none">{e.dayNum}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="badge-gold">{e.badge}</span>
                      <h3 className="mt-2 font-display font-semibold text-school-navy">{e.title}</h3>
                      <p className="mt-1 text-sm text-slate-500">{e.venue}</p>
                    </div>
                  </article>
                </Reveal>
              ))
            )}
          </div>
        </div>
      </section>

      <PrincipalMessage data={home?.principal?.body?.principal} />

      <section className="section-pad bg-school-navy">
        <div className="container-school">
          <Reveal>
            <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-center backdrop-blur-sm sm:p-14">
              <SectionTitle light className="text-balance">Ready to join {home?.school?.name || 'SchoolPilot'}?</SectionTitle>
              <p className="mx-auto mt-4 max-w-xl text-slate-300">
                Limited spaces for 2025/2026. Apply today and give your child the advantage of a truly world-class education.
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-4">
                <Link href="/apply" className="btn-gold">Apply Online</Link>
                <Link href="/contact" className="btn-outline">Book a School Tour</Link>
              </div>
            </div>
          </Reveal>
        </div>
      </section>
    </PublicLayout>
    </>
  )
}
