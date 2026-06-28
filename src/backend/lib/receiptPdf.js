const PDFDocument = require('pdfkit')

function streamPaymentReceipt(res, payment, school) {
  const doc = new PDFDocument({ margin: 50, size: 'A4' })
  const receiptNo = payment.receiptNumber || `RCP-${payment.id.slice(-8).toUpperCase()}`
  const studentName = `${payment.student.user.firstName} ${payment.student.user.lastName}`

  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', `attachment; filename="receipt-${receiptNo}.pdf"`)
  doc.pipe(res)

  const primary = school?.secondaryColor || '#0b1f4a'
  const accent = school?.primaryColor || '#f59e0b'

  doc.rect(0, 0, doc.page.width, 90).fill(primary)
  doc.fillColor('#ffffff').fontSize(20).text(school?.name || 'SchoolPilot', 50, 35)
  doc.fontSize(11).text('Official Payment Receipt', 50, 62)

  doc.fillColor('#111827').fontSize(14).text('Receipt Details', 50, 120)
  doc.moveTo(50, 140).lineTo(545, 140).strokeColor(accent).stroke()

  const rows = [
    ['Receipt No.', receiptNo],
    ['Date', new Date(payment.paidAt || payment.createdAt).toLocaleString()],
    ['Student', studentName],
    ['Class', payment.student.class?.name || 'N/A'],
    ['Fee', payment.fee?.name || 'General payment'],
    ['Reference', payment.paymentReference || '—'],
    ['Gateway', payment.gateway],
    ['Amount', `₦${Number(payment.amount).toLocaleString()}`],
    ['Paid', `₦${Number(payment.paidAmount || payment.amount).toLocaleString()}`],
  ]

  if (payment.discountApplied > 0) rows.push(['Discount', `-₦${payment.discountApplied.toLocaleString()}`])
  if (payment.penaltyApplied > 0) rows.push(['Penalty', `+₦${payment.penaltyApplied.toLocaleString()}`])

  let y = 155
  doc.fontSize(10)
  for (const [label, value] of rows) {
    doc.fillColor('#64748b').text(label, 50, y, { width: 140 })
    doc.fillColor('#111827').font('Helvetica-Bold').text(String(value), 200, y)
    doc.font('Helvetica')
    y += 22
  }

  doc.fillColor('#64748b').fontSize(9).text(
    'This is a computer-generated receipt. For enquiries contact the bursary office.',
    50,
    doc.page.height - 80,
    { align: 'center', width: doc.page.width - 100 }
  )

  doc.end()
}

module.exports = { streamPaymentReceipt }
