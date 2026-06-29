import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import AppLayout from '../../components/layout/AppLayout'
import { withAuth } from '../../components/withAuth'
import { apiGet, apiPost } from '../../lib/api'
import type { AuthUser } from '../../lib/useAuth'

type IntegrationRow = {
  provider: { slug: string; name: string; category: string; description: string | null }
  connection: { status: string; connectedAt: string | null; lastError: string | null } | null
}

type OAuthStatus = { google: boolean; zoom: boolean; paystack: boolean }

function IntegrationsPage({ user }: { user: AuthUser }) {
  const router = useRouter()
  const [rows, setRows] = useState<IntegrationRow[]>([])
  const [oauth, setOauth] = useState<OAuthStatus | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [paystackPublic, setPaystackPublic] = useState('')
  const [paystackSecret, setPaystackSecret] = useState('')

  const load = () => {
    apiGet<{ integrations: IntegrationRow[] }>('/api/developer/integrations')
      .then((d) => setRows(d.integrations))
      .catch((e) => setError(e.message))
    apiGet<OAuthStatus>('/api/oauth/status').then(setOauth).catch(() => {})
  }

  useEffect(() => { load() }, [])

  useEffect(() => {
    if (router.query.connected) load()
    if (router.query.error) setError(String(router.query.error))
  }, [router.query])

  async function oauthConnect(provider: 'google' | 'zoom') {
    setBusy(provider)
    setError(null)
    try {
      const res = await apiGet<{ url: string }>(`/api/oauth/${provider}/authorize`)
      window.location.href = res.url
    } catch (e: any) {
      setError(e.message)
      setBusy(null)
    }
  }

  async function connectPaystack(e: React.FormEvent) {
    e.preventDefault()
    setBusy('paystack')
    setError(null)
    try {
      await apiPost('/api/oauth/paystack/connect', { publicKey: paystackPublic, secretKey: paystackSecret })
      setPaystackSecret('')
      load()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setBusy(null)
    }
  }

  async function disconnect(slug: string) {
    setBusy(slug)
    await apiPost(`/api/developer/integrations/${slug}/disconnect`, {})
    load()
    setBusy(null)
  }

  return (
    <AppLayout user={user} title="Integrations">
      <p className="mb-4 text-sm text-gray-600">
        Connect Google Workspace, Zoom, and Paystack with real OAuth or API key verification.
      </p>
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <section className="mb-8 rounded-lg border bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold uppercase text-gray-500">Paystack (school fees)</h2>
        <p className="mt-1 text-sm text-gray-600">Enter your Paystack keys — we verify them against the Paystack API before saving encrypted.</p>
        <form onSubmit={connectPaystack} className="mt-3 grid gap-2 sm:grid-cols-2">
          <input value={paystackPublic} onChange={(e) => setPaystackPublic(e.target.value)} placeholder="Public key (pk_…)" className="rounded border px-3 py-2 text-sm" />
          <input type="password" value={paystackSecret} onChange={(e) => setPaystackSecret(e.target.value)} placeholder="Secret key (sk_…)" className="rounded border px-3 py-2 text-sm" />
          <button type="submit" disabled={busy === 'paystack'} className="sm:col-span-2 rounded bg-amber-600 px-4 py-2 text-sm font-medium text-white">
            {busy === 'paystack' ? 'Verifying…' : 'Connect Paystack'}
          </button>
        </form>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map(({ provider, connection }) => {
          const connected = connection?.status === 'connected'
          const isGoogle = provider.slug === 'google-workspace'
          const isZoom = provider.slug === 'zoom'
          const isPaystack = provider.slug === 'paystack'
          return (
            <article key={provider.slug} className="rounded-lg border bg-white p-4 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-amber-700">{provider.category}</p>
              <h2 className="mt-1 text-lg font-semibold">{provider.name}</h2>
              <p className="mt-2 text-sm text-gray-600">{provider.description}</p>
              <p className="mt-3 text-xs text-gray-500">
                Status: <span className={connected ? 'text-green-700' : 'text-gray-600'}>{connection?.status || 'disconnected'}</span>
              </p>
              {isGoogle && oauth?.google && (
                <div className="mt-4 flex flex-wrap gap-2">
                  <button type="button" disabled={busy === 'google'} onClick={() => oauthConnect('google')} className="rounded-md bg-slate-900 px-3 py-2 text-sm text-white">
                    {connected ? 'Reconnect Google' : 'Sign in with Google'}
                  </button>
                  {connected && (
                    <button type="button" disabled={busy === 'google-sync'} onClick={async () => {
                      setBusy('google-sync')
                      try {
                        await apiPost('/api/integrations/google/sync', {})
                        load()
                      } catch (e: any) { setError(e.message) }
                      setBusy(null)
                    }} className="rounded-md border px-3 py-2 text-sm">
                      Sync calendar now
                    </button>
                  )}
                </div>
              )}
              {isZoom && oauth?.zoom && (
                <button type="button" disabled={busy === 'zoom'} onClick={() => oauthConnect('zoom')} className="mt-4 rounded-md bg-slate-900 px-3 py-2 text-sm text-white">
                  {connected ? 'Reconnect Zoom' : 'Sign in with Zoom'}
                </button>
              )}
              {isPaystack && connected && (
                <button type="button" onClick={() => disconnect(provider.slug)} className="mt-4 rounded-md border px-3 py-2 text-sm">Disconnect</button>
              )}
              {!isGoogle && !isZoom && !isPaystack && (
                <button
                  type="button"
                  disabled={busy === provider.slug}
                  onClick={() => (connected ? disconnect(provider.slug) : apiPost(`/api/developer/integrations/${provider.slug}/connect`, { config: { enabled: true } }).then(load))}
                  className="mt-4 rounded-md bg-slate-900 px-3 py-2 text-sm text-white"
                >
                  {connected ? 'Disconnect' : 'Connect'}
                </button>
              )}
              {isGoogle && !oauth?.google && <p className="mt-2 text-xs text-amber-700">Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET on server.</p>}
              {isZoom && !oauth?.zoom && <p className="mt-2 text-xs text-amber-700">Set ZOOM_CLIENT_ID and ZOOM_CLIENT_SECRET on server.</p>}
            </article>
          )
        })}
      </div>
    </AppLayout>
  )
}

export default withAuth(IntegrationsPage, { roles: ['SchoolAdmin'] })
