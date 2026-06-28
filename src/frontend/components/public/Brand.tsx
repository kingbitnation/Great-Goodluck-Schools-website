import Image from 'next/image'
import Link from 'next/link'

/** Official SchoolPilot brand assets (from src/img → public/brand). */
export const BRAND_ASSETS = {
  mark: '/brand/mark.png',
  wordmarkDark: '/brand/wordmark-dark.png',
  wordmarkLight: '/brand/wordmark-light.png',
  appIcon: '/brand/app-icon.png',
  primary: '/brand/primary.png',
  monochrome: '/brand/monochrome.png',
} as const

/** Brand palette */
export const BRAND_COLORS = {
  royal: '#2563EB',
  navy: '#0F172A',
  gold: '#F59E0B',
  green: '#10B981',
  light: '#F8FAFC',
} as const

const WORDMARK_HEIGHT = { sm: 36, md: 44, lg: 56 } as const
const WORDMARK_RATIO = 4.2
const MARK_SIZE = { sm: 36, md: 44, lg: 56 } as const

type LogoSize = keyof typeof WORDMARK_HEIGHT

/** Icon-only mark — favicon, compact nav. */
export function SchoolPilotMark({
  size = 'md',
  className = '',
}: {
  size?: LogoSize
  className?: string
}) {
  const px = MARK_SIZE[size]
  return (
    <Image
      src={BRAND_ASSETS.mark}
      alt=""
      width={px}
      height={px}
      className={`shrink-0 object-contain ${className}`}
      style={{ width: px, height: px }}
      priority
    />
  )
}

/** Horizontal wordmark for light or dark backgrounds. */
export function SchoolPilotWordmark({
  tone = 'dark',
  size = 'md',
  className = '',
}: {
  tone?: 'light' | 'dark'
  size?: LogoSize
  className?: string
}) {
  const height = WORDMARK_HEIGHT[size]
  const width = Math.round(height * WORDMARK_RATIO)
  const src = tone === 'light' ? BRAND_ASSETS.wordmarkLight : BRAND_ASSETS.wordmarkDark

  return (
    <Image
      src={src}
      alt="SchoolPilot"
      width={width}
      height={height}
      className={`shrink-0 object-contain object-left ${className}`}
      style={{ height: height * 1.12, width: 'auto', maxWidth: width, marginTop: -height * 0.06 }}
      priority
    />
  )
}

/** Stacked primary logo — hero cards, about page. */
export function SchoolPilotPrimaryLogo({
  size = 'lg',
  className = '',
}: {
  size?: LogoSize
  className?: string
}) {
  const height = { sm: 120, md: 160, lg: 200 }[size]
  const width = Math.round(height * 0.85)
  return (
    <Image
      src={BRAND_ASSETS.primary}
      alt="SchoolPilot"
      width={width}
      height={height}
      className={`object-contain ${className}`}
      style={{ height, width: 'auto', maxWidth: width }}
      priority
    />
  )
}

export function SchoolPilotLogo({
  light = false,
  size = 'md',
  variant,
  showTagline: _showTagline,
  className = '',
  asLink = true,
}: {
  light?: boolean
  size?: LogoSize
  variant?: 'mark' | 'wordmark' | 'primary'
  showTagline?: boolean
  className?: string
  asLink?: boolean
}) {
  const useMark = variant === 'mark' || (variant !== 'wordmark' && variant !== 'primary' && size === 'sm')
  const inner =
    variant === 'primary' ? (
      <SchoolPilotPrimaryLogo size={size} />
    ) : useMark ? (
      <SchoolPilotMark size={size} />
    ) : (
      <SchoolPilotWordmark tone={light ? 'light' : 'dark'} size={size} />
    )

  if (!asLink) {
    return <span className={`inline-flex items-center ${className}`}>{inner}</span>
  }

  return (
    <Link href="/" className={`inline-flex items-center group ${className}`} aria-label="SchoolPilot home">
      {inner}
    </Link>
  )
}

export const SchoolLogo = SchoolPilotLogo

export function SectionLabel({ children, light = false }: { children: React.ReactNode; light?: boolean }) {
  return (
    <span className={light ? 'badge border border-school-gold/30 bg-school-gold/10 text-school-gold' : 'badge-gold'}>
      {children}
    </span>
  )
}

export function SectionTitle({
  children,
  className = '',
  light = false,
  id,
}: {
  children: React.ReactNode
  className?: string
  light?: boolean
  id?: string
}) {
  return (
    <h2
      id={id}
      className={`font-display text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl ${light ? 'text-white' : 'text-school-navy dark:text-school-text'} ${className}`}
    >
      {children}
    </h2>
  )
}

export function IconMapPin({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
    </svg>
  )
}

export function IconMail({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
    </svg>
  )
}

export function IconPhone({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
    </svg>
  )
}
