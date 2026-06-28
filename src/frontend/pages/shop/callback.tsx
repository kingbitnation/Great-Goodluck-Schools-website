import Link from 'next/link'
import PublicLayout from '../../components/layout/PublicLayout'

export default function ShopCallbackPage() {
  return (
    <PublicLayout title="Order Payment" subtitle="Bank transfer">
      <div className="glass-card mx-auto max-w-md rounded-3xl p-8 text-center">
        <p className="text-school-navy font-semibold text-lg mb-2">Manual payments only</p>
        <p className="text-slate-600 text-sm">
          Shop orders are paid by bank transfer. Place your order from the cart to receive account details. The school will confirm payment before fulfilling your order.
        </p>
        <Link href="/student/shop/cart" className="btn-gold mt-6 inline-block">Back to cart</Link>
      </div>
    </PublicLayout>
  )
}
