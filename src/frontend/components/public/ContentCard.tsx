import Link from 'next/link'
import type { ReactNode } from 'react'

type ContentCardProps = {
  href?: string
  badge?: string
  badgeVariant?: 'gold' | 'navy' | 'new'
  image?: ReactNode
  title: string
  excerpt: string
  meta?: string
}

const badgeClass = {
  gold: 'badge-gold',
  navy: 'badge-navy',
  new: 'badge-new',
}

export default function ContentCard({ href, badge, badgeVariant = 'gold', image, title, excerpt, meta }: ContentCardProps) {
  const inner = (
  <>
    {image && (
      <div className="relative overflow-hidden rounded-t-card bg-gradient-to-br from-school-navy to-[#142d5c]">
        {image}
      </div>
    )}
    <div className="p-6">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {badge && <span className={badgeClass[badgeVariant]}>{badge}</span>}
        {meta && <span className="text-xs text-slate-400">{meta}</span>}
      </div>
      <h3 className="font-display text-lg font-semibold text-school-navy">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">{excerpt}</p>
      {href && (
        <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-school-navy transition group-hover:gap-2">
          Read more
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
          </svg>
        </span>
      )}
    </div>
  </>
  )

  if (href) {
    return (
      <Link href={href} className="content-card group block overflow-hidden">
        {inner}
      </Link>
    )
  }
  return <article className="content-card overflow-hidden">{inner}</article>
}
