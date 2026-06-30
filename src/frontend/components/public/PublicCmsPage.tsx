import { useEffect, useState } from 'react'
import PublicLayout from '../layout/PublicLayout'
import Reveal from './Reveal'
import { fetchPublic, type PublicPage } from '../../lib/publicApi'
import { PUBLIC_PAGE_FALLBACKS } from '../../lib/publicPageFallbacks'

type PublicCmsPageProps = {
  slug: string
  fallbackTitle: string
  fallbackSubtitle?: string
  children?: (page: PublicPage) => React.ReactNode
}

export function usePublicPage(slug: string) {
  const [page, setPage] = useState<PublicPage | null>(null)
  const [loading, setLoading] = useState(true)
  const [usedFallback, setUsedFallback] = useState(false)

  useEffect(() => {
    fetchPublic<PublicPage>(`/api/public/pages/${slug}`)
      .then(setPage)
      .catch(() => {
        const fallback = PUBLIC_PAGE_FALLBACKS[slug]
        if (fallback) {
          setPage(fallback)
          setUsedFallback(true)
        }
      })
      .finally(() => setLoading(false))
  }, [slug])

  return { page, loading, usedFallback }
}

export default function PublicCmsPage({ slug, fallbackTitle, fallbackSubtitle, children }: PublicCmsPageProps) {
  const { page, loading, usedFallback } = usePublicPage(slug)

  if (loading) {
    return (
      <PublicLayout title={fallbackTitle} subtitle={fallbackSubtitle}>
        <p className="text-school-muted">Loading…</p>
      </PublicLayout>
    )
  }

  if (!page) {
    return (
      <PublicLayout title={fallbackTitle} subtitle={fallbackSubtitle}>
        <p className="text-school-muted">Content not available.</p>
      </PublicLayout>
    )
  }

  const title = page.title || fallbackTitle
  const subtitle = page.subtitle || fallbackSubtitle

  if (children) {
    return (
      <PublicLayout title={title} subtitle={subtitle}>
        {usedFallback && (
          <p className="mb-6 rounded-lg border border-school-border bg-school-surface px-4 py-3 text-sm text-school-muted">
            Showing default school information. Your admin can customise this page under Website CMS.
          </p>
        )}
        {children(page)}
      </PublicLayout>
    )
  }

  return (
    <PublicLayout title={title} subtitle={subtitle}>
      {usedFallback && (
        <p className="mb-6 rounded-lg border border-school-border bg-school-surface px-4 py-3 text-sm text-school-muted">
          Showing default school information. Your admin can customise this page under Website CMS.
        </p>
      )}
      <Reveal>
        <div className="glass-card max-w-3xl rounded-3xl p-8 sm:p-10">
          <div className="space-y-4 leading-relaxed text-slate-600 dark:text-slate-300">
            {(page.body.paragraphs || []).map((p) => (
              <p key={p.slice(0, 48)}>{p}</p>
            ))}
          </div>
          {page.body.bullets && page.body.bullets.length > 0 && (
            <ul className="mt-8 space-y-3 border-t border-school-border pt-8">
              {page.body.bullets.map((b) => (
                <li key={b} className="flex gap-3 text-slate-700 dark:text-slate-200">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-school-gold/20 text-xs font-bold text-amber-800 dark:text-school-gold">✓</span>
                  {b}
                </li>
              ))}
            </ul>
          )}
        </div>
      </Reveal>
    </PublicLayout>
  )
}
