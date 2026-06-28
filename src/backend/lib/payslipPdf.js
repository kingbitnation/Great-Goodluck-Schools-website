const { streamBrandedPdf } = require('./brandedPdf')
const { formatCurrency } = require('./payrollHelpers')

function streamPayslipPdf(res, { school, payslip, periodLabel, currency }) {
  const lines = [
    { text: `Period: ${periodLabel}`, bold: true },
    { text: `Employee: ${payslip.employeeName} (${payslip.employeeNo})` },
    { text: `Department: ${payslip.department || '—'} · ${payslip.jobTitle || 'Staff'}` },
    { divider: true },
    { text: 'Earnings', bold: true, size: 12 },
  ]

  for (const e of payslip.earnings || []) {
    lines.push({ text: `${e.name}: ${formatCurrency(e.amount, currency)}` })
  }
  lines.push({ text: `Gross Pay: ${formatCurrency(payslip.grossPay, currency)}`, bold: true })
  lines.push({ divider: true })
  lines.push({ text: 'Deductions', bold: true, size: 12 })

  for (const d of payslip.deductions || []) {
    lines.push({ text: `${d.name}: ${formatCurrency(d.amount, currency)}` })
  }
  lines.push({ text: `Total Deductions: ${formatCurrency(payslip.totalDeductions, currency)}`, bold: true })
  lines.push({ divider: true })
  lines.push({ text: `Net Pay: ${formatCurrency(payslip.netPay, currency)}`, bold: true, size: 14 })

  if (payslip.employerContributions?.length) {
    lines.push({ divider: true })
    lines.push({ text: 'Employer contributions (informational)', bold: true, size: 11 })
    for (const c of payslip.employerContributions) {
      lines.push({ text: `${c.name}: ${formatCurrency(c.amount, currency)}` })
    }
  }

  streamBrandedPdf(res, {
    school,
    title: 'Payslip',
    filename: `payslip-${payslip.employeeNo}-${periodLabel.replace(/\s+/g, '-')}`,
    lines,
  })
}

module.exports = { streamPayslipPdf }
