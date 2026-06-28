import { useEffect, useState } from 'react'
import { withAuth } from '../../components/withAuth'
import AppLayout from '../../components/layout/AppLayout'
import { Card } from '../../components/ui'
import { apiDelete, apiGet, apiPost, apiPut } from '../../lib/api'
import type { AuthUser } from '../../lib/useAuth'

type Tab = 'posts' | 'events' | 'gallery' | 'staff' | 'pages' | 'stats' | 'newsletter'

const CMS_PAGES = [
  { slug: 'about', label: 'About' },
  { slug: 'mission', label: 'Mission' },
  { slug: 'vision', label: 'Vision' },
  { slug: 'faq', label: 'FAQ' },
  { slug: 'privacy', label: 'Privacy' },
  { slug: 'principal-message', label: 'Principal message' },
]

function WebsiteCmsPage({ user }: { user: AuthUser }) {
  const [tab, setTab] = useState<Tab>('posts')
  const [summary, setSummary] = useState<Record<string, number> | null>(null)
  const [posts, setPosts] = useState<any[]>([])
  const [events, setEvents] = useState<any[]>([])
  const [gallery, setGallery] = useState<any[]>([])
  const [staff, setStaff] = useState<any[]>([])
  const [stats, setStats] = useState<any[]>([])
  const [subscribers, setSubscribers] = useState<any[]>([])
  const [pageSlug, setPageSlug] = useState('about')
  const [pageForm, setPageForm] = useState({ title: '', subtitle: '', body: '' })
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const [postForm, setPostForm] = useState({
    title: '', body: '', excerpt: '', postType: 'news', author: '', imageUrl: '', published: true,
  })
  const [eventForm, setEventForm] = useState({
    title: '', description: '', venue: '', category: 'General', eventDate: '', published: true,
  })
  const [galleryForm, setGalleryForm] = useState({
    title: '', caption: '', imageUrl: '', colorClass: 'from-blue-500 to-cyan-500', published: true,
  })
  const [staffForm, setStaffForm] = useState({
    fullName: '', roleTitle: '', department: '', photoUrl: '', published: true,
  })

  useEffect(() => {
    loadAll()
  }, [])

  useEffect(() => {
    if (tab === 'pages') loadPage(pageSlug)
  }, [tab, pageSlug])

  async function loadAll() {
    try {
      setLoading(true)
      const [s, p, e, g, st, subs] = await Promise.all([
        apiGet<Record<string, number>>('/api/admin/website/summary'),
        apiGet<any[]>('/api/admin/website/posts'),
        apiGet<any[]>('/api/admin/website/events'),
        apiGet<any[]>('/api/admin/website/gallery'),
        apiGet<any[]>('/api/admin/website/staff'),
        apiGet<any[]>('/api/admin/website/newsletter'),
      ])
      setSummary(s)
      setPosts(p)
      setEvents(e)
      setGallery(g)
      setStaff(st)
      setSubscribers(subs)
      const statRows = await apiGet<any[]>('/api/admin/website/stats')
      setStats(statRows)
    } catch {
      setError('Failed to load website content')
    } finally {
      setLoading(false)
    }
  }

  async function loadPage(slug: string) {
    try {
      const pages = await apiGet<any[]>('/api/admin/website/pages')
      const page = pages.find((p) => p.slug === slug)
      if (page) {
        setPageForm({
          title: page.title || '',
          subtitle: page.subtitle || '',
          body: typeof page.body === 'string' ? page.body : JSON.stringify(page.body, null, 2),
        })
      } else {
        setPageForm({ title: CMS_PAGES.find((p) => p.slug === slug)?.label || slug, subtitle: '', body: '' })
      }
    } catch {
      setError('Failed to load page')
    }
  }

  async function savePost(e: React.FormEvent) {
    e.preventDefault()
    try {
      await apiPost('/api/admin/website/posts', postForm)
      setPostForm({ title: '', body: '', excerpt: '', postType: 'news', author: '', imageUrl: '', published: true })
      setMessage('Post published')
      loadAll()
    } catch {
      setError('Failed to save post')
    }
  }

  async function saveEvent(e: React.FormEvent) {
    e.preventDefault()
    try {
      await apiPost('/api/admin/website/events', eventForm)
      setEventForm({ title: '', description: '', venue: '', category: 'General', eventDate: '', published: true })
      setMessage('Event saved')
      loadAll()
    } catch {
      setError('Failed to save event')
    }
  }

  async function saveGallery(e: React.FormEvent) {
    e.preventDefault()
    try {
      await apiPost('/api/admin/website/gallery', galleryForm)
      setGalleryForm({ title: '', caption: '', imageUrl: '', colorClass: 'from-blue-500 to-cyan-500', published: true })
      setMessage('Gallery item added')
      loadAll()
    } catch {
      setError('Failed to save gallery item')
    }
  }

  async function saveStaff(e: React.FormEvent) {
    e.preventDefault()
    try {
      await apiPost('/api/admin/website/staff', staffForm)
      setStaffForm({ fullName: '', roleTitle: '', department: '', photoUrl: '', published: true })
      setMessage('Staff member added')
      loadAll()
    } catch {
      setError('Failed to save staff member')
    }
  }

  async function savePage(e: React.FormEvent) {
    e.preventDefault()
    try {
      let body: unknown = pageForm.body
      try {
        body = JSON.parse(pageForm.body)
      } catch {
        body = { content: pageForm.body }
      }
      await apiPut(`/api/admin/website/pages/${pageSlug}`, { ...pageForm, body })
      setMessage('Page saved')
    } catch {
      setError('Failed to save page')
    }
  }

  async function saveStats(e: React.FormEvent) {
    e.preventDefault()
    try {
      await apiPut('/api/admin/website/stats', { stats })
      setMessage('Homepage stats updated')
    } catch {
      setError('Failed to save stats')
    }
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'posts', label: 'News & Blog' },
    { id: 'events', label: 'Events' },
    { id: 'gallery', label: 'Gallery' },
    { id: 'staff', label: 'Staff' },
    { id: 'pages', label: 'Pages' },
    { id: 'stats', label: 'Home stats' },
    { id: 'newsletter', label: 'Newsletter' },
  ]

  return (
    <AppLayout user={user} title="Website CMS">
      <p className="mb-6 text-sm text-school-muted">
        Manage your public website content — news, events, gallery, staff profiles, CMS pages, and homepage statistics.
      </p>

      {message && <div className="mb-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">{message}</div>}
      {error && <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{error}</div>}

      {summary && (
        <div className="mb-6 grid gap-4 sm:grid-cols-4 lg:grid-cols-7">
          {Object.entries(summary).map(([key, value]) => (
            <Card key={key} padding="sm" className="text-center">
              <p className="text-2xl font-bold text-school-navy dark:text-school-gold">{value}</p>
              <p className="text-xs uppercase tracking-wide text-school-muted">{key}</p>
            </Card>
          ))}
        </div>
      )}

      <div className="mb-6 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => { setTab(t.id); setMessage(''); setError('') }}
            className={`rounded-pill px-4 py-2 text-sm font-medium transition ${
              tab === t.id ? 'bg-school-navy text-white' : 'bg-school-muted/10 text-school-text hover:bg-school-muted/20'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-school-muted">Loading…</p>
      ) : (
        <>
          {tab === 'posts' && (
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <h2 className="font-display text-lg font-semibold">New post</h2>
                <form onSubmit={savePost} className="mt-4 space-y-3">
                  <select value={postForm.postType} onChange={(e) => setPostForm({ ...postForm, postType: e.target.value })} className="w-full">
                    <option value="news">News</option>
                    <option value="blog">Blog</option>
                  </select>
                  <input placeholder="Title" value={postForm.title} onChange={(e) => setPostForm({ ...postForm, title: e.target.value })} className="w-full" required />
                  <input placeholder="Author" value={postForm.author} onChange={(e) => setPostForm({ ...postForm, author: e.target.value })} className="w-full" />
                  <input placeholder="Image URL" value={postForm.imageUrl} onChange={(e) => setPostForm({ ...postForm, imageUrl: e.target.value })} className="w-full" />
                  <textarea placeholder="Excerpt" value={postForm.excerpt} onChange={(e) => setPostForm({ ...postForm, excerpt: e.target.value })} className="w-full" rows={2} />
                  <textarea placeholder="Body" value={postForm.body} onChange={(e) => setPostForm({ ...postForm, body: e.target.value })} className="w-full" rows={6} required />
                  <button type="submit" className="btn-primary">Publish post</button>
                </form>
              </Card>
              <Card>
                <h2 className="font-display text-lg font-semibold">Existing posts ({posts.length})</h2>
                <ul className="mt-4 max-h-[32rem] space-y-2 overflow-y-auto">
                  {posts.map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-2 rounded-xl border border-school-border p-3 text-sm">
                      <div>
                        <p className="font-medium">{p.title}</p>
                        <p className="text-school-muted">{p.postType} · {p.published ? 'Published' : 'Draft'}</p>
                      </div>
                      <button type="button" className="text-red-600 hover:underline" onClick={async () => { await apiDelete(`/api/admin/website/posts/${p.id}`); loadAll() }}>Delete</button>
                    </li>
                  ))}
                </ul>
              </Card>
            </div>
          )}

          {tab === 'events' && (
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <h2 className="font-display text-lg font-semibold">New event</h2>
                <form onSubmit={saveEvent} className="mt-4 space-y-3">
                  <input placeholder="Title" value={eventForm.title} onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })} className="w-full" required />
                  <input type="datetime-local" value={eventForm.eventDate} onChange={(e) => setEventForm({ ...eventForm, eventDate: e.target.value })} className="w-full" required />
                  <input placeholder="Venue" value={eventForm.venue} onChange={(e) => setEventForm({ ...eventForm, venue: e.target.value })} className="w-full" />
                  <textarea placeholder="Description" value={eventForm.description} onChange={(e) => setEventForm({ ...eventForm, description: e.target.value })} className="w-full" rows={4} />
                  <button type="submit" className="btn-primary">Save event</button>
                </form>
              </Card>
              <Card>
                <h2 className="font-display text-lg font-semibold">Events ({events.length})</h2>
                <ul className="mt-4 space-y-2">
                  {events.map((ev) => (
                    <li key={ev.id} className="flex justify-between rounded-xl border border-school-border p-3 text-sm">
                      <span>{ev.title} — {new Date(ev.eventDate).toLocaleString()}</span>
                      <button type="button" className="text-red-600" onClick={async () => { await apiDelete(`/api/admin/website/events/${ev.id}`); loadAll() }}>Delete</button>
                    </li>
                  ))}
                </ul>
              </Card>
            </div>
          )}

          {tab === 'gallery' && (
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <h2 className="font-display text-lg font-semibold">Add gallery item</h2>
                <form onSubmit={saveGallery} className="mt-4 space-y-3">
                  <input placeholder="Title" value={galleryForm.title} onChange={(e) => setGalleryForm({ ...galleryForm, title: e.target.value })} className="w-full" required />
                  <input placeholder="Image URL" value={galleryForm.imageUrl} onChange={(e) => setGalleryForm({ ...galleryForm, imageUrl: e.target.value })} className="w-full" />
                  <input placeholder="Caption" value={galleryForm.caption} onChange={(e) => setGalleryForm({ ...galleryForm, caption: e.target.value })} className="w-full" />
                  <button type="submit" className="btn-primary">Add item</button>
                </form>
              </Card>
              <Card>
                <h2 className="font-display text-lg font-semibold">Gallery ({gallery.length})</h2>
                <ul className="mt-4 space-y-2">
                  {gallery.map((g) => (
                    <li key={g.id} className="flex justify-between rounded-xl border border-school-border p-3 text-sm">
                      <span>{g.title}</span>
                      <button type="button" className="text-red-600" onClick={async () => { await apiDelete(`/api/admin/website/gallery/${g.id}`); loadAll() }}>Delete</button>
                    </li>
                  ))}
                </ul>
              </Card>
            </div>
          )}

          {tab === 'staff' && (
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <h2 className="font-display text-lg font-semibold">Add staff member</h2>
                <form onSubmit={saveStaff} className="mt-4 space-y-3">
                  <input placeholder="Full name" value={staffForm.fullName} onChange={(e) => setStaffForm({ ...staffForm, fullName: e.target.value })} className="w-full" required />
                  <input placeholder="Role title" value={staffForm.roleTitle} onChange={(e) => setStaffForm({ ...staffForm, roleTitle: e.target.value })} className="w-full" required />
                  <input placeholder="Department" value={staffForm.department} onChange={(e) => setStaffForm({ ...staffForm, department: e.target.value })} className="w-full" />
                  <input placeholder="Photo URL" value={staffForm.photoUrl} onChange={(e) => setStaffForm({ ...staffForm, photoUrl: e.target.value })} className="w-full" />
                  <button type="submit" className="btn-primary">Add staff</button>
                </form>
              </Card>
              <Card>
                <h2 className="font-display text-lg font-semibold">Staff ({staff.length})</h2>
                <ul className="mt-4 space-y-2">
                  {staff.map((m) => (
                    <li key={m.id} className="flex justify-between rounded-xl border border-school-border p-3 text-sm">
                      <span>{m.fullName} — {m.roleTitle}</span>
                      <button type="button" className="text-red-600" onClick={async () => { await apiDelete(`/api/admin/website/staff/${m.id}`); loadAll() }}>Delete</button>
                    </li>
                  ))}
                </ul>
              </Card>
            </div>
          )}

          {tab === 'pages' && (
            <Card>
              <div className="mb-4 flex flex-wrap gap-2">
                {CMS_PAGES.map((p) => (
                  <button key={p.slug} type="button" onClick={() => setPageSlug(p.slug)} className={`rounded-pill px-3 py-1.5 text-sm ${pageSlug === p.slug ? 'bg-school-gold/20 text-amber-900' : 'bg-school-muted/10'}`}>
                    {p.label}
                  </button>
                ))}
              </div>
              <form onSubmit={savePage} className="space-y-3">
                <input placeholder="Title" value={pageForm.title} onChange={(e) => setPageForm({ ...pageForm, title: e.target.value })} className="w-full" required />
                <input placeholder="Subtitle" value={pageForm.subtitle} onChange={(e) => setPageForm({ ...pageForm, subtitle: e.target.value })} className="w-full" />
                <textarea placeholder="Body (text or JSON)" value={pageForm.body} onChange={(e) => setPageForm({ ...pageForm, body: e.target.value })} className="w-full font-mono text-xs" rows={12} required />
                <button type="submit" className="btn-primary">Save page</button>
              </form>
            </Card>
          )}

          {tab === 'stats' && (
            <Card>
              <h2 className="font-display text-lg font-semibold">Homepage statistics</h2>
              <form onSubmit={saveStats} className="mt-4 space-y-3">
                {stats.map((s, i) => (
                  <div key={s.id || i} className="grid gap-2 sm:grid-cols-2">
                    <input value={s.label} onChange={(e) => setStats(stats.map((row, idx) => idx === i ? { ...row, label: e.target.value } : row))} className="w-full" />
                    <input value={s.value} onChange={(e) => setStats(stats.map((row, idx) => idx === i ? { ...row, value: e.target.value } : row))} className="w-full" />
                  </div>
                ))}
                <button type="button" className="btn-outline !text-school-text" onClick={() => setStats([...stats, { label: 'New stat', value: '0', sortOrder: stats.length }])}>Add stat</button>
                <button type="submit" className="btn-primary block">Save stats</button>
              </form>
            </Card>
          )}

          {tab === 'newsletter' && (
            <Card>
              <h2 className="font-display text-lg font-semibold">Newsletter subscribers ({subscribers.length})</h2>
              <ul className="mt-4 max-h-96 space-y-2 overflow-y-auto text-sm">
                {subscribers.map((s) => (
                  <li key={s.id} className="flex justify-between rounded-xl border border-school-border px-3 py-2">
                    <span>{s.email}{s.name ? ` (${s.name})` : ''}</span>
                    <span className="text-school-muted">{new Date(s.createdAt).toLocaleDateString()}</span>
                  </li>
                ))}
                {subscribers.length === 0 && <p className="text-school-muted">No subscribers yet.</p>}
              </ul>
            </Card>
          )}
        </>
      )}
    </AppLayout>
  )
}

export default withAuth(WebsiteCmsPage, { roles: ['SuperAdmin', 'SchoolAdmin'] })
