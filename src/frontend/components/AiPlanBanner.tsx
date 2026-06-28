import { useEffect, useState } from 'react'
import Link from 'next/link'
import { apiGet } from '../lib/api'

type AiStatus = { enabled: boolean; provider: string; plan: string | null }

export function useAiStatus() {
  const [status, setStatus] = useState<AiStatus | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiGet<AiStatus>('/api/ai/status')
      .then(setStatus)
      .catch(() => setStatus({ enabled: false, provider: 'demo', plan: null }))
      .finally(() => setLoading(false))
  }, [])

  return { status, loading }
}

export function AiPlanBanner() {
  const { status, loading } = useAiStatus()
  if (loading || status?.enabled) return null

  return (
    <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
      AI suite requires a <strong>Premium</strong> or <strong>Enterprise</strong> plan.{' '}
      <Link href="/admin/subscription" className="font-medium underline">
        Upgrade subscription
      </Link>
    </div>
  )
}

export function AiProviderBadge({ provider }: { provider?: string }) {
  if (!provider) return null
  return (
    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
      {provider === 'openai' ? 'OpenAI' : 'Demo mode'}
    </span>
  )
}
