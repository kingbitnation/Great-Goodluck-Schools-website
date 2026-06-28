const crypto = require('crypto')
const { streamPaymentReceipt } = require('../lib/receiptPdf')
const {
  computeStudentFeeSummary,
  computeStudentFeesOverview,
  completePayment,
  generateReceiptNumber,
  recordLedgerEntry,
} = require('../lib/financeHelpers')
const { dispatchNotification } = require('../lib/notificationDispatcher')
const { schoolBankDetails } = require('../lib/manualPaymentHelpers')

function generatePaymentReference(schoolId) {
  const schoolPart = (schoolId || 'GGS').replace(/-/g, '').slice(0, 6).toUpperCase()
  const suffix = crypto.randomBytes(2).toString('hex').toUpperCase()
  return `GGS-${schoolPart}-${Date.now().toString(36).toUpperCase()}-${suffix}`
}

async function logVerification(prisma, { paymentId, action, note, performedById }) {
  return prisma.paymentVerificationLog.create({
    data: { paymentId, action, note: note || null, performedById },
  })
}

function schoolScopeWhere(req) {
  if (req.user.role === 'SuperAdmin') return {}
  if (req.user.schoolId) return { schoolId: req.user.schoolId }
  return {}
}

async function assertStudentAccess(prisma, req, studentId) {
  if (req.user.role === 'Student') {
    const me = await prisma.student.findUnique({ where: { userId: req.user.userId } })
    if (!me || me.id !== studentId) throw Object.assign(new Error('Forbidden'), { status: 403 })
  }
  if (req.user.role === 'Parent') {
    const parent = await prisma.parent.findUnique({ where: { userId: req.user.userId } })
    const student = await prisma.student.findUnique({ where: { id: studentId } })
    if (!parent || !student || student.parentId !== parent.id) {
      throw Object.assign(new Error('Forbidden'), { status: 403 })
    }
  }
}

