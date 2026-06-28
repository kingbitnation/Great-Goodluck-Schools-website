const PDFDocument = require('pdfkit')
const QRCode = require('qrcode')

const TYPE_HEADINGS = {
  graduation: 'Certificate of Graduation',
  attendance: 'Certificate of Attendance',
  excellence: 'Certificate of Excellence',
}

async function streamSchoolCertificate(res, certificate, school) {
  const doc = new PDFDocument({ margin: 50, size: 'A4', layout: 'landscape' })
  const primary = school?.secondaryColor || '#0b1f4a'
  const accent = school?.primaryColor || '#f59e0b'
  const schoolName = school?.name || 'SchoolPilot'
  const heading = TYPE_HEADINGS[certificate.certificateType] || certificate.title
  const frontendBase = process.env.FRONTEND_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const verifyUrl = `${frontendBase}/verify-certificate?code=${certificate.verifyCode}`
  const qrBuffer = await QRCode.toBuffer(verifyUrl, { margin: 1, width: 140 })

  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="certificate-${certificate.certificateNumber}.pdf"`
  )
  doc.pipe(res)

  doc.rect(0, 0, doc.page.width, doc.page.height).fill('#fafafa')
  doc.rect(30, 30, doc.page.width - 60, doc.page.height - 60).lineWidth(3).strokeColor(accent).stroke()
  doc.rect(40, 40, doc.page.width - 80, doc.page.height - 80).lineWidth(1).strokeColor(primary).stroke()

  doc.fillColor(primary).fontSize(26).text(schoolName, 60, 65, {
    align: 'center',
    width: doc.page.width - 120,
  })
  doc.fontSize(16).fillColor(accent).text(heading, { align: 'center' })
  doc.moveDown(1.2)

  doc.fillColor('#111827').fontSize(12).text('This is to certify that', { align: 'center' })
  doc.moveDown(0.4)
  doc.fontSize(28).fillColor(primary).text(certificate.recipientName, { align: 'center' })
  doc.moveDown(0.6)

  const body = certificate.description || defaultBody(certificate)
  doc.fontSize(12).fillColor('#374151').text(body, 80, doc.y, {
    align: 'center',
    width: doc.page.width - 160,
  })
  doc.moveDown(1.2)

  if (certificate.className || certificate.sessionLabel) {
    doc.fontSize(11).fillColor('#64748b').text(
      [certificate.className, certificate.sessionLabel].filter(Boolean).join(' · '),
      { align: 'center' }
    )
  }

  doc.image(qrBuffer, doc.page.width - 200, doc.page.height - 170, { width: 110 })
  doc.fontSize(9).fillColor('#64748b')
  doc.text('Scan to verify', doc.page.width - 200, doc.page.height - 55, { width: 110, align: 'center' })

  doc.fontSize(10)
  doc.text(`Certificate No: ${certificate.certificateNumber}`, 60, doc.page.height - 100)
  doc.text(`Issued: ${new Date(certificate.issuedAt).toLocaleDateString()}`, 60, doc.page.height - 85)
  doc.text(`Verify code: ${certificate.verifyCode}`, 60, doc.page.height - 70)

  doc.end()
}

function defaultBody(certificate) {
  if (certificate.certificateType === 'graduation') {
    return 'has successfully completed the requirements for graduation and is hereby awarded this certificate.'
  }
  if (certificate.certificateType === 'attendance') {
    return 'has demonstrated exemplary attendance and punctuality throughout the academic session.'
  }
  if (certificate.certificateType === 'excellence') {
    return 'has demonstrated outstanding excellence and is recognized for exceptional achievement.'
  }
  return 'is hereby awarded this certificate in recognition of their achievement.'
}

module.exports = { streamSchoolCertificate }
