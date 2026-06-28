import Link from 'next/link'
import PublicLayout from '../../../components/layout/PublicLayout'

export default function AlumniDonateCallbackPage() {
  return (
    <PublicLayout title="Donation Status" subtitle="Bank transfer">
      <div className="glass-card mx-auto max-w-md rounded-3xl p-8 text-center">
        <p className="text-school-navy font-semibold text-lg mb-2">Manual donations only</p>
        <p className="text-slate-600 text-sm">
          Donations are paid by bank transfer. Start a donation to receive account details. The school will confirm receipt after your transfer.
        </p>
        <Link href="/alumni/donate" className="btn-gold mt-6 inline-block">Donate</Link>
      </div>
    </PublicLayout>
  )
}
