import Link from 'next/link'
import { SchoolLogo } from '../../components/public/Brand'

export default function PaymentCallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-school-navy px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-xl">
        <SchoolLogo size="md" light />
        <h1 className="mt-6 text-xl font-bold text-school-navy">Manual payments only</h1>
        <p className="mt-4 text-slate-600">
          Online payment callbacks are disabled. Pay by bank transfer from the fees page and upload your receipt for verification.
        </p>
        <Link href="/student/fees" className="btn-gold mt-6 inline-block">Go to fees</Link>
      </div>
    </div>
  )
}
