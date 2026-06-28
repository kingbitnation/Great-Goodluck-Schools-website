import Link from 'next/link'
import { useEffect, useState } from 'react'
import PublicLayout from '../components/layout/PublicLayout'
import ContentCard from '../components/public/ContentCard'
import Reveal from '../components/public/Reveal'
import { fetchPublic, type PublicPost } from '../lib/publicApi'

function badgeVariant(badge?: string | null): 'new' | 'gold' | 'navy' {
  if (badge === 'Important') return 'gold'
  if (badge === 'Update') return 'navy'
  return 'new'
}

export default function NewsPage() {
  const [posts, setPosts] = useState<PublicPost[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchPublic<PublicPost[]>('/api/public/posts?type=news')
      .then(setPosts)
      .finally(() => setLoading(false))
  }, [])

  return (
    <PublicLayout title="News" subtitle="Latest announcements and updates">
      {loading ? (
        <p className="text-slate-500">Loading...</p>
      ) : posts.length === 0 ? (
        <p className="text-slate-600">No news posts yet.</p>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2">
          {posts.map((p, i) => (
            <Reveal key={p.id} delay={i * 100}>
              <ContentCard
                href={`/blog/${p.slug}`}
                badge={p.badge || 'News'}
                badgeVariant={badgeVariant(p.badge)}
                title={p.title}
                excerpt={p.excerpt || ''}
                meta={new Date(p.publishedAt).toLocaleDateString()}
                image={<div className="flex h-36 items-center justify-center text-4xl">{p.icon || '📢'}</div>}
              />
            </Reveal>
          ))}
        </div>
      )}
      <p className="mt-8 text-center text-sm text-slate-500">
        <Link href="/blog" className="font-semibold text-school-navy hover:text-school-gold">Browse all articles →</Link>
      </p>
    </PublicLayout>
  )
}
