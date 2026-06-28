import Link from 'next/link'
import { SchoolLogo } from '../../components/public/Brand'

export default function SubscriptionCallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-school-navy px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-xl">
        <SchoolLogo size="md" light />
        <h1 className="mt-6 text-xl font-bold">Subscription payment</h1>
        <p className="mt-4 text-slate-600">
          Subscriptions are paid by bank transfer. Select a plan on the billing page, transfer using the reference provided, then submit proof for review.
        </p>
        <Link href="/admin/billing" className="btn-gold mt-6 inline-block">Go to billing</Link>
      </div>
    </div>
  )
}
