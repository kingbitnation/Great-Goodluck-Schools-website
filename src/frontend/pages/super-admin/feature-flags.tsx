import { useEffect, useState } from 'react'
import AppLayout from '../../components/layout/AppLayout'
import { withAuth } from '../../components/withAuth'
import { apiGet, apiPut } from '../../lib/api'
import type { AuthUser } from '../../lib/useAuth'

type Flag = {
  id: string
  key: string
  label: string
  description?: string
  enabled: boolean
  planSlugs: string[]
}

function FeatureFlagsPage({ user }: { user: AuthUser }) {
  const [flags, setFlags] = useState<Flag[]>([])
  const [error, setError] = useState<string | null>(null)

  function load() {
    apiGet<Flag[]>('/api/platform/feature-flags').then(setFlags).catch((e) => setError(e.message))
  }

  useEffect(() => { load() }, [])

  async function toggle(flag: Flag) {
    await apiPut(`/api/platform/feature-flags/${flag.id}`, { enabled: !flag.enabled })
    load()
  }

  return (
    <AppLayout user={user} title="Feature Flags">
      <p className="mb-6 text-sm text-gray-600">
        Enable or disable platform modules globally. Empty plan list = all plans when enabled.
      </p>
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      <ul className="space-y-3">
        {flags.map((flag) => (
          <li key={flag.id} className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <div>
              <p className="font-medium text-gray-900">{flag.label}</p>
              <p className="text-xs text-gray-500">{flag.key}</p>
              {flag.description && <p className="mt-1 text-sm text-gray-600">{flag.description}</p>}
            </div>
            <button
              type="button"
              onClick={() => toggle(flag)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium ${flag.enabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}
              aria-pressed={flag.enabled}
            >
              {flag.enabled ? 'On' : 'Off'}
            </button>
          </li>
        ))}
      </ul>
    </AppLayout>
  )
}

export default withAuth(FeatureFlagsPage, { roles: ['SuperAdmin'] })
