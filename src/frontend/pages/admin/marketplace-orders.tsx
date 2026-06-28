import Link from 'next/link'
import { useEffect, useState } from 'react'
import { withAuth } from '../../components/withAuth'
import AppLayout from '../../components/layout/AppLayout'
import { apiGet, apiPatch } from '../../lib/api'
import type { AuthUser } from '../../lib/useAuth'

type Order = {
  id: string
  orderNumber: string
  customerName: string
  customerEmail: string
  totalAmount: number
  status: string
  gateway?: string | null
  reference?: string | null
  paymentReceiptUrl?: string | null
  createdAt: string
  items: { productName: string; quantity: number; size?: string | null }[]
}

function statusClass(status: string) {
  if (status === 'fulfilled') return 'bg-school-green/15 text-[#047857]'
  if (status === 'paid' || status === 'processing') return 'bg-school-royal/10 text-school-royal'
  if (status === 'cancelled') return 'bg-red-100 text-red-700'
  return 'bg-school-gold/15 text-[#b45309]'
}

function AdminMarketplaceOrdersPage({ user }: { user: AuthUser }) {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<'all' | 'pending'>('pending')

  function load() {
    setLoading(true)
    apiGet<Order[]>('/api/marketplace/orders')
      .then(setOrders)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  async function updateStatus(id: string, status: string) {
    setError('')
    try {
      await apiPatch(`/api/marketplace/orders/${id}/status`, { status })
      load()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Update failed')
    }
  }

  const visible = filter === 'pending' ? orders.filter((o) => o.status === 'pending') : orders

  return (
    <AppLayout user={user} title="Marketplace Orders">
      <div className="mx-auto max-w-6xl p-6 sm:p-8">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-school-navy">Shop orders</h1>
            <p className="mt-1 text-sm text-school-muted">
              Confirm bank transfers, then process and fulfill orders.
            </p>
          </div>
          <Link href="/admin/marketplace" className="text-sm text-school-royal hover:underline">← Products</Link>
        </div>

        <div className="mb-4 flex gap-2">
          <button
            type="button"
            onClick={() => setFilter('pending')}
            className={`rounded-lg px-4 py-2 text-sm font-medium ${filter === 'pending' ? 'bg-school-royal text-white' : 'bg-school-surface border border-school-border text-school-muted'}`}
          >
            Pending payment ({orders.filter((o) => o.status === 'pending').length})
          </button>
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={`rounded-lg px-4 py-2 text-sm font-medium ${filter === 'all' ? 'bg-school-royal text-white' : 'bg-school-surface border border-school-border text-school-muted'}`}
          >
            All orders
          </button>
        </div>

        {error && <p className="mb-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>}

        {loading ? (
          <p className="text-school-muted">Loading…</p>
        ) : visible.length === 0 ? (
          <div className="content-card p-8 text-center text-school-muted">No orders in this view.</div>
        ) : (
          <div className="space-y-4">
            {visible.map((o) => (
              <div key={o.id} className="content-card p-5">
                <div className="flex flex-col gap-4 md:flex-row md:justify-between">
                  <div>
                    <p className="font-bold text-school-navy">{o.orderNumber}</p>
                    <p className="text-sm text-school-muted">{o.customerName} · {o.customerEmail}</p>
                    <p className="mt-1 text-sm">
                      {new Date(o.createdAt).toLocaleString()} · ₦{o.totalAmount.toLocaleString()}
                    </p>
                    {o.reference && (
                      <p className="mt-1 font-mono text-xs text-school-royal">Ref: {o.reference}</p>
                    )}
                    {o.paymentReceiptUrl && (
                      <a href={o.paymentReceiptUrl} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-sm text-school-royal hover:underline">
                        View payment receipt
                      </a>
                    )}
                    <ul className="mt-2 text-sm text-school-text">
                      {o.items.map((item, i) => (
                        <li key={i}>
                          {item.productName}{item.size ? ` (${item.size})` : ''} × {item.quantity}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="flex shrink-0 flex-col gap-2 sm:min-w-[180px]">
                    <span className={`rounded-full px-3 py-1 text-center text-xs font-semibold capitalize ${statusClass(o.status)}`}>
                      {o.status.replace('_', ' ')}
                    </span>
                    {o.status === 'pending' && (
                      <>
                        <button
                          type="button"
                          onClick={() => updateStatus(o.id, 'paid')}
                          className="btn-royal justify-center py-2 text-sm"
                        >
                          Confirm bank payment
                        </button>
                        <button
                          type="button"
                          onClick={() => updateStatus(o.id, 'cancelled')}
                          className="rounded-lg border border-red-200 px-3 py-2 text-sm text-red-600"
                        >
                          Cancel order
                        </button>
                      </>
                    )}
                    {o.status === 'paid' && (
                      <button type="button" onClick={() => updateStatus(o.id, 'processing')} className="btn-navy justify-center py-2 text-sm">
                        Mark processing
                      </button>
                    )}
                    {o.status === 'processing' && (
                      <button type="button" onClick={() => updateStatus(o.id, 'fulfilled')} className="btn-green justify-center py-2 text-sm">
                        Mark fulfilled
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  )
}

export default withAuth(AdminMarketplaceOrdersPage, { roles: ['SuperAdmin', 'SchoolAdmin'] })
