const crypto = require('crypto')

function generateReceiptNumber() {
  const suffix = crypto.randomBytes(3).toString('hex').toUpperCase()
  return `RCP-${Date.now().toString(36).toUpperCase()}-${suffix}`
}

function applyAdjustments(baseAmount, adjustments = []) {
  let amount = baseAmount
  let discount = 0
  let penalty = 0

  for (const adj of adjustments) {
    if (!adj.isActive) continue
    const delta = adj.isPercent ? (baseAmount * adj.value) / 100 : adj.value
    if (['scholarship', 'waiver', 'sibling_discount'].includes(adj.type)) {
      discount += delta
      amount -= delta
    } else if (adj.type === 'penalty') {
      penalty += delta
      amount += delta
    }
  }

  return {
    netAmount: Math.max(0, Math.round(amount * 100) / 100),
    discountApplied: Math.round(discount * 100) / 100,
    penaltyApplied: Math.round(penalty * 100) / 100,
    adjustments,
  }
}

async function getActiveAdjustments(prisma, studentId, feeId = null) {
  return prisma.feeAdjustment.findMany({
    where: {
      studentId,
      isActive: true,
      OR: feeId ? [{ feeId }, { feeId: null }] : [{ feeId: null }],
    },
  })
}

async function getCompletedPaidForFee(prisma, studentId, feeId) {
  const payments = await prisma.payment.findMany({
    where: {
      studentId,
      feeId,
      status: { in: ['completed', 'partial'] },
      OR: [
        { verificationStatus: 'approved' },
        { verificationStatus: 'none', gateway: { not: 'manual' } },
      ],
    },
  })
  return payments.reduce((sum, p) => sum + (p.paidAmount || 0), 0)
}

async function computeStudentFeeSummary(prisma, studentId, feeId) {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: { parent: { include: { children: true } } },
  })
  if (!student) return null

  const fee = await prisma.fee.findUnique({
    where: { id: feeId },
    include: { installments: { orderBy: { sortOrder: 'asc' } } },
  })
  if (!fee) return null

  let adjustments = await getActiveAdjustments(prisma, studentId, feeId)

  const siblingCount = student.parent?.children?.length || 0
  if (siblingCount >= 2) {
    const hasSiblingDiscount = adjustments.some((a) => a.type === 'sibling_discount')
    if (!hasSiblingDiscount) {
      adjustments = [
        ...adjustments,
        {
          type: 'sibling_discount',
          value: 5,
          isPercent: true,
          isActive: true,
          reason: 'Automatic 5% sibling discount',
        },
      ]
    }
  }

  const { netAmount, discountApplied, penaltyApplied } = applyAdjustments(fee.amount, adjustments)
  const paid = await getCompletedPaidForFee(prisma, studentId, feeId)
  const outstanding = Math.max(0, netAmount - paid)
  const overdue = fee.dueDate < new Date() && outstanding > 0

  const installments = fee.installments.length
    ? fee.installments.map((inst) => ({
        ...inst,
        paid: 0,
        outstanding: inst.amount,
      }))
    : []

  if (installments.length) {
    let remainingPaid = paid
    for (const inst of installments) {
      const instPaid = Math.min(inst.amount, remainingPaid)
      inst.paid = instPaid
      inst.outstanding = Math.max(0, inst.amount - instPaid)
      remainingPaid -= instPaid
    }
  }

  return {
    fee,
    student,
    baseAmount: fee.amount,
    netAmount,
    discountApplied,
    penaltyApplied,
    paid,
    outstanding,
    overdue,
    adjustments,
    installments,
  }
}

async function computeStudentFeesOverview(prisma, studentId) {
  const student = await prisma.student.findUnique({ where: { id: studentId } })
  if (!student) return null

  const fees = await prisma.fee.findMany({
    where: {
      schoolId: student.schoolId,
      isActive: true,
      OR: [{ classId: null }, { classId: student.classId }],
    },
  })

  const summaries = []
  for (const fee of fees) {
    const summary = await computeStudentFeeSummary(prisma, studentId, fee.id)
    if (summary) summaries.push(summary)
  }

  const totalDue = summaries.reduce((s, x) => s + x.netAmount, 0)
  const totalPaid = summaries.reduce((s, x) => s + x.paid, 0)

  return {
    studentId,
    fees: summaries.map((s) => ({
      id: s.fee.id,
      name: s.fee.name,
      description: s.fee.description,
      dueDate: s.fee.dueDate,
      baseAmount: s.baseAmount,
      netAmount: s.netAmount,
      discountApplied: s.discountApplied,
      penaltyApplied: s.penaltyApplied,
      paid: s.paid,
      outstanding: s.outstanding,
      overdue: s.overdue,
      allowPartial: s.fee.allowPartial,
      installments: s.installments,
      status: s.outstanding <= 0 ? 'paid' : s.overdue ? 'overdue' : 'pending',
    })),
    totalDue,
    totalPaid,
    balance: Math.max(0, totalDue - totalPaid),
  }
}

async function recordLedgerEntry(prisma, { schoolId, entryType, category, amount, paymentId, description, reference }) {
  return prisma.financeLedger.create({
    data: {
      schoolId,
      entryType,
      category,
      amount,
      paymentId: paymentId || null,
      description: description || null,
      reference: reference || null,
      entryDate: new Date(),
    },
  })
}

async function completePayment(prisma, payment, paidAmount, options = {}) {
  const isPartial = paidAmount < payment.amount
  const receiptNumber = payment.receiptNumber || generateReceiptNumber()

  const updated = await prisma.payment.update({
    where: { id: payment.id },
    data: {
      paidAmount,
      status: isPartial ? 'partial' : 'completed',
      verificationStatus: payment.gateway === 'manual' ? 'approved' : payment.verificationStatus,
      receiptNumber,
      paidAt: new Date(),
      transactionId: options.transactionId || payment.transactionId,
      ...options.extra,
    },
    include: { student: { include: { user: true } }, fee: true, school: true },
  })

  if (payment.schoolId) {
    await recordLedgerEntry(prisma, {
      schoolId: payment.schoolId,
      entryType: 'income',
      category: updated.fee?.name || 'fee_payment',
      amount: paidAmount,
      paymentId: updated.id,
      description: `Payment ${updated.paymentReference || updated.receiptNumber}`,
      reference: updated.receiptNumber,
    })
  }

  return updated
}

module.exports = {
  generateReceiptNumber,
  applyAdjustments,
  getActiveAdjustments,
  computeStudentFeeSummary,
  computeStudentFeesOverview,
  recordLedgerEntry,
  completePayment,
}
