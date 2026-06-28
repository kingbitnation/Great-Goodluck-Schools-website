import Link from 'next/link'
import { ThemeToggle } from '../ThemeProvider'
import { useRouter } from 'next/router'
import type { ReactNode } from 'react'
import { logout } from '../../lib/auth'
import { navForRole, ROLE_LABELS } from '../../lib/navigation'
import type { AuthUser } from '../../lib/useAuth'
import { SkipLink } from '../ui'

type AppLayoutProps = {
  user: AuthUser
  title: string
  children: ReactNode
}

export default function AppLayout({ user, title, children }: AppLayoutProps) {
  const router = useRouter()
  const items = navForRole(user.role)
  const sections = items.reduce<string[]>((acc, item) => {
    const section = item.section || 'Main'
    if (!acc.includes(section)) acc.push(section)
    return acc
  }, [])

  async function handleLogout() {
    await logout()
    router.push('/login')
  }

  return (
    <div className="min-h-screen flex bg-school-bg font-sans text-school-text">
      <SkipLink />
      <aside
        className="w-64 bg-school-surface border-r border-school-border flex flex-col shadow-sm"
        aria-label="Portal navigation"
      >
        <div className="p-5 border-b border-school-border bg-gradient-to-br from-school-navy to-[#0d2854] text-white">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-200">
            {user.role === 'SuperAdmin' ? 'SchoolPilot' : (user.schoolName || 'SchoolPilot')}
          </p>
          <p className="mt-1 text-sm font-medium truncate">
            {user.firstName} {user.lastName}
          </p>
          <p className="text-xs text-blue-100">{ROLE_LABELS[user.role] || user.role}</p>
          {user.schoolName && (
            <p className="mt-1 text-xs text-blue-200 truncate">{user.schoolName}</p>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-4" aria-label="Main menu">
          {sections.map((section) => (
            <div key={section}>
              <p className="px-3 mb-1 text-xs font-semibold uppercase text-school-muted">{section}</p>
              <ul className="space-y-0.5">
                {items
                  .filter((item) => (item.section || 'Main') === section)
                  .map((item) => {
                    const active = router.pathname === item.href
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          aria-current={active ? 'page' : undefined}
                          className={`block rounded-xl px-3 py-2 text-sm transition-colors ${
                            active
                              ? 'bg-school-gold/15 text-amber-800 dark:text-amber-300 font-medium'
                              : 'text-school-text hover:bg-school-muted/10'
                          }`}
                        >
                          {item.label}
                        </Link>
                      </li>
                    )
                  })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="p-3 border-t border-school-border space-y-2">
          <ThemeToggle className="w-full" />
          <button
            type="button"
            onClick={handleLogout}
            className="w-full rounded-xl px-3 py-2 text-sm text-school-text hover:bg-school-muted/10 text-left"
            aria-label="Sign out of your account"
          >
            Sign out
          </button>
        </div>
      </aside>

      <main id="main-content" className="flex-1 overflow-auto" tabIndex={-1}>
        <header className="bg-school-surface border-b border-school-border px-6 py-5 shadow-sm sm:px-8">
          <h1 className="font-display text-xl font-semibold text-school-text">{title}</h1>
        </header>
        <div className="p-6 sm:p-8">{children}</div>
      </main>
    </div>
  )
}
