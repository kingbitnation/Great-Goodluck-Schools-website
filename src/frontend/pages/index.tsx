import Link from 'next/link'
import { useEffect, useState } from 'react'
import PublicLayout from '../components/layout/PublicLayout'
import Seo from '../components/Seo'
import Hero from '../components/public/Hero'
import StatsSection from '../components/public/StatsSection'
import ContentCard from '../components/public/ContentCard'
import PrincipalMessage from '../components/public/PrincipalMessage'
import Reveal from '../components/public/Reveal'
import PlatformFeatures from '../components/public/PlatformFeatures'
import SchoolProof from '../components/public/SchoolProof'
import HowItWorks from '../components/public/HowItWorks'
import { SectionLabel, SectionTitle } from '../components/public/Brand'
import { fetchPublic, type HomeData, type PublicPost, type PublicEvent } from '../lib/publicApi'

const FALLBACK_FEATURES = [
  {
    title: 'Digital Portal',
    desc: 'Results, fees, CBT, and LMS in one secure platform for every role.',
    iconClass: 'feature-icon-blue',
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25" />
    ),
  },
  {
    title: 'Expert Faculty Tools',
    desc: 'Attendance, grading, lesson plans, and AI marking built for busy teachers.',
    iconClass: 'feature-icon-gold',
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342" />
    ),
  },
  {
    title: 'Modern Operations',
    desc: 'Library, hostel, transport, biometrics, and shop — fully integrated.',
    iconClass: 'feature-icon-green',
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" />
    ),
  },
  {
    title: 'AI-Powered Insights',
    desc: 'Smart summaries, exam generation, and tutoring that scale with your school.',
    iconClass: 'feature-icon-violet',
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
    ),
  },
]

const CARD_GRADIENTS = [
  'from-blue-600 via-indigo-700 to-school-navy',
  'from-amber-500 via-orange-600 to-red-700',
  'from-emerald-500 via-teal-600 to-cyan-800',
  'from-violet-600 via-purple-700 to-fuchsia-900',
  'from-rose-500 via-pink-600 to-purple-800',
  'from-school-royal via-blue-700 to-indigo-900',
]

function CardImage({ emoji, index = 0 }: { emoji: string; index?: number }) {
  const gradient = CARD_GRADIENTS[index % CARD_GRADIENTS.length]
  return (
    <div className={`relative flex h-44 items-center justify-center overflow-hidden bg-gradient-to-br ${gradient}`}>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.2),transparent_50%)]" />
      <span className="relative text-6xl drop-shadow-lg">{emoji}</span>
    </div>
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
        <SchoolProof />
        <PlatformFeatures />

        <section className="section-pad bg-white dark:bg-school-surface">
          <div className="container-school">
            <Reveal>
              <div className="text-center">
                <SectionLabel>Why SchoolPilot</SectionLabel>
                <SectionTitle className="mt-4">Built for modern African schools</SectionTitle>
                <p className="mx-auto mt-4 max-w-2xl text-school-muted">
                  Stop juggling spreadsheets and WhatsApp groups. One beautiful platform for academics,
                  finance, operations, and communication.
                </p>
              </div>
            </Reveal>
            <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {(features.length ? features : FALLBACK_FEATURES).map((f, i) => {
                const fallback = FALLBACK_FEATURES[i % FALLBACK_FEATURES.length]
                return (
                  <Reveal key={`${f.title}-${i}`} delay={i * 80}>
                    <div className="card-energy group h-full rounded-card border border-school-border/60 bg-school-surface p-6 shadow-soft hover:border-school-royal/50">
                      <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-2xl ${fallback.iconClass}`}>
                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          {fallback.icon}
                        </svg>
                      </div>
                      <h3 className="font-display font-semibold text-school-navy dark:text-school-text">{f.title}</h3>
                      <p className="mt-2 text-sm leading-relaxed text-school-muted">{f.desc}</p>
                    </div>
                  </Reveal>
                )
              })}
            </div>
          </div>
        </section>

        <HowItWorks />

        <section className="section-pad bg-white dark:bg-school-surface">
          <div className="container-school">
            <Reveal>
              <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
                <div>
                  <SectionLabel>Latest News</SectionLabel>
                  <SectionTitle className="mt-4">School Announcements</SectionTitle>
                </div>
                <Link href="/news" className="text-sm font-semibold text-school-royal hover:text-school-gold">
                  View all news →
                </Link>
              </div>
            </Reveal>
            <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {news.length === 0 ? (
                <p className="col-span-full text-school-muted">No announcements yet.</p>
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
                      image={<CardImage emoji={n.icon || '📢'} index={i} />}
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
                <Link href="/events" className="text-sm font-semibold text-school-royal hover:text-school-gold">
                  Full calendar →
                </Link>
              </div>
            </Reveal>
            <div className="mt-10 grid gap-5 sm:grid-cols-2">
              {events.length === 0 ? (
                <p className="text-school-muted">No upcoming events.</p>
              ) : (
                events.map((e: PublicEvent, i) => (
                  <Reveal key={e.id} delay={i * 80}>
                    <article className="group content-card flex gap-5 p-5 transition hover:border-school-royal/30 sm:p-6">
                      <div className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-2xl bg-gradient-to-br from-school-navy to-school-royal text-center text-white shadow-soft">
                        <span className="text-xs font-bold uppercase text-school-gold">{e.monthShort}</span>
                        <span className="font-display text-xl font-bold leading-none">{e.dayNum}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="badge-gold">{e.badge}</span>
                        <h3 className="mt-2 font-display font-semibold text-school-navy dark:text-school-text group-hover:text-school-royal">
                          {e.title}
                        </h3>
                        <p className="mt-1 text-sm text-school-muted">{e.venue}</p>
                      </div>
                    </article>
                  </Reveal>
                ))
              )}
            </div>
          </div>
        </section>

        <PrincipalMessage data={home?.principal?.body?.principal} />

        <section className="section-pad">
          <div className="container-school">
            <Reveal>
              <div className="relative overflow-hidden rounded-3xl bg-school-navy p-8 text-center sm:p-14">
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(245,158,11,0.2),transparent_50%)]" />
                <div className="relative">
                  <SectionTitle light className="text-balance">
                    Ready to run {home?.school?.name || 'your school'} on SchoolPilot?
                  </SectionTitle>
                  <p className="mx-auto mt-4 max-w-xl text-slate-300">
                    Start your 14-day free trial. No credit card required.
                  </p>
                  <div className="mt-8 flex flex-wrap justify-center gap-4">
                    <Link href="/register-school" className="btn-gold shadow-glow">
                      Get started free
                    </Link>
                    <Link href="/contact" className="btn-outline">
                      Book a demo
                    </Link>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </section>
      </PublicLayout>
    </>
  )
}
