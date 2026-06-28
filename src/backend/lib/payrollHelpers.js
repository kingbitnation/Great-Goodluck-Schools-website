const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function periodLabel(month, year) {
  return `${MONTH_NAMES[month - 1]} ${year}`
}

function parseAllowances(raw) {
  if (!raw) return []
  if (Array.isArray(raw)) return raw.filter((a) => a && a.name && Number(a.amount) > 0)
  return []
}

function parseCustomDeductions(raw) {
  if (!raw) return []
  if (Array.isArray(raw)) return raw.filter((d) => d && d.name && Number(d.amount) > 0)
  return []
}

function roundMoney(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100
}

function defaultPayrollSettings() {
  return {
    currency: 'NGN',
    payeTaxRate: 7.5,
    pensionEmployeeRate: 8,
    pensionEmployerRate: 10,
    nhfRate: 2.5,
    taxFreeAllowance: 0,
  }
}

async function getOrCreatePayrollSettings(prisma, schoolId) {
  let settings = await prisma.payrollSetting.findUnique({ where: { schoolId } })
  if (!settings) {
    settings = await prisma.payrollSetting.create({
      data: { schoolId, ...defaultPayrollSettings() },
    })
  }
  return settings
}

function computePayslip(profile, employee, settings) {
  const allowances = parseAllowances(profile?.allowances)
  const customDeductions = parseCustomDeductions(profile?.customDeductions)
  const baseSalary = Number(profile?.baseSalary || 0)

  const earnings = [{ name: 'Basic Salary', amount: roundMoney(baseSalary) }]
  for (const a of allowances) {
    earnings.push({ name: a.name, amount: roundMoney(a.amount) })
  }

  const grossPay = roundMoney(earnings.reduce((s, e) => s + e.amount, 0))
  const pensionBase = roundMoney(baseSalary + allowances.reduce((s, a) => s + Number(a.amount), 0))

  const pensionEmployee = roundMoney((pensionBase * settings.pensionEmployeeRate) / 100)
  const pensionEmployer = roundMoney((pensionBase * settings.pensionEmployerRate) / 100)
  const nhf = roundMoney((baseSalary * settings.nhfRate) / 100)
  const taxableIncome = Math.max(0, grossPay - pensionEmployee - settings.taxFreeAllowance)
  const paye = roundMoney((taxableIncome * settings.payeTaxRate) / 100)

  const deductions = [
    { name: 'PAYE Tax', type: 'tax', amount: paye },
    { name: 'Pension (Employee)', type: 'pension', amount: pensionEmployee },
    { name: 'NHF', type: 'nhf', amount: nhf },
  ]
  for (const d of customDeductions) {
    deductions.push({ name: d.name, type: d.type || 'custom', amount: roundMoney(d.amount) })
  }

  const totalDeductions = roundMoney(deductions.reduce((s, d) => s + d.amount, 0))
  const netPay = roundMoney(grossPay - totalDeductions)

  return {
    employeeId: employee.id,
    employeeNo: employee.employeeNo,
    employeeName: `${employee.firstName} ${employee.lastName}`,
    department: employee.department,
    jobTitle: employee.jobTitle,
    grossPay,
    totalDeductions,
    netPay,
    earnings,
    deductions,
    employerContributions: [
      { name: 'Pension (Employer)', amount: pensionEmployer },
    ],
  }
}

function formatCurrency(amount, currency = 'NGN') {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency }).format(amount)
}

module.exports = {
  MONTH_NAMES,
  periodLabel,
  parseAllowances,
  parseCustomDeductions,
  roundMoney,
  defaultPayrollSettings,
  getOrCreatePayrollSettings,
  computePayslip,
  formatCurrency,
}
