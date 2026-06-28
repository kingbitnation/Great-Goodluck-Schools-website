import Link from 'next/link'
import { useState, type FormEvent, type ReactNode } from 'react'
import { SchoolLogo, IconMapPin, IconMail, IconPhone } from './Brand'

const FOOTER_LINKS = [
  {
    title: 'School',
    links: [
      { href: '/about', label: 'About Us' },
      { href: '/vision', label: 'Our Vision' },
      { href: '/mission', label: 'Our Mission' },
      { href: '/history', label: 'History' },
      { href: '/staff', label: 'Staff' },
    ],
  },
  {
    title: 'Academics',
    links: [
      { href: '/academics', label: 'Programs' },
      { href: '/departments', label: 'Departments' },
      { href: '/admissions', label: 'Admissions' },
      { href: '/application/status', label: 'Track Application' },
      { href: '/apply', label: 'Apply Online' },
      { href: '/faq', label: 'FAQ' },
    ],
  },
  {
    title: 'Resources',
    links: [
      { href: '/news', label: 'News' },
      { href: '/events', label: 'Events' },
      { href: '/gallery', label: 'Gallery' },
      { href: '/blog', label: 'Blog' },
      { href: '/careers', label: 'Careers' },
      { href: '/verify-certificate', label: 'Verify Certificate' },
      { href: '/verify-id-card', label: 'Verify ID Card' },
      { href: '/alumni/join', label: 'Alumni Network' },
      { href: '/alumni/donate', label: 'Donate' },
    ],
  },
]

function Social({ children, label }: { children: ReactNode; label: string }) {
  return (
    <span
      title={label}
      className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-school-muted transition hover:border-school-gold/40 hover:text-school-gold"
    >
      {children}
    </span>
  )
}

export default function SiteFooter() {
  const [email, setEmail] = useState('')
  const [newsletterMsg, setNewsletterMsg] = useState('')
  const [newsletterErr, setNewsletterErr] = useState('')
  const base = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000'

  async function handleNewsletter(e: FormEvent) {
    e.preventDefault()
    setNewsletterMsg('')
    setNewsletterErr('')
    try {
      const res = await fetch(`${base}/api/public/newsletter`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || 'Subscription failed')
      setNewsletterMsg('Thank you for subscribing!')
      setEmail('')
    } catch (err: any) {
      setNewsletterErr(err.message || 'Could not subscribe')
    }
  }

  return (
    <footer className="mt-auto bg-school-navy text-school-muted">
      <div className="h-1 bg-gradient-to-r from-school-gold via-school-royal to-school-green" />

      {/* Admissions CTA */}
      <div className="border-b border-white/5 bg-[#0F172A]">
        <div className="container-school flex flex-col items-center gap-5 py-10 text-center sm:flex-row sm:justify-between sm:text-left">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-school-gold">Admissions Open</p>
            <h3 className="font-display mt-1 text-xl font-bold text-white sm:text-2xl">
              Start your journey with us
            </h3>
          </div>
          <div className="flex w-full flex-col gap-2.5 sm:w-auto sm:flex-row">
            <Link href="/apply" className="btn-gold justify-center px-6 py-2.5">Apply Now</Link>
            <Link href="/contact" className="btn-outline justify-center px-6 py-2.5">Contact Us</Link>
          </div>
        </div>
      </div>

      {/* Main footer body */}
      <div className="container-school py-12 lg:py-14">
        <div className="flex flex-col gap-12 lg:flex-row lg:gap-16">
          {/* Brand */}
          <div className="shrink-0 lg:w-72">
            <SchoolLogo light size="md" />
            <p className="mt-4 text-sm leading-relaxed text-school-muted">
              Shaping tomorrow&apos;s leaders through academic rigour, moral integrity, and innovation since 1999.
            </p>
            <div className="mt-5 flex gap-2">
              <Social label="Facebook">
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg>
              </Social>
              <Social label="Instagram">
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" /></svg>
              </Social>
              <Social label="YouTube">
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" /></svg>
              </Social>
            </div>
          </div>

          {/* Link columns — equal width grid */}
          <div className="grid flex-1 grid-cols-2 gap-8 sm:grid-cols-3 sm:gap-10">
            {FOOTER_LINKS.map((group) => (
              <div key={group.title}>
                <h4 className="mb-3 text-xs font-bold uppercase tracking-widest text-white">{group.title}</h4>
                <ul className="space-y-2">
                  {group.links.map((link) => (
                    <li key={link.href}>
                      <Link href={link.href} className="text-sm text-school-muted hover:text-school-gold">
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Contact strip — full width, aligned row */}
        <div className="mt-12 grid gap-4 rounded-2xl border border-white/5 bg-white/[0.03] p-5 sm:grid-cols-3 sm:gap-6 sm:p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-school-gold/10">
              <IconMapPin className="h-4 w-4 text-school-gold" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-300">Address</p>
              <p className="mt-0.5 text-sm text-slate-500">123 Education Lane, Lagos, Nigeria</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-school-gold/10">
              <IconPhone className="h-4 w-4 text-school-gold" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-300">Phone</p>
              <p className="mt-0.5 text-sm text-slate-500">+234 801 234 5678</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-school-gold/10">
              <IconMail className="h-4 w-4 text-school-gold" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-300">Email</p>
              <a
                href="mailto:support@schoolpilot.app"
                className="mt-0.5 block break-all text-sm text-slate-500 hover:text-school-gold"
              >
                support@schoolpilot.app
              </a>
            </div>
          </div>
        </div>

        <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <p className="text-xs font-bold uppercase tracking-widest text-school-gold">Newsletter</p>
          <p className="mt-1 text-sm text-slate-400">Get school news and event updates in your inbox.</p>
          <form onSubmit={handleNewsletter} className="mt-4 flex flex-col gap-2 sm:flex-row">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Your email address"
              className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-slate-500"
              aria-label="Email for newsletter"
            />
            <button type="submit" className="btn-gold shrink-0 px-6 py-2.5">Subscribe</button>
          </form>
          {newsletterMsg && <p className="mt-2 text-sm text-emerald-400">{newsletterMsg}</p>}
          {newsletterErr && <p className="mt-2 text-sm text-red-400" role="alert">{newsletterErr}</p>}
        </div>
      </div>

      {/* Copyright */}
      <div className="border-t border-white/5 bg-[#071528]">
        <div className="container-school flex flex-col items-center justify-between gap-3 py-5 text-xs text-slate-600 sm:flex-row">
          <p>© {new Date().getFullYear()} SchoolPilot. All rights reserved.</p>
          <div className="flex gap-6">
            <Link href="/privacy" className="hover:text-school-gold">Privacy</Link>
            <Link href="/terms" className="hover:text-school-gold">Terms</Link>
            <Link href="/login" className="hover:text-school-gold">Staff Portal</Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
