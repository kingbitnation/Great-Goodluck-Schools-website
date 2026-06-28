import Link from 'next/link'
import { useEffect, useState } from 'react'
import { withAuth } from '../../components/withAuth'
import AppLayout from '../../components/layout/AppLayout'
import { apiGet, apiPost, apiPut, apiDelete } from '../../lib/api'
import type { AuthUser } from '../../lib/useAuth'

type Product = {
  id: string
  name: string
  description?: string | null
  category: string
  sku?: string | null
  price: number
  sizes: string[]
  stockQty: number
  isActive: boolean
}

type Stats = {
  products: number
  activeProducts: number
  lowStock: number
  orders: number
  revenue: number
  pendingOrders: number
}

function AdminMarketplacePage({ user }: { user: AuthUser }) {
  const [products, setProducts] = useState<Product[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    name: '', description: '', category: 'uniform', sku: '', price: '', stockQty: '10', sizes: '',
  })

  useEffect(() => {
    load()
  }, [])

  async function load() {
    try {
      const [p, s] = await Promise.all([
        apiGet<Product[]>('/api/marketplace/products'),
        apiGet<Stats>('/api/marketplace/stats'),
      ])
      setProducts(p)
      setStats(s)
    } finally {
      setLoading(false)
    }
  }

  async function createProduct() {
    if (!form.name || !form.price) return
    await apiPost('/api/marketplace/products', {
      name: form.name,
      description: form.description || null,
      category: form.category,
      sku: form.sku || null,
      price: Number(form.price),
      stockQty: Number(form.stockQty) || 0,
      sizes: form.sizes ? form.sizes.split(',').map((s) => s.trim()).filter(Boolean) : [],
    })
    setShowForm(false)
    setForm({ name: '', description: '', category: 'uniform', sku: '', price: '', stockQty: '10', sizes: '' })
    load()
  }

  async function adjustStock(id: string, delta: number) {
    await apiPost(`/api/marketplace/products/${id}/stock`, { delta })
    load()
  }

  async function toggleActive(p: Product) {
    await apiPut(`/api/marketplace/products/${p.id}`, { isActive: !p.isActive })
    load()
  }

  async function removeProduct(id: string) {
    if (!confirm('Delete this product?')) return
    await apiDelete(`/api/marketplace/products/${id}`)
    load()
  }

  return (
    <AppLayout user={user} title="Marketplace">
      <div className="p-8 max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold">School Marketplace</h1>
            <p className="text-gray-600">Manage uniforms, books, and supplies inventory.</p>
          </div>
          <div className="flex gap-2">
            <Link href="/admin/marketplace-orders" className="px-4 py-2 border rounded-lg text-sm">Orders</Link>
            <button onClick={() => setShowForm(!showForm)} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">
              {showForm ? 'Cancel' : 'Add product'}
            </button>
          </div>
        </div>

        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
            {[
              { label: 'Products', value: stats.products },
              { label: 'Active', value: stats.activeProducts },
              { label: 'Low stock', value: stats.lowStock },
              { label: 'Orders', value: stats.orders },
              { label: 'Revenue', value: `₦${stats.revenue.toLocaleString()}` },
              { label: 'Pending', value: stats.pendingOrders },
            ].map((c) => (
              <div key={c.label} className="bg-white rounded-lg shadow p-4">
                <p className="text-sm text-gray-500">{c.label}</p>
                <p className="text-xl font-bold mt-1">{c.value}</p>
              </div>
            ))}
          </div>
        )}

        {showForm && (
          <div className="bg-white rounded-lg shadow p-6 mb-6 grid grid-cols-1 md:grid-cols-2 gap-3">
            <input placeholder="Product name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="border rounded-lg px-3 py-2" />
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="border rounded-lg px-3 py-2">
              <option value="uniform">Uniform</option>
              <option value="book">Book</option>
              <option value="supplies">Supplies</option>
            </select>
            <input placeholder="SKU" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} className="border rounded-lg px-3 py-2" />
            <input type="number" placeholder="Price (NGN)" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="border rounded-lg px-3 py-2" />
            <input type="number" placeholder="Stock qty" value={form.stockQty} onChange={(e) => setForm({ ...form, stockQty: e.target.value })} className="border rounded-lg px-3 py-2" />
            <input placeholder="Sizes (comma-separated)" value={form.sizes} onChange={(e) => setForm({ ...form, sizes: e.target.value })} className="border rounded-lg px-3 py-2" />
            <textarea placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="border rounded-lg px-3 py-2 md:col-span-2" rows={2} />
            <button onClick={createProduct} className="md:col-span-2 bg-blue-600 text-white py-2 rounded-lg font-medium">Save product</button>
          </div>
        )}

        {loading ? (
          <div className="text-gray-500">Loading...</div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left">
                <tr>
                  <th className="p-3">Product</th>
                  <th className="p-3">Category</th>
                  <th className="p-3">Price</th>
                  <th className="p-3">Stock</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id} className="border-t">
                    <td className="p-3">
                      <p className="font-medium">{p.name}</p>
                      {p.sku && <p className="text-xs text-gray-500">{p.sku}</p>}
                    </td>
                    <td className="p-3 capitalize">{p.category}</td>
                    <td className="p-3">₦{p.price.toLocaleString()}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <span>{p.stockQty}</span>
                        <button onClick={() => adjustStock(p.id, 5)} className="text-xs text-green-600">+5</button>
                        <button onClick={() => adjustStock(p.id, -1)} className="text-xs text-red-600">−1</button>
                      </div>
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs ${p.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100'}`}>
                        {p.isActive ? 'Active' : 'Hidden'}
                      </span>
                    </td>
                    <td className="p-3 space-x-2">
                      <button onClick={() => toggleActive(p)} className="text-blue-600 text-xs">Toggle</button>
                      <button onClick={() => removeProduct(p.id)} className="text-red-600 text-xs">Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppLayout>
  )
}

export default withAuth(AdminMarketplacePage, { roles: ['SuperAdmin', 'SchoolAdmin'] })
