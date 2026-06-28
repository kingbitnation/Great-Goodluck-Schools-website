import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import PublicLayout from '../../components/layout/PublicLayout'
import { fetchPublic, type PublicPost } from '../../lib/publicApi'

export default function BlogPostPage() {
  const router = useRouter()
  const { slug } = router.query
  const [post, setPost] = useState<PublicPost | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!slug || typeof slug !== 'string') return
    fetchPublic<PublicPost>(`/api/public/posts/${slug}`)
      .then(setPost)
      .catch(() => setPost(null))
      .finally(() => setLoading(false))
  }, [slug])

  if (loading) {
    return (
      <PublicLayout title="Article" subtitle="">
        <p className="text-slate-500">Loading...</p>
      </PublicLayout>
    )
  }

  if (!post) {
    return (
      <PublicLayout title="Not found" subtitle="">
        <p className="text-slate-600">Article not found.</p>
      </PublicLayout>
    )
  }

  return (
    <PublicLayout title={post.title} subtitle={post.author || 'School News'}>
      <article className="max-w-3xl prose prose-slate">
        <p className="text-sm text-gray-500">{new Date(post.publishedAt).toLocaleDateString()}</p>
        <div className="mt-6 whitespace-pre-wrap leading-relaxed text-slate-700">{post.body}</div>
      </article>
    </PublicLayout>
  )
}
