import Link from 'next/link'
import { useRouter } from 'next/router'
import type { ReactNode } from 'react'
import { logout } from '../../lib/auth'
import { navForRole, ROLE_LABELS } from '../../lib/navigation'
import type { AuthUser } from '../../lib/useAuth'

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
    <div className="min-h-screen flex bg-gray-50">
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-5 border-b border-gray-200">
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">School SMS</p>
          <p className="mt-1 text-sm font-medium text-gray-900 truncate">
            {user.firstName} {user.lastName}
          </p>
          <p className="text-xs text-gray-500">{ROLE_LABELS[user.role] || user.role}</p>
          {user.schoolName && (
            <p className="mt-1 text-xs text-gray-400 truncate">{user.schoolName}</p>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-4">
          {sections.map((section) => (
            <div key={section}>
              <p className="px-3 mb-1 text-xs font-semibold uppercase text-gray-400">{section}</p>
              <ul className="space-y-0.5">
                {items
                  .filter((item) => (item.section || 'Main') === section)
                  .map((item) => {
                    const active = router.pathname === item.href
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          className={`block rounded-md px-3 py-2 text-sm transition-colors ${
                            active
                              ? 'bg-blue-50 text-blue-700 font-medium'
                              : 'text-gray-700 hover:bg-gray-100'
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

        <div className="p-3 border-t border-gray-200">
          <button
            onClick={handleLogout}
            className="w-full rounded-md px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 text-left"
          >
            Sign out
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <header className="bg-white border-b border-gray-200 px-8 py-5">
          <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
        </header>
        <div className="p-8">{children}</div>
      </main>
    </div>
  )
}
