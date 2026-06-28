import Link from 'next/link'

export default function UpgradeBanner({
  feature,
  requiredPlan,
  message,
}: {
  feature?: string
  requiredPlan?: string
  message?: string
}) {
  const planLabel = requiredPlan
    ? requiredPlan.charAt(0).toUpperCase() + requiredPlan.slice(1)
    : 'a higher plan'

  return (
    <div className="rounded-xl border border-school-royal/30 bg-gradient-to-r from-school-royal/5 to-transparent p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="font-display font-bold text-school-navy dark:text-white">
            {feature ? `${feature} is not available on your plan` : 'Upgrade required'}
          </p>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            {message || `Upgrade to ${planLabel} to unlock this feature and more.`}
          </p>
        </div>
        <Link href="/admin/billing" className="btn-royal shrink-0 text-sm">
          Upgrade to {planLabel}
        </Link>
      </div>
    </div>
  )
}
