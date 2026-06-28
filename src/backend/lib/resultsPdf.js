const PDFDocument = require('pdfkit')
const { summarizeResults } = require('./resultsHelpers')

function drawHeader(doc, school, title, subtitle) {
  const primary = school?.secondaryColor || '#0b1f4a'
  const accent = school?.primaryColor || '#f59e0b'
  doc.rect(0, 0, doc.page.width, 72).fill(primary)
  doc.fillColor('#ffffff').fontSize(16).text(school?.name || 'SchoolPilot', 50, 22, {
    align: 'center',
    width: doc.page.width - 100,
  })
  doc.fontSize(12).text(title, 50, 44, { align: 'center', width: doc.page.width - 100 })
  if (subtitle) {
    doc.fontSize(9).fillColor('#e2e8f0').text(subtitle, 50, 58, { align: 'center', width: doc.page.width - 100 })
  }
  doc.fillColor('#111827')
  doc.y = 90
  return { accent }
}

function streamReportCardPdf(res, student, school, results) {
  const summary = summarizeResults(results)
  const doc = new PDFDocument({ margin: 50, size: 'A4' })
  const name = `${student.user.firstName} ${student.user.lastName}`

  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', `attachment; filename="reportcard-${student.admissionNo}.pdf"`)
  doc.pipe(res)

  const { accent } = drawHeader(doc, school, 'Student Report Card', student.class?.name || '')

  doc.fontSize(10)
  doc.text(`Student: ${name}`)
  doc.text(`Admission No: ${student.admissionNo}`)
  doc.text(`Class: ${student.class?.name || 'N/A'}`)
  doc.moveDown()

  const tableTop = doc.y
  const cols = [180, 70, 70, 70]
  const headers = ['Subject', 'Score', 'Grade', 'GPA']
  let x = 50
  doc.font('Helvetica-Bold')
  headers.forEach((h, i) => {
    doc.text(h, x, tableTop, { width: cols[i] })
    x += cols[i]
  })
  doc.moveTo(50, tableTop + 14).lineTo(545, tableTop + 14).strokeColor(accent).stroke()

  let y = tableTop + 22
  doc.font('Helvetica')
  for (const r of results.filter((row) => row.published !== false)) {
    x = 50
    const cells = [r.subject?.name || 'Subject', String(r.totalScore), r.grade || '—', String(r.gpa ?? '—')]
    cells.forEach((cell, i) => {
      doc.text(cell, x, y, { width: cols[i] })
      x += cols[i]
    })
    y += 18
    if (y > doc.page.height - 120) {
      doc.addPage()
      y = 50
    }
  }

  doc.moveDown(2)
  doc.font('Helvetica-Bold').text('Summary')
  doc.font('Helvetica')
  doc.text(`Average Score: ${summary.averageScore}%`)
  doc.text(`Average Grade: ${summary.averageGrade}`)
  doc.text(`GPA: ${summary.totalGPA}`)
  doc.text(`Generated: ${new Date().toLocaleDateString()}`)

  doc.end()
}

function streamTranscriptPdf(res, student, school, results) {
  const summary = summarizeResults(results)
  const doc = new PDFDocument({ margin: 50, size: 'A4' })
  const name = `${student.user.firstName} ${student.user.lastName}`

  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', `attachment; filename="transcript-${student.admissionNo}.pdf"`)
  doc.pipe(res)

  drawHeader(doc, school, 'Academic Transcript')

  doc.fontSize(10).text(`Name: ${name}`)
  doc.text(`Admission No: ${student.admissionNo}`)
  doc.text(`Class: ${student.class?.name || 'N/A'}`)
  doc.moveDown()

  for (const r of results) {
    const examLabel = r.exam?.name ? ` (${r.exam.name})` : ''
    doc.text(
      `${r.subject?.name || 'Subject'}${examLabel}: ${r.totalScore} — Grade ${r.grade || 'N/A'} — GPA ${r.gpa ?? 'N/A'}`
    )
  }

  doc.moveDown()
  doc.font('Helvetica-Bold').text('Cumulative Summary')
  doc.font('Helvetica')
  doc.text(`Records: ${summary.totalSubjects}`)
  doc.text(`Average Score: ${summary.averageScore}%`)
  doc.text(`Cumulative GPA: ${summary.totalGPA}`)

  doc.end()
}

function streamBroadsheetPdf(res, school, className, broadsheet, termLabel) {
  const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape' })
  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', `attachment; filename="broadsheet-${className.replace(/\s+/g, '-')}.pdf"`)
  doc.pipe(res)

  drawHeader(doc, school, 'Class Broadsheet', `${className}${termLabel ? ` — ${termLabel}` : ''}`)

  const { subjects, rows } = broadsheet
  const startX = 40
  let y = doc.y
  const nameWidth = 120
  const colWidth = Math.min(55, (doc.page.width - 80 - nameWidth - 120) / Math.max(subjects.length, 1))
  const tailWidth = 40

  doc.font('Helvetica-Bold').fontSize(8)
  doc.text('Student', startX, y, { width: nameWidth })
  let x = startX + nameWidth
  for (const sub of subjects) {
    doc.text(sub.code || sub.name.slice(0, 6), x, y, { width: colWidth, align: 'center' })
    x += colWidth
  }
  doc.text('Avg', x, y, { width: tailWidth, align: 'center' })
  doc.text('Rank', x + tailWidth, y, { width: tailWidth, align: 'center' })

  y += 14
  doc.moveTo(startX, y).lineTo(doc.page.width - 40, y).strokeColor('#cbd5e1').stroke()
  y += 6

  doc.font('Helvetica').fontSize(7)
  for (const row of rows) {
    doc.text(row.name, startX, y, { width: nameWidth })
    x = startX + nameWidth
    for (const sub of subjects) {
      const cell = row.scores[sub.id]
      doc.text(cell ? String(cell.score) : '—', x, y, { width: colWidth, align: 'center' })
      x += colWidth
    }
    doc.text(String(row.average), x, y, { width: tailWidth, align: 'center' })
    doc.text(String(row.rank), x + tailWidth, y, { width: tailWidth, align: 'center' })
    y += 12
    if (y > doc.page.height - 50) {
      doc.addPage()
      y = 50
    }
  }

  doc.end()
}

module.exports = { streamReportCardPdf, streamTranscriptPdf, streamBroadsheetPdf }
