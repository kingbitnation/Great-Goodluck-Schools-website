import { apiBaseUrl } from './apiBase'

export type PublicSchool = {
  id: string
  name: string
  address?: string | null
  city?: string | null
  state?: string | null
  country?: string | null
  contactEmail?: string | null
  contactPhone?: string | null
  website?: string | null
  logo?: string | null
}

export type PublicPost = {
  id: string
  slug: string
  postType: string
  title: string
  excerpt?: string | null
  body: string
  author?: string | null
  badge?: string | null
  icon?: string | null
  publishedAt: string
}

export type PublicEvent = {
  id: string
  title: string
  description?: string | null
  venue?: string | null
  category?: string | null
  eventDate: string
  dateLabel: string
  monthShort: string
  dayNum: number
  badge: string
}

export type PublicGalleryItem = {
  id: string
  title: string
  caption?: string | null
  imageUrl?: string | null
  colorClass: string
}

export type PublicStaff = {
  id: string
  name: string
  role: string
  dept?: string | null
  photoUrl?: string | null
}

export type PublicPageBody = {
  paragraphs?: string[]
  bullets?: string[]
  values?: { title: string; desc: string }[]
  vision?: string
  mission?: string
  faqs?: { q: string; a: string }[]
  requirements?: string[]
  highlight?: { title: string; desc: string }
  features?: { title: string; desc: string }[]
  principal?: { name: string; title: string; initials: string; paragraphs: string[] }
}

export type PublicPage = {
  slug: string
  title: string
  subtitle?: string | null
  body: PublicPageBody
}

export type HomeData = {
  school: PublicSchool
  stats: { label: string; value: string }[]
  featuredNews: PublicPost[]
  featuredEvents: PublicEvent[]
  features: { title: string; desc: string }[]
  principal?: PublicPage | null
}

export async function fetchPublic<T>(path: string, schoolId?: string): Promise<T> {
  const url = new URL(`${apiBaseUrl()}${path}`, typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000')
  if (schoolId) url.searchParams.set('schoolId', schoolId)
  const res = await fetch(url.toString())
  if (!res.ok) throw new Error(`Public API error: ${path}`)
  return res.json()
}
