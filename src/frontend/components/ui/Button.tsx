import type { ButtonHTMLAttributes, ReactNode } from 'react'
import type { ButtonSize, ButtonVariant } from '../../lib/design-tokens'

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'btn-primary',
  secondary: 'btn-navy',
  outline:
    'inline-flex items-center justify-center rounded-pill border-2 border-school-border bg-school-surface px-7 py-3 text-sm font-semibold text-school-text shadow-soft transition hover:bg-school-muted/10 disabled:opacity-50',
  ghost:
    'inline-flex items-center justify-center rounded-pill px-4 py-2 text-sm font-medium text-school-muted transition hover:bg-school-muted/10 hover:text-school-text disabled:opacity-50',
  danger:
    'inline-flex items-center justify-center rounded-pill bg-red-600 px-7 py-3 text-sm font-semibold text-white shadow-soft transition hover:bg-red-700 disabled:opacity-50',
}

const SIZES: Record<ButtonSize, string> = {
  sm: '!px-4 !py-2 text-xs',
  md: '',
  lg: '!px-8 !py-3.5 text-base',
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: ButtonSize
  children: ReactNode
}

export default function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type="button"
      className={`${VARIANTS[variant]} ${SIZES[size]} ${className}`.trim()}
      {...props}
    >
      {children}
    </button>
  )
}
