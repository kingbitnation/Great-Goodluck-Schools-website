import type { ReactNode } from 'react'

type BadgeTone = 'gold' | 'navy' | 'success' | 'warning' | 'neutral'

const TONES: Record<BadgeTone, string> = {
  gold: 'badge-gold',
  navy: 'badge-navy',
  success: 'badge-new',
  warning: 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300',
  neutral: 'bg-school-muted/15 text-school-muted',
}

export default function Badge({
  children,
  tone = 'gold',
  className = '',
}: {
  children: ReactNode
  tone?: BadgeTone
  className?: string
}) {
  return (
    <span className={`badge ${TONES[tone]} ${className}`.trim()}>
      {children}
    </span>
  )
}
