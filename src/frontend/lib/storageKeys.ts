/** Browser storage keys (SchoolPilot). Legacy `sms_*` keys are read for migration. */
export const TOKEN_KEY = 'sp_token'
export const THEME_KEY = 'sp_theme'
const LEGACY_TOKEN_KEY = 'sms_token'
const LEGACY_THEME_KEY = 'sms_theme'

export function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null
  const current = localStorage.getItem(TOKEN_KEY)
  if (current) return current
  const legacy = localStorage.getItem(LEGACY_TOKEN_KEY)
  if (legacy) {
    localStorage.setItem(TOKEN_KEY, legacy)
    localStorage.removeItem(LEGACY_TOKEN_KEY)
    return legacy
  }
  return null
}

export function setStoredToken(token: string) {
  if (typeof window === 'undefined') return
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.removeItem(LEGACY_TOKEN_KEY)
}

export function clearStoredToken() {
  if (typeof window === 'undefined') return
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(LEGACY_TOKEN_KEY)
}

export function getStoredTheme(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(THEME_KEY) || localStorage.getItem(LEGACY_THEME_KEY)
}

export function setStoredTheme(theme: string) {
  if (typeof window === 'undefined') return
  localStorage.setItem(THEME_KEY, theme)
  localStorage.removeItem(LEGACY_THEME_KEY)
}
