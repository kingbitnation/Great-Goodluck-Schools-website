const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const { computeFine, formatBook, formatTransaction } = require('../../src/backend/lib/libraryHelpers')

describe('libraryHelpers', () => {
  it('computeFine returns 0 when returned on time', () => {
    const due = new Date('2026-06-01')
    const returned = new Date('2026-05-30')
    assert.equal(computeFine(due, returned, 50), 0)
  })

  it('computeFine charges per overdue day', () => {
    const due = new Date('2026-06-01')
    const returned = new Date('2026-06-03')
    assert.equal(computeFine(due, returned, 50), 100)
  })

  it('formatBook maps copies fields', () => {
    const book = formatBook({
      id: 'b1',
      schoolId: 's1',
      title: 'Physics',
      author: 'Author',
      isbn: '123',
      publisher: 'Pub',
      year: 2024,
      copies: 5,
      availableCopies: 3,
      category: 'Science',
      description: 'Desc',
      thumbnail: null,
      createdAt: new Date(),
    })
    assert.equal(book.quantity, 5)
    assert.equal(book.availableQuantity, 3)
    assert.equal(book.title, 'Physics')
  })

  it('formatTransaction marks overdue loans', () => {
    const now = new Date('2026-06-10')
    const tx = formatTransaction(
      {
        id: 't1',
        bookId: 'b1',
        studentId: 'st1',
        issueDate: new Date('2026-05-01'),
        dueDate: new Date('2026-06-01'),
        returnDate: null,
        fineAmount: 0,
        returned: false,
        book: null,
        student: null,
      },
      now
    )
    assert.equal(tx.status, 'overdue')
  })
})
