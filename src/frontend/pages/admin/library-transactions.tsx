import { useState, useEffect } from 'react'
import { withAuth } from '../../components/withAuth'
import AppLayout from '../../components/layout/AppLayout'
import { apiGet, apiPost } from '../../lib/api'
import type { AuthUser } from '../../lib/useAuth'

type LibraryTransaction = {
  id: string
  bookId: string
  book: { id: string; title: string; author: string }
  studentId: string
  student: { id: string; firstName: string; lastName: string; email: string }
  borrowedAt: string
  dueAt: string
  returnedAt?: string | null
  fineAmount?: number
  status: 'borrowed' | 'overdue' | 'returned'
}

type Book = { id: string; title: string; availableQuantity: number }
type Student = { id: string; user: { firstName: string; lastName: string } }

function AdminLibraryTransactionsPage({ user }: { user: AuthUser }) {
  const [transactions, setTransactions] = useState<LibraryTransaction[]>([])
  const [books, setBooks] = useState<Book[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'borrowed' | 'overdue' | 'returned'>('all')
  const [issueForm, setIssueForm] = useState({ bookId: '', studentId: '' })
  const [issuing, setIssuing] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      setLoading(true)
      const [txData, booksData, studentsData] = await Promise.all([
        apiGet<LibraryTransaction[]>('/api/library/transactions'),
        apiGet<Book[]>('/api/library/books'),
        apiGet<Student[]>('/api/students'),
      ])
      setTransactions(txData)
      setBooks(booksData.filter((b) => b.availableQuantity > 0))
      setStudents(studentsData)
      setError('')
    } catch (err) {
      setError('Failed to load transactions')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  async function handleReturnBook(transactionId: string) {
    try {
      await apiPost(`/api/library/transactions/${transactionId}/return`, {})
      loadData()
    } catch (err) {
      setError((err as Error).message || 'Failed to return book')
    }
  }

  async function handleIssue() {
    if (!issueForm.bookId || !issueForm.studentId) return
    try {
      setIssuing(true)
      await apiPost('/api/library/transactions/issue', issueForm)
      setIssueForm({ bookId: '', studentId: '' })
      loadData()
    } catch (err) {
      setError((err as Error).message || 'Failed to issue book')
    } finally {
      setIssuing(false)
    }
  }

  const filteredTransactions = transactions.filter((t) => filterStatus === 'all' || t.status === filterStatus)

  const stats = {
    borrowed: transactions.filter((t) => t.status === 'borrowed').length,
    overdue: transactions.filter((t) => t.status === 'overdue').length,
    returned: transactions.filter((t) => t.status === 'returned').length,
    fines: transactions.reduce((s, t) => s + (t.fineAmount || 0), 0),
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'borrowed': return 'bg-blue-100 text-blue-800'
      case 'overdue': return 'bg-red-100 text-red-800'
      case 'returned': return 'bg-green-100 text-green-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <AppLayout user={user} title="Library Transactions">
      <div className="mx-auto max-w-7xl space-y-6 p-8">
        <h1 className="text-3xl font-bold">Issue & Return</h1>

        {error && <div className="rounded border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>}

        <div className="grid gap-4 sm:grid-cols-4">
          <div className="content-card p-4"><p className="text-xs text-slate-500">Borrowed</p><p className="text-2xl font-bold text-blue-700">{stats.borrowed}</p></div>
          <div className="content-card p-4"><p className="text-xs text-slate-500">Overdue</p><p className="text-2xl font-bold text-red-700">{stats.overdue}</p></div>
          <div className="content-card p-4"><p className="text-xs text-slate-500">Returned</p><p className="text-2xl font-bold text-green-700">{stats.returned}</p></div>
          <div className="content-card p-4"><p className="text-xs text-slate-500">Fines recorded</p><p className="text-2xl font-bold">NGN {stats.fines.toLocaleString()}</p></div>
        </div>

        <div className="content-card grid gap-3 p-4 sm:grid-cols-3">
          <select value={issueForm.bookId} onChange={(e) => setIssueForm({ ...issueForm, bookId: e.target.value })} className="rounded border p-2">
            <option value="">Select book</option>
            {books.map((b) => <option key={b.id} value={b.id}>{b.title} ({b.availableQuantity} left)</option>)}
          </select>
          <select value={issueForm.studentId} onChange={(e) => setIssueForm({ ...issueForm, studentId: e.target.value })} className="rounded border p-2">
            <option value="">Select student</option>
            {students.map((s) => <option key={s.id} value={s.id}>{s.user.firstName} {s.user.lastName}</option>)}
          </select>
          <button type="button" onClick={handleIssue} disabled={issuing} className="rounded bg-school-navy py-2 font-medium text-white disabled:opacity-60">
            {issuing ? 'Issuing...' : 'Issue Book'}
          </button>
        </div>

        <div className="flex gap-2 border-b">
          {(['all', 'borrowed', 'overdue', 'returned'] as const).map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setFilterStatus(status)}
              className={`px-4 py-2 font-medium capitalize ${filterStatus === status ? 'border-b-2 border-school-navy text-school-navy' : 'text-slate-600'}`}
            >
              {status}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="content-card p-8 text-center text-slate-500">Loading transactions...</div>
        ) : filteredTransactions.length === 0 ? (
          <div className="content-card p-8 text-center text-slate-600">No transactions.</div>
        ) : (
          <div className="overflow-x-auto rounded-xl border bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left">
                <tr>
                  <th className="px-4 py-3">Book</th>
                  <th className="px-4 py-3">Student</th>
                  <th className="px-4 py-3">Borrowed</th>
                  <th className="px-4 py-3">Due</th>
                  <th className="px-4 py-3">Returned</th>
                  <th className="px-4 py-3">Fine</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredTransactions.map((trans) => (
                  <tr key={trans.id} className="border-t">
                    <td className="px-4 py-3 font-medium">{trans.book.title}</td>
                    <td className="px-4 py-3">{trans.student.firstName} {trans.student.lastName}</td>
                    <td className="px-4 py-3">{new Date(trans.borrowedAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3">{new Date(trans.dueAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3">{trans.returnedAt ? new Date(trans.returnedAt).toLocaleDateString() : '—'}</td>
                    <td className="px-4 py-3">{trans.fineAmount ? `NGN ${trans.fineAmount}` : '—'}</td>
                    <td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-xs ${getStatusColor(trans.status)}`}>{trans.status}</span></td>
                    <td className="px-4 py-3">
                      {trans.status !== 'returned' && (
                        <button type="button" onClick={() => handleReturnBook(trans.id)} className="text-green-700 hover:underline">Return</button>
                      )}
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

export default withAuth(AdminLibraryTransactionsPage, { roles: ['SuperAdmin', 'SchoolAdmin', 'Librarian'] })