function registerFinanceRoutes(app, { prisma, requireRole, requirePermission, enqueueEmail }) {
  const perm = requirePermission || (() => (_req, _res, next) => next())

  // ===== FEE SUMMARY =====
  app.get('/api/students/:studentId/fee-summary', requireRole('Student', 'Parent', 'SuperAdmin', 'SchoolAdmin', 'Accountant'), async (req, res) => {
    try {
      await assertStudentAccess(prisma, req, req.params.studentId)
      const overview = await computeStudentFeesOverview(prisma, req.params.studentId)
      if (!overview) return res.status(404).json({ error: 'Student not found' })
      res.json(overview)
    } catch (err) {
      if (err.status) return res.status(err.status).json({ error: err.message })
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  // ===== INSTALLMENTS =====
  app.get('/api/fees/:feeId/installments', requireRole('SuperAdmin', 'SchoolAdmin', 'Accountant', 'Student', 'Parent'), async (req, res) => {
    try {
      const installments = await prisma.feeInstallment.findMany({
        where: { feeId: req.params.feeId },
        orderBy: { sortOrder: 'asc' },
      })
      res.json(installments)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.post('/api/fees/:feeId/installments', requireRole('SuperAdmin', 'SchoolAdmin', 'Accountant'), perm('fees.manage'), async (req, res) => {
    try {
      const { label, amount, dueDate, sortOrder } = req.body
      if (!label || !amount || !dueDate) return res.status(400).json({ error: 'label, amount, dueDate required' })
      const fee = await prisma.fee.findUnique({ where: { id: req.params.feeId } })
      if (!fee) return res.status(404).json({ error: 'Fee not found' })
      const installment = await prisma.feeInstallment.create({
        data: {
          feeId: fee.id,
          label,
          amount: Number(amount),
          dueDate: new Date(dueDate),
          sortOrder: sortOrder ?? 0,
        },
      })
      res.status(201).json(installment)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  // ===== ADJUSTMENTS =====
  app.get('/api/fee-adjustments', requireRole('SuperAdmin', 'SchoolAdmin', 'Accountant'), perm('fees.manage'), async (req, res) => {
    try {
      const { studentId, schoolId } = req.query
      const where = schoolScopeWhere(req)
      if (studentId) where.studentId = String(studentId)
      if (schoolId && req.user.role === 'SuperAdmin') where.schoolId = String(schoolId)
      const items = await prisma.feeAdjustment.findMany({
        where,
        include: { student: { include: { user: true } }, fee: true },
        orderBy: { createdAt: 'desc' },
      })
      res.json(items)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.post('/api/fee-adjustments', requireRole('SuperAdmin', 'SchoolAdmin', 'Accountant'), perm('fees.manage'), async (req, res) => {
    try {
      const { studentId, feeId, type, value, isPercent, reason } = req.body
      const validTypes = ['scholarship', 'waiver', 'sibling_discount', 'penalty']
      if (!studentId || !type || value == null || !validTypes.includes(type)) {
        return res.status(400).json({ error: 'Invalid adjustment data' })
      }
      const student = await prisma.student.findUnique({ where: { id: studentId } })
      if (!student) return res.status(404).json({ error: 'Student not found' })
      const adj = await prisma.feeAdjustment.create({
        data: {
          schoolId: student.schoolId,
          studentId,
          feeId: feeId || null,
          type,
          value: Number(value),
          isPercent: Boolean(isPercent),
          reason: reason || null,
        },
      })
      res.status(201).json(adj)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.delete('/api/fee-adjustments/:id', requireRole('SuperAdmin', 'SchoolAdmin', 'Accountant'), perm('fees.manage'), async (req, res) => {
    try {
      await prisma.feeAdjustment.update({ where: { id: req.params.id }, data: { isActive: false } })
      res.json({ message: 'Adjustment deactivated' })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  // ===== MANUAL PAYMENT =====
  app.post('/api/payments/manual', requireRole('Student', 'Parent', 'SuperAdmin', 'SchoolAdmin'), async (req, res) => {
    try {
      const { feeId, studentId, amount, installmentId } = req.body
      if (!studentId) return res.status(400).json({ error: 'studentId required' })

      await assertStudentAccess(prisma, req, studentId)

      const student = await prisma.student.findUnique({
        where: { id: studentId },
        include: { user: true, school: true },
      })
      if (!student) return res.status(404).json({ error: 'Student not found' })

      let payAmount = Number(amount)
      let discountApplied = 0
      let penaltyApplied = 0

      if (feeId) {
        const summary = await computeStudentFeeSummary(prisma, studentId, feeId)
        if (!summary) return res.status(404).json({ error: 'Fee not found' })
        discountApplied = summary.discountApplied
        penaltyApplied = summary.penaltyApplied
        if (!payAmount || payAmount <= 0) {
          payAmount = installmentId
            ? summary.installments.find((i) => i.id === installmentId)?.outstanding || summary.outstanding
            : summary.outstanding
        }
        if (payAmount > summary.outstanding) {
          return res.status(400).json({ error: `Amount exceeds outstanding balance of ₦${summary.outstanding}` })
        }
      }

      if (!payAmount || payAmount <= 0) return res.status(400).json({ error: 'Enter a valid amount' })

      const school = student.school
      if (!school?.bankAccountNumber?.trim()) {
        return res.status(400).json({
          error: 'This school has not set up bank account details yet. Ask your school admin to add them under School branding.',
        })
      }

      const reference = generatePaymentReference(student.schoolId)
      const payment = await prisma.payment.create({
        data: {
          schoolId: student.schoolId,
          feeId: feeId || null,
          installmentId: installmentId || null,
          studentId,
          amount: payAmount,
          paidAmount: 0,
          discountApplied,
          penaltyApplied,
          gateway: 'manual',
          status: 'pending',
          verificationStatus: 'pending_verification',
          paymentReference: reference,
        },
        include: { fee: true, student: { include: { user: true } } },
      })

      res.status(201).json({
        payment,
        bankDetails: {
          ...schoolBankDetails(school, { amount: payAmount, reference }),
          paymentReference: reference,
          discountApplied,
          penaltyApplied,
        },
      })
    } catch (err) {
      if (err.status) return res.status(err.status).json({ error: err.message })
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  // Upload receipt (existing logic with parent access)
  app.post('/api/payments/:id/upload-receipt', requireRole('Student', 'Parent', 'SuperAdmin', 'SchoolAdmin'), async (req, res) => {
    try {
      const { fileBase64, mimeType } = req.body
      if (!fileBase64) return res.status(400).json({ error: 'fileBase64 is required' })

      const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf']
      const type = mimeType || 'image/jpeg'
      if (!allowed.includes(type)) return res.status(400).json({ error: 'Only PDF, JPG, JPEG, PNG allowed' })

      const payment = await prisma.payment.findUnique({
        where: { id: req.params.id },
        include: { student: { include: { user: true } } },
      })
      if (!payment) return res.status(404).json({ error: 'Payment not found' })
      if (payment.gateway !== 'manual') return res.status(400).json({ error: 'Receipt upload only for manual payments' })

      await assertStudentAccess(prisma, req, payment.studentId)

      let receiptUrl = fileBase64
      if (process.env.CLOUDINARY_CLOUD_NAME && fileBase64.startsWith('data:')) {
        try {
          const cloudinary = require('cloudinary').v2
          cloudinary.config({
            cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
            api_key: process.env.CLOUDINARY_API_KEY,
            api_secret: process.env.CLOUDINARY_API_SECRET,
          })
          const result = await cloudinary.uploader.upload(fileBase64, {
            folder: 'payment-receipts',
            resource_type: type === 'application/pdf' ? 'raw' : 'image',
          })
          receiptUrl = result.secure_url
        } catch (e) {
          console.warn('Cloudinary upload failed', e.message)
        }
      }

      const updated = await prisma.payment.update({
        where: { id: payment.id },
        data: { receiptUrl, receiptMimeType: type, verificationStatus: 'under_review' },
        include: { fee: true, student: { include: { user: true } } },
      })

      await logVerification(prisma, { paymentId: payment.id, action: 'submitted', note: 'Receipt uploaded', performedById: req.user.userId })

      if (enqueueEmail) {
        const accountants = await prisma.user.findMany({
          where: { role: { name: { in: ['Accountant', 'SchoolAdmin'] } }, schoolId: payment.schoolId },
          select: { email: true },
        })
        for (const acc of accountants) {
          await enqueueEmail({
            to: acc.email,
            template: 'payment_pending',
            payload: {
              amount: payment.amount,
              reference: payment.paymentReference,
              studentName: `${payment.student?.user?.firstName || ''} ${payment.student?.user?.lastName || ''}`.trim(),
            },
            schoolId: payment.schoolId,
          })
        }
      }

      res.json(updated)
    } catch (err) {
      if (err.status) return res.status(err.status).json({ error: err.message })
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.get('/api/payments/pending-verification', requireRole('SuperAdmin', 'SchoolAdmin', 'Accountant'), perm('fees.manage'), async (req, res) => {
    try {
      const scope = schoolScopeWhere(req)
      const payments = await prisma.payment.findMany({
        where: { ...scope, gateway: 'manual', verificationStatus: { in: ['pending_verification', 'under_review'] } },
        include: {
          fee: true,
          student: { include: { user: true, class: true } },
          verificationLogs: {
            include: { performedBy: { select: { firstName: true, lastName: true, email: true } } },
            orderBy: { createdAt: 'desc' },
            take: 5,
          },
        },
        orderBy: { createdAt: 'desc' },
      })
      res.json(payments)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.post('/api/payments/:id/verify', requireRole('SuperAdmin', 'SchoolAdmin', 'Accountant'), perm('fees.manage'), async (req, res) => {
    try {
      const { action, note, paidAmount } = req.body
      const valid = ['approve', 'reject', 'under_review', 'info_requested']
      if (!valid.includes(action)) return res.status(400).json({ error: 'Invalid action' })

      const payment = await prisma.payment.findUnique({
        where: { id: req.params.id },
        include: { student: { include: { user: true } }, fee: true },
      })
      if (!payment) return res.status(404).json({ error: 'Payment not found' })

      if (req.user.role !== 'SuperAdmin' && req.user.schoolId && payment.schoolId !== req.user.schoolId) {
        return res.status(403).json({ error: 'Forbidden' })
      }

      if (action === 'approve') {
        const approvedAmount = paidAmount != null ? Number(paidAmount) : payment.amount
        const updated = await completePayment(prisma, payment, approvedAmount)
        await logVerification(prisma, { paymentId: payment.id, action: 'approved', note, performedById: req.user.userId })
        if (enqueueEmail) {
          await dispatchNotification(prisma, {
            userId: payment.student.user.id,
            schoolId: payment.schoolId,
            type: 'payment',
            title: 'Payment approved',
            body: `Your payment of ₦${approvedAmount} has been approved.`,
            emailTemplate: 'payment_approved',
            emailPayload: {
              firstName: payment.student.user.firstName,
              amount: approvedAmount,
              reference: payment.paymentReference,
              feeName: payment.fee?.name,
            },
            payload: {
              amount: approvedAmount,
              reference: payment.paymentReference,
              feeName: payment.fee?.name,
            },
          })
        }
        return res.json(updated)
      }

      const actionMap = {
        reject: { verificationStatus: 'rejected', status: 'failed', reviewNote: note || 'Rejected' },
        under_review: { verificationStatus: 'under_review' },
        info_requested: { verificationStatus: 'pending_verification', reviewNote: note || 'More information required' },
      }

      const updated = await prisma.payment.update({
        where: { id: payment.id },
        data: { ...actionMap[action], reviewedById: req.user.userId, reviewedAt: new Date() },
        include: { fee: true, student: { include: { user: true } }, reviewedBy: true },
      })

      await logVerification(prisma, {
        paymentId: payment.id,
        action: action === 'reject' ? 'rejected' : action,
        note,
        performedById: req.user.userId,
      })

      if (enqueueEmail && action === 'reject') {
        await dispatchNotification(prisma, {
          userId: payment.student.user.id,
          schoolId: payment.schoolId,
          type: 'payment',
          title: 'Payment rejected',
          body: note || 'Your payment could not be verified.',
          emailTemplate: 'payment_rejected',
          emailPayload: {
            firstName: payment.student.user.firstName,
            reference: payment.paymentReference,
            note: note || '',
          },
        })
      }

      res.json(updated)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.get('/api/payments/:id/verification-logs', requireRole('SuperAdmin', 'SchoolAdmin', 'Accountant', 'Student', 'Parent'), async (req, res) => {
    try {
      const payment = await prisma.payment.findUnique({ where: { id: req.params.id } })
      if (!payment) return res.status(404).json({ error: 'Payment not found' })
      await assertStudentAccess(prisma, req, payment.studentId)
      const logs = await prisma.paymentVerificationLog.findMany({
        where: { paymentId: payment.id },
        include: { performedBy: { select: { firstName: true, lastName: true, email: true } } },
        orderBy: { createdAt: 'asc' },
      })
      res.json(logs)
    } catch (err) {
      if (err.status) return res.status(err.status).json({ error: err.message })
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })


  // ===== PDF RECEIPT =====
  app.get('/api/payments/:id/receipt/pdf', requireRole('SuperAdmin', 'SchoolAdmin', 'Accountant', 'Student', 'Parent'), async (req, res) => {
    try {
      const payment = await prisma.payment.findUnique({
        where: { id: req.params.id },
        include: { student: { include: { user: true, class: true } }, fee: true, school: true },
      })
      if (!payment) return res.status(404).json({ error: 'Payment not found' })
      if (!['completed', 'partial'].includes(payment.status)) {
        return res.status(400).json({ error: 'Receipt available only for completed payments' })
      }
      await assertStudentAccess(prisma, req, payment.studentId)
      streamPaymentReceipt(res, payment, payment.school)
    } catch (err) {
      if (err.status) return res.status(err.status).json({ error: err.message })
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  // ===== LEDGER & REPORTS =====
  app.get('/api/finance/ledger', requireRole('SuperAdmin', 'SchoolAdmin', 'Accountant'), perm('fees.manage'), async (req, res) => {
    try {
      const scope = schoolScopeWhere(req)
      const entries = await prisma.financeLedger.findMany({
        where: scope,
        include: { payment: { select: { paymentReference: true, receiptNumber: true } } },
        orderBy: { entryDate: 'desc' },
        take: 200,
      })
      res.json(entries)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.get('/api/finance/income-statement', requireRole('SuperAdmin', 'SchoolAdmin', 'Accountant'), perm('fees.manage'), async (req, res) => {
    try {
      const { month, year } = req.query
      const scope = schoolScopeWhere(req)
      const start = month && year ? new Date(Number(year), Number(month) - 1, 1) : new Date(new Date().getFullYear(), 0, 1)
      const end = month && year ? new Date(Number(year), Number(month), 0, 23, 59, 59) : new Date()

      const [income, expenses, payments] = await Promise.all([
        prisma.financeLedger.aggregate({
          where: { ...scope, entryType: 'income', entryDate: { gte: start, lte: end } },
          _sum: { amount: true },
        }),
        prisma.financeLedger.aggregate({
          where: { ...scope, entryType: 'expense', entryDate: { gte: start, lte: end } },
          _sum: { amount: true },
        }),
        prisma.payment.groupBy({
          by: ['gateway'],
          where: { ...scope, status: { in: ['completed', 'partial'] }, paidAt: { gte: start, lte: end } },
          _sum: { paidAmount: true },
        }),
      ])

      res.json({
        period: { start, end },
        totalIncome: income._sum.amount || 0,
        totalExpenses: expenses._sum.amount || 0,
        netIncome: (income._sum.amount || 0) - (expenses._sum.amount || 0),
        byGateway: payments.reduce((acc, p) => ({ ...acc, [p.gateway]: p._sum.paidAmount || 0 }), {}),
      })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  // Subscription plans listing only — school subscription detail in saasRoutes
  app.get('/api/subscription-plans', requireRole('SuperAdmin', 'SchoolAdmin'), async (_req, res) => {
    try {
      const plans = await prisma.subscriptionPlan.findMany({ where: { isActive: true }, orderBy: { price: 'asc' } })
      res.json(plans)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })
}

module.exports = { registerFinanceRoutes, generatePaymentReference }
