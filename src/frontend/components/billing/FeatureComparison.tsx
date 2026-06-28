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
    <div className="mt-16 overflow-x-auto rounded-2xl border border-school-border bg-white shadow-soft dark:bg-school-surface">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-school-border bg-slate-50 dark:bg-slate-900/50">
            <th className="p-4 text-left font-semibold text-school-navy dark:text-white">Feature</th>
            {plans.map((p) => (
              <th key={p.slug} className={`p-4 text-center font-semibold ${p.isPopular ? 'text-school-royal' : 'text-school-navy dark:text-white'}`}>
                {p.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visible.map(([key, label]) => (
            <tr key={key} className="border-b border-school-border/50 hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
              <td className="p-4 text-slate-600 dark:text-slate-300">{label}</td>
              {plans.map((p) => {
                const has = (p.planFeatures || []).some((f) => f.key === key)
                return (
                  <td key={p.slug} className="p-4 text-center">
                    {has ? (
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-green-100 text-school-green">✓</span>
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
