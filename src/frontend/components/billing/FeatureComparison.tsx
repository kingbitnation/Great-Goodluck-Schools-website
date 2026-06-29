import { useState } from 'react'
import type { Plan } from './PricingCards'

export default function FeatureComparison({ plans }: { plans: Plan[] }) {
  const [expanded, setExpanded] = useState(false)
  const allFeatures = Array.from(
    new Map(plans.flatMap((p) => (p.planFeatures || []).map((f) => [f.key, f.label]))).entries()
  )

  if (!allFeatures.length) return null

  const visible = expanded ? allFeatures : allFeatures.slice(0, 12)

  return (
    <div className="mt-16 overflow-hidden rounded-3xl border border-school-border/60 bg-school-surface shadow-soft">
      <div className="border-b border-school-border/60 bg-gradient-to-r from-school-navy to-school-royal px-6 py-4">
        <h3 className="font-display text-lg font-semibold text-white">Compare all features</h3>
        <p className="text-sm text-slate-300">See what&apos;s included in each plan</p>
      </div>
      <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-school-border bg-school-bg/80">
            <th className="p-4 text-left font-semibold text-school-navy dark:text-white">Feature</th>
            {plans.map((p) => (
              <th
                key={p.slug}
                className={`p-4 text-center font-semibold ${
                  p.isPopular
                    ? 'bg-school-royal/5 text-school-royal'
                    : 'text-school-navy dark:text-white'
                }`}
              >
                {p.name}
                {p.isPopular && (
                  <span className="mt-1 block text-[10px] font-bold uppercase tracking-wide text-school-royal/80">
                    Popular
                  </span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visible.map(([key, label], rowIndex) => (
            <tr
              key={key}
              className={`border-b border-school-border/50 transition hover:bg-school-royal/5 ${
                rowIndex % 2 === 0 ? 'bg-white dark:bg-school-surface' : 'bg-school-bg/40'
              }`}
            >
              <td className="p-4 font-medium text-school-navy/80 dark:text-slate-300">{label}</td>
              {plans.map((p) => {
                const has = (p.planFeatures || []).some((f) => f.key === key)
                return (
                  <td
                    key={p.slug}
                    className={`p-4 text-center ${p.isPopular ? 'bg-school-royal/[0.03]' : ''}`}
                  >
                    {has ? (
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-school-green/15 text-school-green">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </span>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
      </div>
      {allFeatures.length > 12 && (
        <div className="p-4 text-center">
          <button type="button" onClick={() => setExpanded(!expanded)} className="text-sm font-medium text-school-royal hover:underline">
            {expanded ? 'Show less' : `Show all ${allFeatures.length} features`}
          </button>
        </div>
      )}
    </div>
  )
}

export function PublicPricingSection() {
  return null
}
