import { useRouter } from 'next/router'

import type { ReactNode } from 'react'

import Navbar from '../public/Navbar'

import SiteFooter from '../public/SiteFooter'

import { SectionLabel, SectionTitle } from '../public/Brand'

import { SkipLink } from '../ui'



type PublicLayoutProps = {

  title: string

  subtitle?: string

  children: ReactNode

  noHero?: boolean

  overlayNav?: boolean

  fullWidth?: boolean

}



export default function PublicLayout({ title, subtitle, children, noHero, overlayNav, fullWidth }: PublicLayoutProps) {

  const router = useRouter()

  const isHome = router.pathname === '/'

  const navOverlay = overlayNav ?? isHome



  return (

    <div className="flex min-h-screen flex-col overflow-x-hidden bg-school-bg font-sans text-school-text">

      <SkipLink />

      <Navbar overlay={navOverlay} />



      {!noHero && (

        <section className="relative overflow-hidden bg-school-navy text-white" aria-labelledby="page-hero-title">

          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_30%_20%,rgba(245,179,1,0.1),transparent_55%)]" />

          <div className="container-school relative py-14 sm:py-20">

            <SectionLabel light>{title ? 'SchoolPilot' : ''}</SectionLabel>

            <SectionTitle light className="mt-4 max-w-3xl" id="page-hero-title">

              {title}

            </SectionTitle>

            {subtitle && (

              <p className="mt-4 max-w-2xl text-base leading-relaxed text-slate-300 sm:text-lg">{subtitle}</p>

            )}

          </div>

          <div className="h-px bg-gradient-to-r from-transparent via-school-gold/50 to-transparent" />

        </section>

      )}



      <main

        id="main-content"

        tabIndex={-1}

        className={fullWidth ? 'flex-1' : `container-school flex-1 ${noHero ? 'pb-12 pt-6 sm:pb-16 sm:pt-8' : 'py-12 sm:py-16'}`}

      >

        {children}

      </main>



      <SiteFooter />

    </div>

  )

}

