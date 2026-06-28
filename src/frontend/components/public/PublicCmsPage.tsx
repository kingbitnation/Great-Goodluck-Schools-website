import { useEffect, useState } from 'react'
import PublicLayout from '../layout/PublicLayout'
import Reveal from './Reveal'
import { fetchPublic, type PublicPage } from '../../lib/publicApi'

type PublicCmsPageProps = {
  slug: string
  fallbackTitle: string
  fallbackSubtitle?: string
  children?: (page: PublicPage) => React.ReactNode
}

export function usePublicPage(slug: string) {
  const [page, setPage] = useState<PublicPage | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    fetchPublic<PublicPage>(`/api/public/pages/${slug}`)
      .then(setPage)
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [slug])

  return { page, loading, error }
}

export default function PublicCmsPage({ slug, fallbackTitle, fallbackSubtitle, children }: PublicCmsPageProps) {
  const { page, loading, error } = usePublicPage(slug)

  if (loading) {
    return (
      <PublicLayout title={fallbackTitle} subtitle={fallbackSubtitle}>
        <p className="text-slate-500">Loading...</p>
      </PublicLayout>
    )
  }

  if (error || !page) {
    return (
      <PublicLayout title={fallbackTitle} subtitle={fallbackSubtitle}>
        <p className="text-slate-500">Content not available.</p>
      </PublicLayout>
    )
  }

  if (children) {
    return (
      <PublicLayout title={page.title} subtitle={page.subtitle || undefined}>
        {children(page)}
      </PublicLayout>
    )
  }

  return (
    <PublicLayout title={page.title} subtitle={page.subtitle || undefined}>
      <Reveal>
        <div className="glass-card max-w-3xl rounded-3xl p-8 sm:p-10">
          <div className="space-y-4 leading-relaxed text-slate-600">
            {(page.body.paragraphs || []).map((p) => (
              <p key={p.slice(0, 48)}>{p}</p>
            ))}
          </div>
          {page.body.bullets && page.body.bullets.length > 0 && (
            <ul className="mt-8 space-y-3 border-t border-slate-100 pt-8">
              {page.body.bullets.map((b) => (
                <li key={b} className="flex gap-3 text-slate-700">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-school-gold/20 text-xs font-bold text-amber-800">✓</span>
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
