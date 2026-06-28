const PDFDocument = require('pdfkit')

function streamCourseCertificate(res, certificate, course, student, school) {
  const doc = new PDFDocument({ margin: 50, size: 'A4', layout: 'landscape' })
  const studentName = `${student.user.firstName} ${student.user.lastName}`
  const primary = school?.secondaryColor || '#0b1f4a'
  const accent = school?.primaryColor || '#f59e0b'

  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="certificate-${certificate.certificateNumber}.pdf"`
  )
  doc.pipe(res)

  doc.rect(0, 0, doc.page.width, doc.page.height).fill('#fafafa')
  doc.rect(30, 30, doc.page.width - 60, doc.page.height - 60).lineWidth(3).strokeColor(accent).stroke()
  doc.rect(40, 40, doc.page.width - 80, doc.page.height - 80).lineWidth(1).strokeColor(primary).stroke()

  doc.fillColor(primary).fontSize(28).text(school?.name || 'SchoolPilot', 60, 70, {
    align: 'center',
    width: doc.page.width - 120,
  })
  doc.fontSize(14).fillColor('#64748b').text('Certificate of Completion', { align: 'center' })
  doc.moveDown(1.5)

  doc.fillColor('#111827').fontSize(12).text('This certifies that', { align: 'center' })
  doc.moveDown(0.5)
  doc.fontSize(26).fillColor(primary).text(studentName, { align: 'center' })
  doc.moveDown(0.5)
  doc.fontSize(12).fillColor('#111827').text('has successfully completed the course', { align: 'center' })
  doc.moveDown(0.5)
  doc.fontSize(20).fillColor(accent).text(course.title, { align: 'center' })
  doc.moveDown(2)

  doc.fontSize(10).fillColor('#64748b')
  doc.text(`Certificate No: ${certificate.certificateNumber}`, 60, doc.page.height - 100)
  doc.text(`Issued: ${new Date(certificate.issuedAt).toLocaleDateString()}`, 60, doc.page.height - 85)
  doc.text(`Verify: ${certificate.verifyCode}`, 60, doc.page.height - 70)

  doc.end()
}

module.exports = { streamCourseCertificate }
