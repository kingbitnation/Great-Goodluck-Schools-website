import { fetchWithAuth } from './auth'

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetchWithAuth(path)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `Request failed (${res.status})`)
  }
  return res.json()
}

export async function apiPost<T = any>(path: string, data: unknown): Promise<T> {
  const res = await fetchWithAuth(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    const apiError = new Error(body.error || `Request failed (${res.status})`)
    if (body.fields) {
      ;(apiError as any).fields = body.fields
    }
    throw apiError
  }
  return res.json()
}

export async function apiPatch<T = any>(path: string, data: unknown): Promise<T> {
  const res = await fetchWithAuth(path, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `Request failed (${res.status})`)
  }
  return res.json()
}

export async function apiPut<T = any>(path: string, data: unknown): Promise<T> {
  const res = await fetchWithAuth(path, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    const apiError = new Error(body.error || `Request failed (${res.status})`)
    if (body.fields) {
      ;(apiError as any).fields = body.fields
    }
    throw apiError
  }
  return res.json()
}

export async function apiDelete<T = any>(path: string): Promise<T> {
  const res = await fetchWithAuth(path, { method: 'DELETE' })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    const apiError = new Error(body.error || `Request failed (${res.status})`)
    if (body.fields) {
      ;(apiError as any).fields = body.fields
    }
    throw apiError
  }
  return res.json()
}
