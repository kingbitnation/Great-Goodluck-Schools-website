import { useEffect, useState } from 'react'
import AppLayout from '../../components/layout/AppLayout'
import { withAuth } from '../../components/withAuth'
import { apiGet, apiPost } from '../../lib/api'
import type { AuthUser } from '../../lib/useAuth'

type ApiKey = {
  id: string
  name: string
  keyPrefix: string
  scopes: string[]
  rateLimit: number
  lastUsedAt: string | null
  createdAt: string
}

type Webhook = {
  id: string
  url: string
  events: string[]
  isActive: boolean
  secretPreview?: string
}

const WEBHOOK_EVENTS = ['attendance.marked', 'attendance.absent_streak', 'payment.approved']

function DeveloperPage({ user }: { user: AuthUser }) {
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [webhooks, setWebhooks] = useState<Webhook[]>([])
  const [newKeyName, setNewKeyName] = useState('')
  const [secret, setSecret] = useState<string | null>(null)
  const [webhookUrl, setWebhookUrl] = useState('')
  const [error, setError] = useState<string | null>(null)

  const load = () => {
    Promise.all([
      apiGet<{ keys: ApiKey[] }>('/api/developer/keys').catch(() => ({ keys: [] })),
      apiGet<{ endpoints: Webhook[] }>('/api/developer/webhooks').catch(() => ({ endpoints: [] })),
    ]).then(([k, w]) => {
      setKeys(k.keys)
      setWebhooks(w.endpoints)
    })
  }

  useEffect(() => { load() }, [])

  async function createKey(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSecret(null)
    try {
      const res = await apiPost<{ secret: string }>('/api/developer/keys', {
        name: newKeyName || 'Production key',
        scopes: ['read', 'write'],
      })
      setSecret(res.secret)
      setNewKeyName('')
      load()
    } catch (err: any) {
      setError(err.message)
    }
  }

  async function revoke(id: string) {
    if (!confirm('Revoke this API key?')) return
    await apiPost(`/api/developer/keys/${id}/revoke`, {})
    load()
  }

  async function addWebhook(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      const res = await apiPost<{ endpoint: Webhook & { secret?: string } }>('/api/developer/webhooks', {
        url: webhookUrl,
        events: WEBHOOK_EVENTS,
      })
      if (res.endpoint?.secret) setSecret(res.endpoint.secret)
      setWebhookUrl('')
      load()
    } catch (err: any) {
      setError(err.message)
    }
  }

  return (
    <AppLayout user={user} title="API & Webhooks">
      <p className="mb-4 text-sm text-gray-600">
        Enterprise API access for Ultimate plans. REST reference:{' '}
        <a href="/api/docs/openapi.yaml" className="text-amber-700 underline" target="_blank" rel="noreferrer">
          OpenAPI spec
        </a>
      </p>
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      {secret && (
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm">
          <p className="font-medium text-amber-900">Copy this secret now — it won&apos;t be shown again:</p>
          <code className="mt-2 block break-all rounded bg-white p-2 text-xs">{secret}</code>
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-2">
        <section className="rounded-lg border bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold uppercase text-gray-500">API keys</h2>
          <form onSubmit={createKey} className="mt-3 flex gap-2">
            <input value={newKeyName} onChange={(e) => setNewKeyName(e.target.value)} placeholder="Key name" className="flex-1 rounded border px-3 py-2 text-sm" />
            <button type="submit" className="rounded bg-slate-900 px-3 py-2 text-sm text-white">Generate</button>
          </form>
          <ul className="mt-4 space-y-2">
            {keys.map((k) => (
              <li key={k.id} className="flex items-center justify-between rounded border p-3 text-sm">
                <div>
                  <p className="font-medium">{k.name}</p>
                  <p className="text-gray-500">{k.keyPrefix}… · {k.rateLimit}/hr</p>
                </div>
                <button type="button" onClick={() => revoke(k.id)} className="text-red-600">Revoke</button>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-lg border bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold uppercase text-gray-500">Webhooks</h2>
          <form onSubmit={addWebhook} className="mt-3 flex gap-2">
            <input value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)} placeholder="https://your-server.com/webhooks" className="flex-1 rounded border px-3 py-2 text-sm" />
            <button type="submit" className="rounded bg-slate-900 px-3 py-2 text-sm text-white">Add</button>
          </form>
          <ul className="mt-4 space-y-2">
            {webhooks.map((w) => (
              <li key={w.id} className="rounded border p-3 text-sm">
                <p className="font-medium break-all">{w.url}</p>
                <p className="text-gray-500">{w.events.join(', ')} · {w.isActive ? 'active' : 'paused'}</p>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </AppLayout>
  )
}

export default withAuth(DeveloperPage, { roles: ['SchoolAdmin'] })
