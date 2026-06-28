const { tenantWhere } = require('../middleware/tenantGuard')

function formatBook(book) {
  return {
    id: book.id,
    schoolId: book.schoolId,
    title: book.title,
    author: book.author,
    isbn: book.isbn || '',
    publisher: book.publisher,
    year: book.year,
    copies: book.copies,
    availableCopies: book.availableCopies,
    quantity: book.copies,
    availableQuantity: book.availableCopies,
    category: book.category || 'General',
    description: book.description,
    thumbnail: book.thumbnail,
    createdAt: book.createdAt,
  }
}

function formatTransaction(t, now = new Date()) {
  const status = t.returned ? 'returned' : new Date(t.dueDate) < now ? 'overdue' : 'borrowed'
  return {
    id: t.id,
    bookId: t.bookId,
    book: t.book ? formatBook(t.book) : null,
    studentId: t.studentId,
    student: t.student ? {
      id: t.student.id,
      firstName: t.student.user?.firstName || '',
      lastName: t.student.user?.lastName || '',
      email: t.student.user?.email || '',
      className: t.student.class?.name || null,
    } : null,
    borrowedAt: t.issueDate,
    dueAt: t.dueDate,
    returnedAt: t.returnDate,
    fineAmount: t.fineAmount,
    status,
  }
}

function defaultLibrarySettings() {
  return {
    loanDays: 14,
    finePerDay: 50,
    maxBooksPerStudent: 3,
    currency: 'NGN',
  }
}

async function getOrCreateLibrarySettings(prisma, schoolId) {
  let settings = await prisma.librarySetting.findUnique({ where: { schoolId } })
  if (!settings) {
    settings = await prisma.librarySetting.create({
      data: { schoolId, ...defaultLibrarySettings() },
    })
  }
  return settings
}

function computeFine(dueDate, returnDate, finePerDay) {
  const due = new Date(dueDate)
  const returned = returnDate ? new Date(returnDate) : new Date()
  if (returned <= due) return 0
  const daysLate = Math.ceil((returned - due) / (1000 * 60 * 60 * 24))
  return Math.round(daysLate * finePerDay * 100) / 100
}

function bookWhereForSchool(schoolId, extra = {}) {
  return {
    OR: [{ schoolId }, { schoolId: null }],
    ...extra,
  }
}

function resolveSchoolId(req) {
  if (req.user.role === 'SuperAdmin' && req.query.schoolId) return String(req.query.schoolId)
  return req.user.schoolId
}

module.exports = {
  tenantWhere,
  formatBook,
  formatTransaction,
  defaultLibrarySettings,
  getOrCreateLibrarySettings,
  computeFine,
  bookWhereForSchool,
  resolveSchoolId,
}
