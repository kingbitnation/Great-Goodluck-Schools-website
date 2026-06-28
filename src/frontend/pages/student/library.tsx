import { useState, useEffect } from 'react'
import { withAuth } from '../../components/withAuth'
import AppLayout from '../../components/layout/AppLayout'
import { apiGet, apiPost } from '../../lib/api'
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

type BorrowedBook = {
  id: string
  bookId: string
  book: LibraryBook
  borrowedAt: string
  dueAt: string
  returnedAt?: string | null
  fineAmount?: number
  status: 'borrowed' | 'overdue' | 'returned'
}

function StudentLibraryPage({ user }: { user: AuthUser }) {
  const [books, setBooks] = useState<LibraryBook[]>([])
  const [borrowedBooks, setBorrowedBooks] = useState<BorrowedBook[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<'browse' | 'borrowed'>('browse')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      setLoading(true)
      const [booksData, borrowedData] = await Promise.all([
        apiGet<LibraryBook[]>('/api/library/books'),
        apiGet<BorrowedBook[]>('/api/library/my-books'),
      ])
      setBooks(booksData)
      setBorrowedBooks(borrowedData)
    } catch (err) {
      setError('Failed to load data')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  async function handleBorrowBook(bookId: string) {
    try {
      await apiPost(`/api/library/books/${bookId}/borrow`, {})
      loadData()
      alert('Book borrowed successfully! Due date is 14 days.')
    } catch (err) {
      setError('Failed to borrow book')
      console.error(err)
    }
  }

  const filteredBooks = books.filter((book) => {
    const matchesSearch =
      book.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      book.author.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCategory = selectedCategory === 'all' || book.category === selectedCategory
    return matchesSearch && matchesCategory && book.availableQuantity > 0
  })

  const categories = ['all', ...new Set(books.map((b) => b.category))]

  return (
    <AppLayout user={user} title="Library">
      <div className="p-8 max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">School Library</h1>

        {error && <div className="bg-red-100 text-red-700 p-4 rounded mb-4">{error}</div>}

        {/* Tabs */}
        <div className="mb-6 flex gap-4 border-b">
          <button
            onClick={() => setTab('browse')}
            className={`px-4 py-2 font-medium ${
              tab === 'browse'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Browse Books ({books.filter((b) => b.availableQuantity > 0).length})
          </button>
          <button
            onClick={() => setTab('borrowed')}
            className={`px-4 py-2 font-medium ${
              tab === 'borrowed'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            My Books ({borrowedBooks.filter((b) => b.status !== 'returned').length})
          </button>
        </div>

        {/* Browse Books Tab */}
        {tab === 'browse' && (
          <>
            {/* Search and Filter */}
            <div className="mb-6 space-y-4">
              <input
                type="text"
                placeholder="Search by title or author..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              />
              <div className="flex gap-2 overflow-x-auto">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap ${
                      selectedCategory === cat
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {cat.charAt(0).toUpperCase() + cat.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Books Grid */}
            {loading ? (
              <div className="bg-white p-8 rounded-lg text-center text-gray-500">Loading books...</div>
            ) : filteredBooks.length === 0 ? (
              <div className="bg-white p-8 rounded-lg text-center text-gray-600">
                No available books matching your search.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredBooks.map((book) => (
                  <div key={book.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-lg transition">
                    <h3 className="font-semibold text-gray-900 mb-1">{book.title}</h3>
                    <p className="text-sm text-gray-600 mb-2">{book.author}</p>
                    <p className="text-xs text-gray-500 mb-3">ISBN: {book.isbn}</p>
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-xs bg-gray-100 px-2 py-1 rounded">{book.category}</span>
                      <span className="text-sm font-medium text-green-600">{book.availableQuantity} available</span>
                    </div>
                    <button
                      onClick={() => handleBorrowBook(book.id)}
                      className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 text-sm font-medium"
                    >
                      Borrow
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* My Books Tab */}
        {tab === 'borrowed' && (
          <>
            {loading ? (
              <div className="bg-white p-8 rounded-lg text-center text-gray-500">Loading your books...</div>
            ) : borrowedBooks.filter((b) => b.status !== 'returned').length === 0 ? (
              <div className="bg-white p-8 rounded-lg text-center text-gray-600">
                You haven't borrowed any books yet.
              </div>
            ) : (
              <div className="space-y-4">
                {borrowedBooks
                  .filter((b) => b.status !== 'returned')
                  .map((borrowing) => (
                    <div key={borrowing.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-semibold text-gray-900">{borrowing.book.title}</h3>
                          <p className="text-sm text-gray-600">{borrowing.book.author}</p>
                          <div className="mt-2 flex flex-wrap gap-4 text-sm text-gray-600">
                            <span>Borrowed: {new Date(borrowing.borrowedAt).toLocaleDateString()}</span>
                            <span>Due: {new Date(borrowing.dueAt).toLocaleDateString()}</span>
                            {borrowing.fineAmount ? <span>Fine: NGN {borrowing.fineAmount}</span> : null}
                          </div>
                        </div>
                        <span
                          className={`px-3 py-1 rounded-full text-sm font-medium ${
                            borrowing.status === 'overdue'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {borrowing.status}
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </>
        )}
      </div>
    </AppLayout>
  )
}

export default withAuth(StudentLibraryPage, { roles: ['Student'] })
