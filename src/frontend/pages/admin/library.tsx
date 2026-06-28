import Link from 'next/link'
import { useState, useEffect } from 'react'
import { withAuth } from '../../components/withAuth'
import AppLayout from '../../components/layout/AppLayout'
import { apiGet, apiPost, apiPut, apiDelete } from '../../lib/api'
import type { AuthUser } from '../../lib/useAuth'

type LibraryBook = {
  id: string
  title: string
  author: string
  isbn: string
  quantity: number
  availableQuantity: number
  category: string
  createdAt: string
}

type LibraryStats = {
  totalTitles: number
  totalCopies: number
  availableCopies: number
  activeLoans: number
  overdueLoans: number
  finesCollected: number
}

function AdminLibraryPage({ user }: { user: AuthUser }) {
  const [books, setBooks] = useState<LibraryBook[]>([])
  const [stats, setStats] = useState<LibraryStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    title: '',
    author: '',
    isbn: '',
    quantity: 1,
    category: 'Fiction',
  })
  const [editingId, setEditingId] = useState<string | null>(null)

  useEffect(() => {
    loadBooks()
  }, [search])

  async function loadBooks() {
    try {
      setLoading(true)
      const q = search ? `?q=${encodeURIComponent(search)}` : ''
      const [booksData, statsData] = await Promise.all([
        apiGet<LibraryBook[]>(`/api/library/books${q}`),
        apiGet<LibraryStats>('/api/library/stats').catch(() => null),
      ])
      setBooks(booksData)
      setStats(statsData)
      setError('')
    } catch (err) {
      setError('Failed to load books')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  async function handleSaveBook() {
    if (!formData.title || !formData.author) {
      setError('Title and author are required')
      return
    }

    try {
      if (editingId) {
        await apiPut(`/api/library/books/${editingId}`, {
          ...formData,
          quantity: parseInt(String(formData.quantity)),
        })
      } else {
        await apiPost('/api/library/books', {
          ...formData,
          quantity: parseInt(String(formData.quantity)),
        })
      }
      setFormData({ title: '', author: '', isbn: '', quantity: 1, category: 'Fiction' })
      setEditingId(null)
      setShowForm(false)
      loadBooks()
    } catch (err) {
      setError((err as Error).message || 'Failed to save book')
    }
  }

  async function handleDeleteBook(id: string) {
    if (!confirm('Delete this book?')) return
    try {
      await apiDelete(`/api/library/books/${id}`)
      loadBooks()
    } catch (err) {
      setError((err as Error).message || 'Failed to delete book')
    }
  }

  function handleEditBook(book: LibraryBook) {
    setFormData({
      title: book.title,
      author: book.author,
      isbn: book.isbn,
      quantity: book.quantity,
      category: book.category,
    })
    setEditingId(book.id)
    setShowForm(true)
  }

  return (
    <AppLayout user={user} title="Library Management">
      <div className="mx-auto max-w-7xl space-y-6 p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Library Catalog</h1>
            <p className="text-slate-600">Manage books, inventory, and circulation.</p>
          </div>
          <div className="flex gap-2">
            <Link href="/admin/library-transactions" className="rounded border px-4 py-2 text-sm font-medium hover:bg-slate-50">
              Issue & Return
            </Link>
            <button
              type="button"
              onClick={() => {
                setShowForm(!showForm)
                setEditingId(null)
                setFormData({ title: '', author: '', isbn: '', quantity: 1, category: 'Fiction' })
              }}
              className="rounded bg-school-navy px-4 py-2 text-sm font-medium text-white"
            >
              {showForm ? 'Cancel' : 'Add Book'}
            </button>
          </div>
        </div>

        {stats && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <div className="content-card p-4"><p className="text-xs text-slate-500">Titles</p><p className="text-2xl font-bold">{stats.totalTitles}</p></div>
            <div className="content-card p-4"><p className="text-xs text-slate-500">Copies</p><p className="text-2xl font-bold">{stats.totalCopies}</p></div>
            <div className="content-card p-4"><p className="text-xs text-slate-500">Available</p><p className="text-2xl font-bold text-green-700">{stats.availableCopies}</p></div>
            <div className="content-card p-4"><p className="text-xs text-slate-500">On loan</p><p className="text-2xl font-bold text-blue-700">{stats.activeLoans}</p></div>
            <div className="content-card p-4"><p className="text-xs text-slate-500">Overdue</p><p className="text-2xl font-bold text-red-700">{stats.overdueLoans}</p></div>
          </div>
        )}

        <input
          type="search"
          placeholder="Search title, author, or ISBN..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border px-4 py-2"
        />

        {error && <div className="rounded border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>}

        {showForm && (
          <div className="content-card space-y-4 p-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <input placeholder="Title" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} className="rounded border p-2" />
              <input placeholder="Author" value={formData.author} onChange={(e) => setFormData({ ...formData, author: e.target.value })} className="rounded border p-2" />
              <input placeholder="ISBN" value={formData.isbn} onChange={(e) => setFormData({ ...formData, isbn: e.target.value })} className="rounded border p-2" />
              <input type="number" placeholder="Copies" value={formData.quantity} onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 1 })} className="rounded border p-2" />
            </div>
            <select value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} className="w-full rounded border p-2">
              <option>Fiction</option>
              <option>Non-Fiction</option>
              <option>Reference</option>
              <option>Academic</option>
              <option>Science</option>
              <option>Children</option>
            </select>
            <button type="button" onClick={handleSaveBook} className="w-full rounded bg-school-navy py-2 font-medium text-white">
              {editingId ? 'Update Book' : 'Add Book'}
            </button>
          </div>
        )}

        {loading ? (
          <div className="content-card p-8 text-center text-slate-500">Loading books...</div>
        ) : books.length === 0 ? (
          <div className="content-card p-8 text-center text-slate-600">No books found.</div>
        ) : (
          <div className="overflow-x-auto rounded-xl border bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left">
                <tr>
                  <th className="px-4 py-3">Title</th>
                  <th className="px-4 py-3">Author</th>
                  <th className="px-4 py-3">ISBN</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3 text-center">Total</th>
                  <th className="px-4 py-3 text-center">Available</th>
                  <th className="px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {books.map((book) => (
                  <tr key={book.id} className="border-t">
                    <td className="px-4 py-3 font-medium">{book.title}</td>
                    <td className="px-4 py-3">{book.author}</td>
                    <td className="px-4 py-3">{book.isbn || '—'}</td>
                    <td className="px-4 py-3">{book.category}</td>
                    <td className="px-4 py-3 text-center">{book.quantity}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={book.availableQuantity > 0 ? 'text-green-700' : 'text-red-700'}>{book.availableQuantity}</span>
                    </td>
                    <td className="px-4 py-3 text-center space-x-2">
                      <button type="button" onClick={() => handleEditBook(book)} className="text-blue-600 hover:underline">Edit</button>
                      <button type="button" onClick={() => handleDeleteBook(book.id)} className="text-red-600 hover:underline">Delete</button>
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

export default withAuth(AdminLibraryPage, { roles: ['SuperAdmin', 'SchoolAdmin', 'Librarian'] })
