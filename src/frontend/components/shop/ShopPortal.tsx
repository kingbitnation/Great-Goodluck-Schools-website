import Link from 'next/link'
import { useEffect, useState } from 'react'
import AppLayout from '../layout/AppLayout'
import PaymentReceiptUpload, { fileToDataUrl } from '../payments/PaymentReceiptUpload'
import { apiGet, apiPost, apiPatch, apiDelete } from '../../lib/api'
import type { AuthUser } from '../../lib/useAuth'

export type ShopProduct = {
  id: string
  name: string
  description?: string | null
  category: string
  price: number
  currency: string
  sizes: string[]
  stockQty: number
  inStock: boolean
}

type CartItem = {
  id: string
  quantity: number
  size?: string | null
  product: ShopProduct | null
  subtotal: number
}

type CartResponse = { items: CartItem[]; total: number }

type ShopPortalProps = {
  user: AuthUser
  basePath: string
  title?: string
}

const CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'uniform', label: 'Uniforms' },
  { id: 'book', label: 'Books' },
  { id: 'supplies', label: 'Supplies' },
]

export function ShopCatalog({ user, basePath }: ShopPortalProps) {
  const [products, setProducts] = useState<ShopProduct[]>([])
  const [category, setCategory] = useState('all')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [selectedSizes, setSelectedSizes] = useState<Record<string, string>>({})

  useEffect(() => {
    loadProducts()
  }, [category, search])

  async function loadProducts() {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (category !== 'all') params.set('category', category)
      if (search) params.set('q', search)
      const q = params.toString() ? `?${params}` : ''
      setProducts(await apiGet<ShopProduct[]>(`/api/marketplace/products${q}`))
    } catch {
      setProducts([])
    } finally {
      setLoading(false)
    }
  }

  async function addToCart(product: ShopProduct) {
    const size = product.sizes?.length ? selectedSizes[product.id] : undefined
    if (product.sizes?.length && !size) {
      setMessage('Please select a size')
      return
    }
    try {
      await apiPost('/api/marketplace/cart', { productId: product.id, quantity: 1, size })
      setMessage(`${product.name} added to cart`)
    } catch {
      setMessage('Could not add to cart')
    }
  }

  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold">School Shop</h1>
          <p className="text-gray-600 mt-1">Uniforms, textbooks, and supplies.</p>
        </div>
        <Link href={`${basePath}/cart`} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium text-center">
          View cart
        </Link>
      </div>

      {message && <div className="bg-blue-50 text-blue-800 p-3 rounded mb-4 text-sm">{message}</div>}

      <div className="flex flex-wrap gap-2 mb-4">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            onClick={() => setCategory(c.id)}
            className={`px-3 py-1 rounded-full text-sm ${category === c.id ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}
          >
            {c.label}
          </button>
        ))}
      </div>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search products..."
        className="w-full max-w-md border border-gray-300 rounded-lg px-4 py-2 mb-6"
      />

      {loading ? (
        <div className="text-gray-500">Loading...</div>
      ) : products.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-600">No products available.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {products.map((p) => (
            <div key={p.id} className="bg-white rounded-lg shadow p-5 flex flex-col">
              <span className="text-xs uppercase tracking-wide text-gray-500">{p.category}</span>
              <h2 className="font-bold text-lg mt-1">{p.name}</h2>
              {p.description && <p className="text-sm text-gray-600 mt-2 flex-1">{p.description}</p>}
              <p className="text-lg font-bold text-blue-700 mt-3">₦{p.price.toLocaleString()}</p>
              <p className="text-xs text-gray-500">{p.stockQty} in stock</p>
              {p.sizes?.length > 0 && (
                <select
                  value={selectedSizes[p.id] || ''}
                  onChange={(e) => setSelectedSizes({ ...selectedSizes, [p.id]: e.target.value })}
                  className="mt-3 border rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">Select size</option>
                  {p.sizes.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              )}
              <button
                onClick={() => addToCart(p)}
                disabled={!p.inStock}
                className="mt-3 w-full py-2 bg-green-600 text-white rounded-lg text-sm font-medium disabled:opacity-50"
              >
                {p.inStock ? 'Add to cart' : 'Out of stock'}
              </button>
            </div>
          ))}
        </div>
      )}

      <p className="mt-6 text-sm">
        <Link href={`${basePath}/orders`} className="text-blue-600 hover:underline">My orders →</Link>
      </p>
    </div>
  )
}

type BankDetails = {
  bankName: string
  accountName: string
  accountNumber: string
  amount: number
  reference: string
}

export function ShopCart({ user, basePath }: ShopPortalProps) {
  const [cart, setCart] = useState<CartResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [checkingOut, setCheckingOut] = useState(false)
  const [error, setError] = useState('')
  const [bankDetails, setBankDetails] = useState<BankDetails | null>(null)
  const [orderNumber, setOrderNumber] = useState('')
  const [orderId, setOrderId] = useState('')
  const [receiptFileName, setReceiptFileName] = useState<string | null>(null)
  const [receiptUploaded, setReceiptUploaded] = useState(false)
  const [uploadingReceipt, setUploadingReceipt] = useState(false)

  useEffect(() => {
    loadCart()
  }, [])

  async function loadCart() {
    try {
      setCart(await apiGet<CartResponse>('/api/marketplace/cart'))
    } catch {
      setCart({ items: [], total: 0 })
    } finally {
      setLoading(false)
    }
  }

  async function updateQty(id: string, quantity: number) {
    await apiPatch(`/api/marketplace/cart/${id}`, { quantity })
    loadCart()
  }

  async function removeItem(id: string) {
    await apiDelete(`/api/marketplace/cart/${id}`)
    loadCart()
  }

  async function checkout() {
    setCheckingOut(true)
    setError('')
    setBankDetails(null)
    setOrderId('')
    setReceiptFileName(null)
    setReceiptUploaded(false)
    try {
      const res = await apiPost<{
        orderId: string
        orderNumber: string
        manual?: boolean
        bankDetails?: BankDetails
        message?: string
      }>('/api/marketplace/checkout', {
        customerName: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
        customerEmail: user.email,
      })
      if (res.manual && res.bankDetails) {
        setOrderId(res.orderId)
        setOrderNumber(res.orderNumber)
        setBankDetails(res.bankDetails)
        loadCart()
        return
      }
      throw new Error('Checkout failed')
    } catch {
      setError('Checkout failed')
    } finally {
      setCheckingOut(false)
    }
  }

  async function uploadReceipt(file: File) {
    if (!orderId) return
    setUploadingReceipt(true)
    setError('')
    setReceiptFileName(file.name)
    try {
      const fileBase64 = await fileToDataUrl(file)
      await apiPost(`/api/marketplace/orders/${orderId}/upload-receipt`, {
        fileBase64,
        mimeType: file.type,
      })
      setReceiptUploaded(true)
    } catch {
      setError('Failed to upload receipt')
      setReceiptFileName(null)
    } finally {
      setUploadingReceipt(false)
    }
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-3xl font-bold mb-6">Shopping Cart</h1>
      {loading ? (
        <div className="text-gray-500">Loading...</div>
      ) : !cart?.items.length ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <p className="text-gray-600">Your cart is empty.</p>
          <Link href={basePath} className="text-blue-600 hover:underline mt-2 inline-block">Continue shopping</Link>
        </div>
      ) : (
        <div className="space-y-4">
          {cart.items.map((item) => (
            <div key={item.id} className="bg-white rounded-lg shadow p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <p className="font-medium">{item.product?.name}</p>
                {item.size && <p className="text-sm text-gray-500">Size: {item.size}</p>}
                <p className="text-sm text-blue-700">₦{item.subtotal.toLocaleString()}</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => updateQty(item.id, Math.max(1, item.quantity - 1))} className="px-2 py-1 border rounded">−</button>
                <span>{item.quantity}</span>
                <button onClick={() => updateQty(item.id, item.quantity + 1)} className="px-2 py-1 border rounded">+</button>
                <button onClick={() => removeItem(item.id)} className="text-red-600 text-sm ml-2">Remove</button>
              </div>
            </div>
          ))}
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-xl font-bold mb-4">Total: ₦{cart.total.toLocaleString()}</p>
            {bankDetails ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm">
                <p className="font-semibold text-school-navy">Order {orderNumber} — bank transfer</p>
                <p className="mt-2 text-slate-600">Transfer the amount below using the reference. Your order will be processed after payment confirmation.</p>
                <dl className="mt-4 space-y-2">
                  <div className="flex justify-between"><dt>Bank</dt><dd>{bankDetails.bankName}</dd></div>
                  <div className="flex justify-between"><dt>Account name</dt><dd>{bankDetails.accountName}</dd></div>
                  <div className="flex justify-between"><dt>Account number</dt><dd className="font-mono">{bankDetails.accountNumber}</dd></div>
                  <div className="flex justify-between"><dt>Amount</dt><dd className="font-bold">₦{bankDetails.amount.toLocaleString()}</dd></div>
                  <div className="flex justify-between"><dt>Reference</dt><dd className="font-mono text-xs">{bankDetails.reference}</dd></div>
                </dl>
                <div className="mt-4">
                  <PaymentReceiptUpload
                    uploading={uploadingReceipt}
                    fileName={receiptFileName}
                    onFile={uploadReceipt}
                    disabled={receiptUploaded}
                  />
                  {receiptUploaded && (
                    <p className="mt-2 text-sm text-school-green">Receipt submitted. The school will confirm your payment.</p>
                  )}
                  {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
                </div>
                <Link href={`${basePath}/orders`} className="mt-4 inline-block text-blue-600 hover:underline">View orders</Link>
              </div>
            ) : (
              <>
                <p className="text-sm text-slate-600 mb-4">Pay by bank transfer. Account details are shown after checkout.</p>
                {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
                <button onClick={checkout} disabled={checkingOut} className="w-full bg-blue-600 text-white py-2 rounded-lg font-medium disabled:opacity-50">
                  {checkingOut ? 'Processing...' : 'Place order'}
                </button>
              </>
            )}
          </div>
        </div>
      )}
      <p className="mt-4 text-sm">
        <Link href={basePath} className="text-blue-600 hover:underline">← Continue shopping</Link>
      </p>
    </div>
  )
}

export function ShopOrders({ basePath }: { basePath: string }) {
  type Order = {
    id: string
    orderNumber: string
    totalAmount: number
    status: string
    createdAt: string
    itemCount: number
  }

  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const base = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000'

  useEffect(() => {
    apiGet<Order[]>('/api/marketplace/orders')
      .then(setOrders)
      .finally(() => setLoading(false))
  }, [])

  function downloadReceipt(orderId: string) {
    const token = typeof window !== 'undefined' ? (localStorage.getItem('sp_token') || localStorage.getItem('sms_token')) : null
    fetch(`${base}/api/marketplace/orders/${orderId}/receipt`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(async (res) => {
        if (!res.ok) throw new Error('Failed')
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `order-${orderId.slice(-8)}.pdf`
        a.click()
        URL.revokeObjectURL(url)
      })
      .catch(() => {})
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">My Orders</h1>
      {loading ? (
        <div className="text-gray-500">Loading...</div>
      ) : orders.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-600">No orders yet.</div>
      ) : (
        <div className="space-y-3">
          {orders.map((o) => (
            <div key={o.id} className="bg-white rounded-lg shadow p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <p className="font-bold">{o.orderNumber}</p>
                <p className="text-sm text-gray-600">{new Date(o.createdAt).toLocaleString()} · {o.itemCount} items</p>
                <p className="text-sm font-medium mt-1">₦{o.totalAmount.toLocaleString()}</p>
                <span className={`inline-block mt-2 px-2 py-0.5 text-xs rounded-full ${
                  o.status === 'fulfilled' ? 'bg-green-100 text-green-800' :
                  o.status === 'paid' || o.status === 'processing' ? 'bg-blue-100 text-blue-800' :
                  'bg-gray-100 text-gray-700'
                }`}>{o.status}</span>
              </div>
              {['paid', 'processing', 'fulfilled'].includes(o.status) && (
                <button onClick={() => downloadReceipt(o.id)} className="text-sm text-blue-600 hover:underline">
                  Download receipt
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      <p className="mt-4 text-sm">
        <Link href={basePath} className="text-blue-600 hover:underline">← Back to shop</Link>
      </p>
    </div>
  )
}

export function ShopLayout({ user, basePath, title, children }: ShopPortalProps & { children: React.ReactNode }) {
  return (
    <AppLayout user={user} title={title || 'Shop'}>
      <div className="p-8 max-w-7xl mx-auto">{children}</div>
    </AppLayout>
  )
}
