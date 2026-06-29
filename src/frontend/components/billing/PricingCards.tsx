import Link from 'next/link'
import type { BillingInterval } from '../../lib/design-tokens'

export type Plan = {
  id: string
  name: string
  slug: string
  price: number
  quarterlyPrice?: number | null
  yearlyPrice?: number | null
  maxStudents: number | null
  isPopular?: boolean
  contactSales?: boolean
  planFeatures?: Array<{ key: string; label: string }>
  limits?: Record<string, boolean>
}

function priceFor(plan: Plan, interval: BillingInterval) {
  if (plan.contactSales) return null
  if (interval === 'yearly' && plan.yearlyPrice) return plan.yearlyPrice
  if (interval === 'quarterly' && plan.quarterlyPrice) return plan.quarterlyPrice
  return plan.price
}

const INTERVAL_LABEL = { monthly: 'mo', quarterly: 'qtr', yearly: 'yr' }

export default function PricingCards({
  plans,
  interval,
  currentSlug,
  onSelect,
  showCta = true,
  layout = 'pricing',
}: {
  plans: Plan[]
  interval: BillingInterval
  currentSlug?: string
  onSelect?: (slug: string) => void
  showCta?: boolean
  layout?: 'pricing' | 'register'
}) {
  const isRegister = layout === 'register'
  const featureLimit = isRegister ? 4 : 8

  return (
    <div
      className={
        isRegister
          ? 'grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3'
          : 'grid gap-6 md:grid-cols-2 lg:grid-cols-5'
      }
    >
      {plans.map((plan) => {
        const amount = priceFor(plan, interval)
        const isCurrent = currentSlug === plan.slug
        const features = (plan.planFeatures || []).slice(0, featureLimit)

        const pricingCardClass = !isRegister
          ? plan.isPopular
            ? 'border-school-royal/40 bg-gradient-to-b from-school-royal/5 to-white shadow-royal hover:-translate-y-2 hover:shadow-royal z-10 scale-[1.02]'
            : 'border-school-border/60 bg-school-surface hover:-translate-y-1 hover:border-school-royal/20 hover:shadow-soft-lg'
          : plan.isPopular
            ? 'border-school-royal ring-2 ring-school-royal/20'
            : 'border-school-border'

        return (
          <div
            key={plan.id}
            className={`relative flex h-full min-w-0 flex-col rounded-2xl border shadow-soft transition duration-300 dark:bg-school-surface ${
              isRegister ? 'bg-white p-4 sm:p-5' : `p-6 ${pricingCardClass}`
            } ${isCurrent ? 'ring-2 ring-school-gold' : ''}`}
          >
            {plan.isPopular && (
              <span className={`absolute -top-3 left-1/2 max-w-[90%] -translate-x-1/2 truncate rounded-full px-3 py-0.5 text-xs font-bold uppercase tracking-wide text-white ${
                isRegister ? 'bg-school-royal' : 'bg-gradient-to-r from-school-royal to-blue-600 shadow-soft'
              }`}>
                Most Popular
              </span>
            )}
            <h3 className="break-words font-display text-base font-bold text-school-navy sm:text-lg dark:text-white">
              {plan.name}
            </h3>
            <div className={`${isRegister ? 'mt-2 min-h-[2.5rem]' : 'mt-3 min-h-[3rem]'}`}>
              {plan.contactSales ? (
                <p className="text-xl font-bold text-school-royal sm:text-2xl">Contact Sales</p>
              ) : (
                <p className="break-words text-2xl font-bold leading-tight text-school-navy sm:text-3xl dark:text-white">
                  ₦{amount?.toLocaleString()}
                  <span className="text-xs font-normal text-slate-500 sm:text-sm">/{INTERVAL_LABEL[interval]}</span>
                </p>
              )}
            </div>
            <p className="mt-2 break-words text-xs text-slate-500 sm:text-sm">
              {plan.maxStudents ? `Up to ${plan.maxStudents.toLocaleString()} students` : 'Unlimited students'}
            </p>
            <ul className={`mt-3 flex-1 space-y-1.5 ${isRegister ? 'text-xs' : 'text-sm'} text-slate-600 dark:text-slate-300`}>
              {features.map((f) => (
                <li key={f.key} className="flex items-start gap-2">
                  <svg
                    className="mt-0.5 h-3.5 w-3.5 shrink-0 text-school-green sm:h-4 sm:w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2.5}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="min-w-0 break-words leading-snug">{f.label}</span>
                </li>
              ))}
              {(plan.planFeatures?.length || 0) > featureLimit && (
                <li className="text-xs text-school-royal">
                  +{(plan.planFeatures?.length || 0) - featureLimit} more features
                </li>
              )}
            </ul>
            {showCta || onSelect ? (
              plan.contactSales ? (
                <Link href="/contact" className="btn-royal mt-4 w-full text-center text-sm sm:mt-6">
                  Contact Sales
                </Link>
              ) : onSelect ? (
                <button
                  type="button"
                  onClick={() => onSelect(plan.slug)}
                  className={`mt-4 w-full text-sm sm:mt-6 ${isCurrent ? 'btn-gold' : plan.isPopular ? 'btn-royal' : 'btn-navy'}`}
                >
                  {isCurrent ? 'Selected' : 'Select plan'}
                </button>
              ) : (
                <Link
                  href={`/register-school?plan=${plan.slug}`}
                  className={`mt-6 w-full text-center text-sm ${plan.isPopular ? 'btn-royal' : 'btn-navy'}`}
                >
                  Get started
                </Link>
              )
            ) : null}
          </div>
        )
      })}
    </div>
  )
}

export function BillingIntervalToggle({
  value,
  onChange,
  compact = false,
  variant = 'light',
}: {
  value: BillingInterval
  onChange: (v: BillingInterval) => void
  compact?: boolean
  variant?: 'light' | 'dark'
}) {
  const options: BillingInterval[] = ['monthly', 'quarterly', 'yearly']
  const isDark = variant === 'dark'
  return (
    <div
      className={`inline-flex max-w-full flex-wrap justify-center rounded-full border shadow-soft ${
        isDark
          ? 'border-white/15 bg-white/10 backdrop-blur-sm'
          : 'border-school-border bg-white dark:bg-school-surface'
      } ${compact ? 'gap-1 p-1' : 'p-1'}`}
    >
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          className={`rounded-full font-medium capitalize transition ${
            compact ? 'px-3 py-1.5 text-xs sm:px-4 sm:py-2 sm:text-sm' : 'px-5 py-2 text-sm'
          } ${
            value === opt
              ? isDark
                ? 'bg-school-gold text-school-navy shadow-glow'
                : 'bg-school-royal text-white shadow'
              : isDark
                ? 'text-slate-300 hover:text-white'
                : 'text-slate-600 hover:text-school-navy'
          }`}
        >
          {opt}
          {opt === 'yearly' && (
            <span className={`ml-1 opacity-80 ${compact ? 'text-[10px] sm:text-xs' : 'text-xs'}`}>Save 10%</span>
          )}
        </button>
      ))}
    </div>
  )
}
