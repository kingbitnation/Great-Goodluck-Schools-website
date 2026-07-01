/** API origin: browser uses same-origin proxy; SSR uses internal URL. */
export function apiBaseUrl(): string {
  if (typeof window !== 'undefined') return ''
  return (
    process.env.API_INTERNAL_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    'http://localhost:4000'
  )
}

export async function parseJsonResponse<T = Record<string, unknown>>(res: Response): Promise<T> {
  const text = await res.text()
  if (!text.trim()) return {} as T
  try {
    return JSON.parse(text) as T
  } catch {
    if (text.trimStart().startsWith('<!DOCTYPE') || text.trimStart().startsWith('<html')) {
      throw new Error(
        'Server returned HTML instead of JSON. Is the API running? Rebuild with docker compose or start the backend on port 4000.',
      )
    }
    if (/^Redirecting/i.test(text.trim()) || text.trim().startsWith('redirect')) {
      throw new Error('API request was redirected. Check BACKEND_URL on Vercel points to your Railway backend.')
    }
    throw new Error(`Invalid server response: ${text.slice(0, 120)}`)
  }
}
