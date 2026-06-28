/** SchoolPilot design system — official palette */
export const tokens = {
  colors: {
    royal: '#2563EB',
    navy: '#0F172A',
    gold: '#F59E0B',
    green: '#10B981',
    light: {
      bg: '#F8FAFC',
      surface: '#FFFFFF',
      text: '#0F172A',
      muted: '#64748B',
      border: '#E2E8F0',
    },
    dark: {
      bg: '#0F172A',
      surface: '#1E293B',
      text: '#F8FAFC',
      muted: '#94A3B8',
      border: '#334155',
    },
  },
  radius: { card: '16px', pill: '9999px' },
  font: {
    sans: 'Sora, Inter, system-ui, sans-serif',
    display: 'Sora, Inter, system-ui, sans-serif',
  },
} as const

export type PlanSlug = 'starter' | 'standard' | 'professional' | 'enterprise' | 'ultimate'
export type BillingInterval = 'monthly' | 'quarterly' | 'yearly'

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
export type ButtonSize = 'sm' | 'md' | 'lg'
