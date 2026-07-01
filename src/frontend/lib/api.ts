import { fetchWithAuth } from './auth'
import { parseJsonResponse } from './apiBase'

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await parseJsonResponse<{ error?: string; code?: string; fields?: Record<string, string> }>(res)
    const apiError = new Error(body.error || `Request failed (${res.status})`)
    if (body.code) {
      ;(apiError as any).code = body.code
    }
    if (body.fields) {
      ;(apiError as any).fields = body.fields
    }
    const blocked = ['SCHOOL_SUSPENDED', 'SUBSCRIPTION_EXPIRED', 'TRIAL_EXPIRED', 'SUBSCRIPTION_CANCELLED']
    if (
      typeof window !== 'undefined' &&
      res.status === 403 &&
      body.code &&
      blocked.includes(body.code)
    ) {
      const { clearToken } = await import('./auth')
      clearToken()
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = `/login?suspended=1&code=${encodeURIComponent(body.code)}`
      }
    }
    throw apiError
  }
  return parseJsonResponse<T>(res)
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetchWithAuth(path)
  return handleResponse<T>(res)
}

export async function apiPost<T = any>(path: string, data: unknown): Promise<T> {
  const res = await fetchWithAuth(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  return handleResponse<T>(res)
}

export async function apiPatch<T = any>(path: string, data: unknown): Promise<T> {
  const res = await fetchWithAuth(path, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  return handleResponse<T>(res)
}

export async function apiPut<T = any>(path: string, data: unknown): Promise<T> {
  const res = await fetchWithAuth(path, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  return handleResponse<T>(res)
}

export async function apiDelete<T = any>(path: string): Promise<T> {
  const res = await fetchWithAuth(path, { method: 'DELETE' })
  return handleResponse<T>(res)
}
