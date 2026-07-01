import { apiBaseUrl } from './apiBase'
import { getStoredToken, setStoredToken, clearStoredToken } from './storageKeys'

export function saveToken(token: string) {
  setStoredToken(token)
}

export function getToken(): string | null {
  return getStoredToken()
}

export function clearToken() {
  clearStoredToken()
}

let refreshPromise: Promise<string | null> | null = null

async function tryRefresh(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = fetch(`${apiBaseUrl()}/api/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    })
      .then(async (res) => {
        if (!res.ok) return null
        const data = await res.json()
        if (data?.accessToken) {
          saveToken(data.accessToken)
          return data.accessToken as string
        }
        return null
      })
      .finally(() => {
        refreshPromise = null
      })
  }
  return refreshPromise
}

export async function fetchWithAuth(path: string, options: RequestInit = {}) {
  let token = getToken()
  const headers = new Headers(options.headers || {})
  if (token) headers.set('Authorization', `Bearer ${token}`)
  const base = apiBaseUrl()

  let res = await fetch(`${base}${path}`, {
    ...options,
    headers,
    credentials: 'include',
  })

  if (res.status === 401) {
    token = await tryRefresh()
    if (token) {
      headers.set('Authorization', `Bearer ${token}`)
      res = await fetch(`${base}${path}`, {
        ...options,
        headers,
        credentials: 'include',
      })
    }
  }

  return res
}

export async function logout() {
  try {
    await fetch(`${apiBaseUrl()}/api/auth/logout`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    })
  } finally {
    clearToken()
  }
}
