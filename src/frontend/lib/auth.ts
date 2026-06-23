const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000'

export function saveToken(token: string) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('sms_token', token)
  }
}

export function getToken(): string | null {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('sms_token')
  }
  return null
}

export function clearToken() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('sms_token')
  }
}

let refreshPromise: Promise<string | null> | null = null

async function tryRefresh(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = fetch(`${API_BASE}/api/auth/refresh`, {
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

  let res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    credentials: 'include',
  })

  if (res.status === 401) {
    token = await tryRefresh()
    if (token) {
      headers.set('Authorization', `Bearer ${token}`)
      res = await fetch(`${API_BASE}${path}`, {
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
    await fetch(`${API_BASE}/api/auth/logout`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    })
  } finally {
    clearToken()
  }
}
