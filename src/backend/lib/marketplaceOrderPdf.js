const PDFDocument = require('pdfkit')

function streamMarketplaceOrderReceipt(res, order, school) {
  const doc = new PDFDocument({ margin: 50, size: 'A4' })
  const receiptNo = order.orderNumber

  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', `attachment; filename="order-${receiptNo}.pdf"`)
  doc.pipe(res)

  const primary = school?.secondaryColor || '#0b1f4a'
  const accent = school?.primaryColor || '#f59e0b'

  doc.rect(0, 0, doc.page.width, 90).fill(primary)
  doc.fillColor('#ffffff').fontSize(20).text(school?.name || 'SchoolPilot', 50, 35)
  doc.fontSize(11).text('Marketplace Order Receipt', 50, 62)

  doc.fillColor('#111827').fontSize(14).text('Order Details', 50, 120)
  doc.moveTo(50, 140).lineTo(545, 140).strokeColor(accent).stroke()

  const rows = [
    ['Order No.', receiptNo],
    ['Date', new Date(order.paidAt || order.createdAt).toLocaleString()],
    ['Customer', order.customerName],
    ['Email', order.customerEmail],
    ['Status', order.status],
    ['Reference', order.reference || '—'],
    ['Gateway', order.gateway || '—'],
    ['Total', `₦${Number(order.totalAmount).toLocaleString()}`],
  ]

  let y = 155
  doc.fontSize(10)
  for (const [label, value] of rows) {
    doc.fillColor('#64748b').text(label, 50, y, { width: 140 })
    doc.fillColor('#111827').font('Helvetica-Bold').text(String(value), 200, y)
    doc.font('Helvetica')
    y += 22
  }

  y += 10
  doc.fillColor('#111827').fontSize(12).text('Items', 50, y)
  y += 20
  doc.fontSize(9)
  for (const item of order.items || []) {
    const line = `${item.productName}${item.size ? ` (${item.size})` : ''} × ${item.quantity}`
    doc.fillColor('#374151').text(line, 50, y, { width: 350 })
    doc.text(`₦${Number(item.subtotal).toLocaleString()}`, 420, y)
    y += 16
  }

  doc.fillColor('#64748b').fontSize(9).text(
    'Thank you for your purchase. Collect items from the school store when status is fulfilled.',
    50,
    doc.page.height - 80,
    { align: 'center', width: doc.page.width - 100 }
  )

  doc.end()
}

module.exports = { streamMarketplaceOrderReceipt }
