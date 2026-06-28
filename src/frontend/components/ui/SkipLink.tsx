import type { ReactNode } from 'react'

export default function SkipLink({ href = '#main-content' }: { href?: string }) {
  return (
    <a
      href={href}
      className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-xl focus:bg-school-gold focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-school-navy focus:shadow-soft focus:outline-none"
    >
      Skip to main content
    </a>
  )
}
