import { useEffect, useState } from 'react'
import PublicLayout from '../components/layout/PublicLayout'
import { fetchPublic, type PublicPost } from '../lib/publicApi'

export default function BlogPage() {
  const [posts, setPosts] = useState<PublicPost[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchPublic<PublicPost[]>('/api/public/posts?type=blog')
      .then(setPosts)
      .finally(() => setLoading(false))
  }, [])

  return (
    <PublicLayout title="Blog" subtitle="Insights from our school community">
      {loading ? (
        <p className="text-slate-500">Loading...</p>
      ) : posts.length === 0 ? (
        <p className="text-slate-600">No blog posts yet.</p>
      ) : (
        <div className="space-y-8 max-w-3xl">
          {posts.map((p) => (
            <article key={p.id}>
              <h2 className="text-xl font-semibold">{p.title}</h2>
              <p className="text-sm text-gray-500 mt-1">
                By {p.author || 'School Admin'} · {new Date(p.publishedAt).toLocaleDateString()}
              </p>
              <p className="mt-3 text-gray-700 dark:text-gray-300 leading-relaxed">{p.excerpt || p.body}</p>
            </article>
          ))}
        </div>
      )}
    </PublicLayout>
  )
}
