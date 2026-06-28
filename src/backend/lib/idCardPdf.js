const PDFDocument = require('pdfkit')
const QRCode = require('qrcode')

function initials(name) {
  return String(name || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || '')
    .join('')
}

async function streamIdCardPdf(res, card, school) {
  const width = 340
  const height = 214
  const doc = new PDFDocument({ size: [width, height], margin: 0 })
  const primary = school?.secondaryColor || '#0b1f4a'
  const accent = school?.primaryColor || '#f59e0b'
  const schoolName = school?.name || 'SchoolPilot'
  const frontendBase = process.env.FRONTEND_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const verifyUrl = `${frontendBase}/verify-id-card?code=${card.verifyCode}`
  const qrBuffer = await QRCode.toBuffer(verifyUrl, { margin: 0, width: 72 })

  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', `attachment; filename="id-card-${card.cardNumber}.pdf"`)
  doc.pipe(res)

  doc.rect(0, 0, width, 52).fill(primary)
  doc.fillColor('#ffffff').fontSize(11).text(schoolName, 12, 14, { width: width - 24, align: 'center' })
  doc.fontSize(8).text(card.cardType === 'staff' ? 'STAFF IDENTITY CARD' : 'STUDENT IDENTITY CARD', 12, 32, {
    width: width - 24,
    align: 'center',
  })

  const photoX = 16
  const photoY = 64
  doc.roundedRect(photoX, photoY, 64, 64, 4).lineWidth(1).strokeColor(accent).stroke()
  doc.roundedRect(photoX, photoY, 64, 64, 4).fill('#e2e8f0')
  doc.fillColor(primary).fontSize(22).text(initials(card.holderName), photoX, photoY + 20, { width: 64, align: 'center' })

  const infoX = 92
  let y = 68
  doc.fillColor(primary).fontSize(13).font('Helvetica-Bold').text(card.holderName, infoX, y, { width: 170 })
  y += 20
  doc.font('Helvetica').fontSize(9).fillColor('#374151')
  if (card.roleLabel) {
    doc.text(card.roleLabel, infoX, y)
    y += 14
  }
  if (card.departmentOrClass) {
    doc.text(card.departmentOrClass, infoX, y)
    y += 14
  }
  if (card.idNumber) {
    doc.text(`ID: ${card.idNumber}`, infoX, y)
    y += 14
  }
  if (card.bloodType) {
    doc.text(`Blood: ${card.bloodType}`, infoX, y)
    y += 14
  }

  doc.image(qrBuffer, width - 88, height - 88, { width: 72 })
  doc.fontSize(7).fillColor('#64748b').text('Scan to verify', width - 88, height - 14, { width: 72, align: 'center' })

  doc.fontSize(7).fillColor('#64748b')
  doc.text(`Card: ${card.cardNumber}`, 12, height - 28)
  doc.text(`Expires: ${new Date(card.expiresAt).toLocaleDateString()}`, 12, height - 16)

  doc.end()
}

module.exports = { streamIdCardPdf }
