import { useRouter } from 'next/router'
import { useMemo, useState, type ReactNode } from 'react'
import { logout } from '../../lib/auth'
import { navForRole, navSectionsForRole } from '../../lib/navigation'
import type { AuthUser } from '../../lib/useAuth'
import { SkipLink } from '../ui'
import PortalSidebar from './PortalSidebar'

type AppLayoutProps = {
  user: AuthUser
  title: string
  children: ReactNode
}

export default function AppLayout({ user, title, children }: AppLayoutProps) {
  const router = useRouter()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const items = useMemo(() => navForRole(user.role), [user.role])
  const sections = useMemo(() => navSectionsForRole(user.role), [user.role])
  const homeHref = user.role === 'SuperAdmin' ? '/super-admin' : '/dashboard'

  async function handleLogout() {
    await logout()
    router.push('/login')
  }

  return (
    <div className="flex min-h-screen bg-school-bg font-sans text-school-text">
      <SkipLink />
      <PortalSidebar
        user={user}
        items={items}
        sections={sections}
        pathname={router.pathname}
        homeHref={homeHref}
        mobileOpen={mobileNavOpen}
        onCloseMobile={() => setMobileNavOpen(false)}
        onLogout={handleLogout}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-school-border bg-school-surface px-4 py-4 shadow-sm sm:px-6 md:px-8">
          <div className="flex items-start gap-3">
            <button
              type="button"
              className="mt-0.5 rounded-xl p-2 text-school-text hover:bg-school-muted/10 md:hidden"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Open navigation menu"
              aria-expanded={mobileNavOpen}
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-school-royal">SchoolPilot</p>
              <h1 className="font-display truncate text-xl font-semibold text-school-text">{title}</h1>
            </div>
          </div>
        </header>

        <main id="main-content" className="flex-1 overflow-auto" tabIndex={-1}>
          <div className="p-4 sm:p-6 md:p-8">{children}</div>
        </main>
      </div>
    </div>
  )
}
