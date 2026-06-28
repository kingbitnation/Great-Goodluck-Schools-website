const { checkTenantAccess } = require('../lib/tenantHelpers')
const {
  tenantWhere,
  formatBook,
  formatTransaction,
  getOrCreateLibrarySettings,
  computeFine,
  bookWhereForSchool,
  resolveSchoolId,
} = require('../lib/libraryHelpers')
const { dispatchNotification } = require('../lib/notificationDispatcher')

function registerLibraryRoutes(app, { prisma, requireRole, enqueueEmail }) {
  const staffRoles = ['SuperAdmin', 'SchoolAdmin', 'Librarian']
  const browseRoles = [...staffRoles, 'Teacher', 'Student']

  app.get('/api/library/stats', requireRole(...staffRoles), async (req, res) => {
    try {
      const schoolId = resolveSchoolId(req)
      if (!schoolId) return res.status(400).json({ error: 'School required' })

      const bookWhere = bookWhereForSchool(schoolId)
      const [totalBooks, available, borrowed, overdue, outstandingFines] = await Promise.all([
        prisma.book.count({ where: bookWhere }),
        prisma.book.aggregate({ where: bookWhere, _sum: { availableCopies: true } }),
        prisma.libraryTransaction.count({ where: { schoolId, returned: false } }),
        prisma.libraryTransaction.count({
          where: { schoolId, returned: false, dueDate: { lt: new Date() } },
        }),
        prisma.libraryTransaction.aggregate({
          where: { schoolId, fineAmount: { gt: 0 }, returned: true },
          _sum: { fineAmount: true },
        }),
      ])

      res.json({
        totalTitles: totalBooks,
        totalCopies: await prisma.book.aggregate({ where: bookWhere, _sum: { copies: true } }).then((r) => r._sum.copies || 0),
        availableCopies: available._sum.availableCopies || 0,
        activeLoans: borrowed,
        overdueLoans: overdue,
        finesCollected: outstandingFines._sum.fineAmount || 0,
      })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.get('/api/library/settings', requireRole(...staffRoles), async (req, res) => {
    try {
      const schoolId = resolveSchoolId(req)
      if (!schoolId) return res.status(400).json({ error: 'School required' })
      res.json(await getOrCreateLibrarySettings(prisma, schoolId))
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.put('/api/library/settings', requireRole(...staffRoles), async (req, res) => {
    try {
      const schoolId = resolveSchoolId(req)
      if (!schoolId) return res.status(400).json({ error: 'School required' })
      await getOrCreateLibrarySettings(prisma, schoolId)
      const { loanDays, finePerDay, maxBooksPerStudent, currency } = req.body
      const settings = await prisma.librarySetting.update({
        where: { schoolId },
        data: {
          loanDays: loanDays != null ? Number(loanDays) : undefined,
          finePerDay: finePerDay != null ? Number(finePerDay) : undefined,
          maxBooksPerStudent: maxBooksPerStudent != null ? Number(maxBooksPerStudent) : undefined,
          currency: currency || undefined,
        },
      })
      res.json(settings)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.get('/api/library/books', requireRole(...browseRoles), async (req, res) => {
    try {
      const schoolId = resolveSchoolId(req)
      if (!schoolId && req.user.role !== 'SuperAdmin') return res.json([])

      const q = String(req.query.q || '').trim().toLowerCase()
      const category = String(req.query.category || '').trim()
      const where = schoolId ? bookWhereForSchool(schoolId) : {}

      if (category && category !== 'all') where.category = category
      if (q) {
        where.AND = [{
          OR: [
            { title: { contains: q, mode: 'insensitive' } },
            { author: { contains: q, mode: 'insensitive' } },
            { isbn: { contains: q, mode: 'insensitive' } },
          ],
        }]
      }

      const books = await prisma.book.findMany({ where, orderBy: { title: 'asc' } })
      res.json(books.map(formatBook))
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.post('/api/library/books', requireRole(...staffRoles), async (req, res) => {
    try {
      const schoolId = resolveSchoolId(req)
      if (!schoolId) return res.status(400).json({ error: 'School required' })

      const { title, author, isbn, publisher, year, quantity, copies, category, description, thumbnail } = req.body
      if (!title || !author) return res.status(400).json({ error: 'Title and author required' })

      const totalCopies = Number(quantity ?? copies ?? 1)
      const book = await prisma.book.create({
        data: {
          schoolId,
          title,
          author,
          isbn: isbn || null,
          publisher: publisher || null,
          year: year ? Number(year) : null,
          copies: totalCopies,
          availableCopies: totalCopies,
          category: category || 'General',
          description: description || null,
          thumbnail: thumbnail || null,
        },
      })
      res.status(201).json(formatBook(book))
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.put('/api/library/books/:id', requireRole(...staffRoles), async (req, res) => {
    try {
      const book = await prisma.book.findUnique({ where: { id: req.params.id } })
      if (!book) return res.status(404).json({ error: 'Not found' })
      if (book.schoolId && !checkTenantAccess(req, book.schoolId)) return res.status(403).json({ error: 'Forbidden' })

      const copies = req.body.quantity !== undefined ? Number(req.body.quantity) : req.body.copies !== undefined ? Number(req.body.copies) : undefined
      const onLoan = book.copies - book.availableCopies
      const nextAvailable = copies !== undefined ? Math.max(0, copies - onLoan) : undefined

      const updated = await prisma.book.update({
        where: { id: book.id },
        data: {
          title: req.body.title || undefined,
          author: req.body.author || undefined,
          isbn: req.body.isbn !== undefined ? req.body.isbn : undefined,
          publisher: req.body.publisher !== undefined ? req.body.publisher : undefined,
          year: req.body.year !== undefined ? Number(req.body.year) : undefined,
          copies,
          availableCopies: nextAvailable,
          category: req.body.category !== undefined ? req.body.category : undefined,
          description: req.body.description !== undefined ? req.body.description : undefined,
          thumbnail: req.body.thumbnail !== undefined ? req.body.thumbnail : undefined,
          schoolId: book.schoolId || resolveSchoolId(req) || undefined,
        },
      })
      res.json(formatBook(updated))
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.delete('/api/library/books/:id', requireRole(...staffRoles), async (req, res) => {
    try {
      const book = await prisma.book.findUnique({ where: { id: req.params.id } })
      if (!book) return res.status(404).json({ error: 'Not found' })
      if (book.schoolId && !checkTenantAccess(req, book.schoolId)) return res.status(403).json({ error: 'Forbidden' })

      const active = await prisma.libraryTransaction.count({ where: { bookId: book.id, returned: false } })
      if (active > 0) return res.status(400).json({ error: 'Cannot delete book with active loans' })

      await prisma.book.delete({ where: { id: book.id } })
      res.json({ message: 'Deleted' })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.get('/api/library/transactions', requireRole(...staffRoles, 'Student'), async (req, res) => {
    try {
      const schoolId = resolveSchoolId(req)
      const where = schoolId ? { schoolId } : {}

      if (req.user.role === 'Student') {
        const student = await prisma.student.findUnique({ where: { userId: req.user.userId || req.user.id } })
        if (!student) return res.json([])
        where.studentId = student.id
      } else if (req.query.studentId) {
        where.studentId = String(req.query.studentId)
      }

      const transactions = await prisma.libraryTransaction.findMany({
        where,
        include: {
          book: true,
          student: { include: { user: true, class: true } },
        },
        orderBy: { issueDate: 'desc' },
      })
      res.json(transactions.map((t) => formatTransaction(t)))
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.get('/api/library/my-books', requireRole('Student'), async (req, res) => {
    try {
      const student = await prisma.student.findUnique({ where: { userId: req.user.userId || req.user.id } })
      if (!student) return res.json([])

      const transactions = await prisma.libraryTransaction.findMany({
        where: { studentId: student.id },
        include: { book: true },
        orderBy: { issueDate: 'desc' },
      })
      res.json(transactions.map((t) => formatTransaction(t)))
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.post('/api/library/books/:id/borrow', requireRole('Student'), async (req, res) => {
    try {
      const student = await prisma.student.findUnique({ where: { userId: req.user.userId || req.user.id } })
      if (!student) return res.status(400).json({ error: 'Student profile not found' })

      const settings = await getOrCreateLibrarySettings(prisma, student.schoolId)
      const activeCount = await prisma.libraryTransaction.count({
        where: { studentId: student.id, returned: false },
      })
      if (activeCount >= settings.maxBooksPerStudent) {
        return res.status(400).json({ error: `Maximum ${settings.maxBooksPerStudent} books allowed` })
      }

      const book = await prisma.book.findUnique({ where: { id: req.params.id } })
      if (!book || (book.schoolId && book.schoolId !== student.schoolId)) {
        return res.status(404).json({ error: 'Book not found' })
      }
      if (book.availableCopies < 1) return res.status(400).json({ error: 'Book not available' })

      const due = new Date()
      due.setDate(due.getDate() + settings.loanDays)

      const transaction = await prisma.$transaction(async (tx) => {
        const created = await tx.libraryTransaction.create({
          data: {
            schoolId: student.schoolId,
            bookId: book.id,
            studentId: student.id,
            issueDate: new Date(),
            dueDate: due,
          },
          include: { book: true },
        })
        await tx.book.update({
          where: { id: book.id },
          data: { availableCopies: book.availableCopies - 1 },
        })
        return created
      })

      res.status(201).json(formatTransaction({ ...transaction, student }))
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.post('/api/library/transactions/issue', requireRole(...staffRoles), async (req, res) => {
    try {
      const schoolId = resolveSchoolId(req)
      if (!schoolId) return res.status(400).json({ error: 'School required' })

      const { bookId, studentId, dueDate } = req.body
      if (!bookId || !studentId) return res.status(400).json({ error: 'Book and student required' })

      const [book, student, settings] = await Promise.all([
        prisma.book.findUnique({ where: { id: bookId } }),
        prisma.student.findUnique({ where: { id: studentId } }),
        getOrCreateLibrarySettings(prisma, schoolId),
      ])
      if (!book || !student || student.schoolId !== schoolId) return res.status(404).json({ error: 'Invalid book or student' })
      if (book.availableCopies < 1) return res.status(400).json({ error: 'No copies available' })

      const due = dueDate ? new Date(dueDate) : new Date(Date.now() + settings.loanDays * 86400000)

      const transaction = await prisma.$transaction(async (tx) => {
        const created = await tx.libraryTransaction.create({
          data: {
            schoolId,
            bookId,
            studentId,
            issueDate: new Date(),
            dueDate: due,
          },
          include: { book: true, student: { include: { user: true, class: true } } },
        })
        await tx.book.update({
          where: { id: bookId },
          data: { availableCopies: book.availableCopies - 1 },
        })
        return created
      })

      res.status(201).json(formatTransaction(transaction))
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.post('/api/library/transactions/:id/return', requireRole(...staffRoles), async (req, res) => {
    try {
      const existing = await prisma.libraryTransaction.findUnique({
        where: { id: req.params.id },
        include: { book: true, student: { include: { user: true } } },
      })
      if (!existing) return res.status(404).json({ error: 'Transaction not found' })
      if (!checkTenantAccess(req, existing.schoolId)) return res.status(403).json({ error: 'Forbidden' })
      if (existing.returned) return res.json(formatTransaction(existing))

      const settings = await getOrCreateLibrarySettings(prisma, existing.schoolId)
      const returnDate = new Date()
      const fineAmount = computeFine(existing.dueDate, returnDate, settings.finePerDay)

      const transaction = await prisma.$transaction(async (tx) => {
        const updated = await tx.libraryTransaction.update({
          where: { id: existing.id },
          data: { returned: true, returnDate, fineAmount },
          include: { book: true, student: { include: { user: true, class: true } } },
        })
        await tx.book.update({
          where: { id: existing.bookId },
          data: { availableCopies: existing.book.availableCopies + 1 },
        })
        return updated
      })

      if (fineAmount > 0 && existing.student?.userId) {
        await dispatchNotification(prisma, {
          userId: existing.student.userId,
          schoolId: existing.schoolId,
          type: 'library',
          title: 'Library fine issued',
          body: `Overdue return fine of ₦${fineAmount.toLocaleString()} for "${existing.book.title}".`,
          payload: {
            bookTitle: existing.book.title,
            fineAmount,
            currency: settings.currency,
          },
          emailPayload: {
            firstName: existing.student.user?.firstName || 'Student',
            bookTitle: existing.book.title,
            fineAmount,
            currency: settings.currency,
          },
        })
      }

      res.json(formatTransaction(transaction))
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.get('/api/library/inventory', requireRole(...staffRoles), async (req, res) => {
    try {
      const schoolId = resolveSchoolId(req)
      if (!schoolId) return res.status(400).json({ error: 'School required' })

      const books = await prisma.book.findMany({
        where: bookWhereForSchool(schoolId),
        orderBy: { title: 'asc' },
      })

      const byCategory = books.reduce((acc, b) => {
        const cat = b.category || 'General'
        if (!acc[cat]) acc[cat] = { category: cat, titles: 0, copies: 0, available: 0 }
        acc[cat].titles++
        acc[cat].copies += b.copies
        acc[cat].available += b.availableCopies
        return acc
      }, {})

      res.json({
        books: books.map(formatBook),
        categories: Object.values(byCategory),
      })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })
}

module.exports = { registerLibraryRoutes }
