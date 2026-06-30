import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { ThemeToggle } from '../ThemeProvider'
import { SchoolLogo } from '../public/Brand'
import type { NavItem } from '../../lib/navigation'
import { ROLE_LABELS } from '../../lib/navigation'
import type { AuthUser } from '../../lib/useAuth'

type PortalSidebarProps = {
  user: AuthUser
  items: NavItem[]
  sections: string[]
  pathname: string
  homeHref: string
  mobileOpen: boolean
  onCloseMobile: () => void
  onLogout: () => void
}

export function isNavActive(pathname: string, href: string) {
  if (pathname === href) return true
  if (href !== '/dashboard' && href !== '/super-admin' && pathname.startsWith(`${href}/`)) {
    return true
  }
  return false
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      className={`h-4 w-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.25a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z"
        clipRule="evenodd"
      />
    </svg>
  )
}

function SidebarPanel({
  user,
  items,
  sections,
  pathname,
  homeHref,
  onNavigate,
  onLogout,
}: Omit<PortalSidebarProps, 'mobileOpen' | 'onCloseMobile'> & { onNavigate?: () => void }) {
  const brandLabel = user.role === 'SuperAdmin' ? 'SchoolPilot' : user.schoolName || 'SchoolPilot'

  const activeSections = useMemo(() => {
    const active = new Set<string>()
    for (const item of items) {
      if (isNavActive(pathname, item.href)) {
        active.add(item.section || 'Main')
      }
    }
    return active
  }, [items, pathname])

  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  useEffect(() => {
    setExpanded((prev) => {
      const next = { ...prev }
      for (const section of sections) {
        if (section === 'Main' || activeSections.has(section)) {
          next[section] = true
        } else if (next[section] === undefined) {
          next[section] = false
        }
      }
      return next
    })
  }, [sections, activeSections])

  function toggleSection(section: string) {
    setExpanded((prev) => ({ ...prev, [section]: !prev[section] }))
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div className="border-b border-school-border bg-gradient-to-br from-school-navy to-[#0d2854] p-5 text-white">
        <Link href={homeHref} className="mb-3 block" onClick={onNavigate}>
          <SchoolLogo light size="sm" variant="wordmark" asLink={false} />
        </Link>
        <p className="text-xs font-semibold uppercase tracking-wide text-amber-200">{brandLabel}</p>
        <p className="mt-1 truncate text-sm font-medium">
          {user.firstName} {user.lastName}
        </p>
        <p className="text-xs text-blue-100">{ROLE_LABELS[user.role] || user.role}</p>
        {user.schoolName && user.role !== 'SuperAdmin' && (
          <p className="mt-1 truncate text-xs text-blue-200">{user.schoolName}</p>
        )}
      </div>

      <nav className="flex-1 space-y-2 overflow-y-auto p-3" aria-label="Portal menu">
        {sections.map((section) => {
          const sectionItems = items.filter((item) => (item.section || 'Main') === section)
          if (sectionItems.length === 0) return null

          const isOpen = expanded[section] !== false
          const sectionActive = sectionItems.some((item) => isNavActive(pathname, item.href))
          const collapsible = section !== 'Main' && sectionItems.length > 1

          return (
            <div key={section} className="rounded-xl border border-transparent">
              {collapsible ? (
                <button
                  type="button"
                  onClick={() => toggleSection(section)}
                  aria-expanded={isOpen}
                  className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide transition-colors ${
                    sectionActive ? 'text-school-royal' : 'text-school-muted hover:bg-school-muted/10'
                  }`}
                >
                  <span>{section}</span>
                  <Chevron open={isOpen} />
                </button>
              ) : (
                <p className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-school-muted">{section}</p>
              )}

              {(!collapsible || isOpen) && (
                <ul className={`space-y-0.5 ${collapsible ? 'mt-0.5' : 'mt-0.5'}`}>
                  {sectionItems.map((item) => {
                    const active = isNavActive(pathname, item.href)
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          onClick={onNavigate}
                          aria-current={active ? 'page' : undefined}
                          className={`block rounded-xl px-3 py-2 text-sm transition-colors ${
                            active
                              ? 'bg-school-gold/15 font-medium text-amber-800 dark:text-amber-300'
                              : 'text-school-text hover:bg-school-muted/10'
                          }`}
                        >
                          {item.label}
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          )
        })}
      </nav>

      <div className="space-y-2 border-t border-school-border p-3">
        <ThemeToggle className="w-full" />
        <button
          type="button"
          onClick={onLogout}
          className="w-full rounded-xl px-3 py-2 text-left text-sm text-school-text hover:bg-school-muted/10"
          aria-label="Sign out of your account"
        >
          Sign out
        </button>
      </div>
    </div>
  )
}

export default function PortalSidebar({
  user,
  items,
  sections,
  pathname,
  homeHref,
  mobileOpen,
  onCloseMobile,
  onLogout,
}: PortalSidebarProps) {
  return (
    <>
      <aside
        className="sticky top-0 hidden h-screen w-64 shrink-0 flex flex-col border-r border-school-border bg-school-surface shadow-sm md:flex"
        aria-label="Portal navigation"
      >
        <SidebarPanel
          user={user}
          items={items}
          sections={sections}
          pathname={pathname}
          homeHref={homeHref}
          onLogout={onLogout}
        />
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="Navigation menu">
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            aria-label="Close menu"
            onClick={onCloseMobile}
          />
          <aside className="relative flex h-full w-[min(100%,18rem)] flex-col bg-school-surface shadow-xl">
            <SidebarPanel
              user={user}
              items={items}
              sections={sections}
              pathname={pathname}
              homeHref={homeHref}
              onNavigate={onCloseMobile}
              onLogout={onLogout}
            />
          </aside>
        </div>
      )}
    </>
  )
}
