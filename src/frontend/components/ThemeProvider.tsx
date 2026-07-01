import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { getStoredTheme, setStoredTheme } from '../lib/storageKeys'

type ThemeContextValue = {
  theme: Theme
  setTheme: (theme: Theme) => void
  toggle: () => void
  mounted: boolean
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'light',
  setTheme: () => {},
  toggle: () => {},
  mounted: false,
})

export type Theme = 'light' | 'dark'

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark')
  document.documentElement.style.colorScheme = theme
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', theme === 'dark' ? '#020617' : '#0A1F44')
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('light')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const saved = getStoredTheme() as Theme | null
    const initial =
      saved ||
      (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    setThemeState(initial)
    applyTheme(initial)
    setMounted(true)
  }, [])

  function setTheme(next: Theme) {
    setThemeState(next)
    setStoredTheme(next)
    applyTheme(next)
  }

  function toggle() {
    setTheme(theme === 'light' ? 'dark' : 'light')
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggle, mounted }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}

export function ThemeToggle({ className = '' }: { className?: string }) {
  const { theme, toggle, mounted } = useTheme()

  return (
    <button
      type="button"
      onClick={toggle}
      className={`inline-flex items-center justify-center gap-2 rounded-xl border border-school-border bg-school-surface px-3 py-2 text-sm font-medium text-school-text transition hover:bg-school-muted/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-school-gold/40 ${className}`}
      aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
      aria-pressed={mounted ? theme === 'dark' : undefined}
    >
      <span aria-hidden="true">{theme === 'light' ? '🌙' : '☀️'}</span>
      <span className="hidden sm:inline">{theme === 'light' ? 'Dark' : 'Light'}</span>
    </button>
  )
}
