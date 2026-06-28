import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { ThemeToggle } from '../ThemeProvider'
import { SchoolLogo } from './Brand'

const NAV = [
  { href: '/', label: 'Home' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/about', label: 'About' },
  { href: '/academics', label: 'Academics' },
  { href: '/admissions', label: 'Admissions' },
  { href: '/contact', label: 'Contact' },
]

type NavbarProps = {
  overlay?: boolean
}

export default function Navbar({ overlay = false }: NavbarProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 48)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const solid = scrolled || !overlay

  return (
    <header
      className={`sticky top-0 z-50 transition-all duration-300 ${
        solid
          ? 'border-b border-school-border bg-school-surface/95 shadow-soft backdrop-blur-lg'
          : 'border-b border-transparent bg-transparent'
      }`}
    >
      <div className="container-school flex items-center justify-between gap-4 py-3.5">
        <Link href="/" onClick={() => setOpen(false)} className="shrink-0" aria-label="SchoolPilot home">
          <SchoolLogo light={!solid} asLink={false} />
        </Link>

        <nav className="hidden items-center gap-1 lg:flex" aria-label="Primary">
          {NAV.map((item) => {
            const active = router.pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`rounded-xl px-3.5 py-2 text-sm font-medium transition duration-300 ${
                  active
                    ? solid
                      ? 'bg-school-gold/15 text-[#b45309] dark:text-school-gold'
                      : 'bg-white/15 text-school-gold'
                    : solid
                      ? 'text-school-muted hover:bg-school-muted/10 hover:text-school-text'
                      : 'text-white/85 hover:bg-white/10 hover:text-white'
                }`}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="flex items-center gap-2">
          <ThemeToggle className="hidden sm:inline-flex" />
          <Link
            href="/register-school"
            className={`hidden rounded-pill px-4 py-2.5 text-sm font-medium transition duration-300 sm:inline-flex ${
              solid ? 'text-school-text hover:bg-school-muted/10' : 'text-white/85 hover:bg-white/10 hover:text-white'
            }`}
          >
            Register School
          </Link>
          <Link
            href="/login"
            className={`hidden rounded-pill px-5 py-2.5 text-sm font-semibold transition duration-300 sm:inline-flex ${
              solid
                ? 'bg-school-navy text-white hover:scale-[1.03] hover:shadow-soft'
                : 'bg-school-gold text-school-navy hover:scale-[1.03] hover:shadow-glow'
            }`}
          >
            Portal Login
          </Link>
          <button
            type="button"
            className={`rounded-xl p-2 lg:hidden ${solid ? 'text-school-text' : 'text-white'}`}
            onClick={() => setOpen(!open)}
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            aria-controls="mobile-nav"
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              {open
                ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />}
            </svg>
          </button>
        </div>
      </div>

      {open && (
        <div
          id="mobile-nav"
          className={`border-t px-4 py-4 lg:hidden ${solid ? 'border-school-border bg-school-surface' : 'border-white/10 bg-school-navy/95 backdrop-blur-lg'}`}
        >
          <div className="mb-3 sm:hidden">
            <ThemeToggle className="w-full" />
          </div>
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className={`block rounded-xl px-3 py-2.5 text-sm font-medium ${solid ? 'text-school-text hover:bg-school-muted/10' : 'text-white/90 hover:text-school-gold'}`}
            >
              {item.label}
            </Link>
          ))}
          <Link
            href="/register-school"
            onClick={() => setOpen(false)}
            className={`block rounded-xl px-3 py-2.5 text-sm font-medium ${solid ? 'text-school-text hover:bg-school-muted/10' : 'text-white/90 hover:text-school-gold'}`}
          >
            Register School
          </Link>
          <Link
            href="/login"
            onClick={() => setOpen(false)}
            className="btn-gold mt-3 block w-full text-center"
          >
            Portal Login
          </Link>
        </div>
      )}
    </header>
  )
}
