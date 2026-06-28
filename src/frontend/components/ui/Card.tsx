import type { HTMLAttributes, ReactNode } from 'react'

type CardProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode
  variant?: 'default' | 'glass' | 'flat'
  padding?: 'none' | 'sm' | 'md' | 'lg'
}

const PADDING = {
  none: '',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
}

export default function Card({
  children,
  variant = 'default',
  padding = 'md',
  className = '',
  ...props
}: CardProps) {
  const base =
    variant === 'glass'
      ? 'glass-card'
      : variant === 'flat'
        ? 'rounded-card border border-school-border bg-school-surface'
        : 'content-card dark:border-school-border dark:bg-school-surface'

  return (
    <div className={`${base} ${PADDING[padding]} ${className}`.trim()} {...props}>
      {children}
    </div>
  )
}
