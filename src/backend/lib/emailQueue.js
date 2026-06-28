const prisma = require('../prismaClient')
const { sendMail } = require('./email')
const { renderEmailTemplate, schoolBrandFromRecord } = require('./emailTemplates')

const MAX_ATTEMPTS = 5
const BACKOFF_MINUTES = [0, 5, 15, 60, 240]

function nextRetryAt(attempts) {
  const mins = BACKOFF_MINUTES[Math.min(attempts, BACKOFF_MINUTES.length - 1)]
  return new Date(Date.now() + mins * 60 * 1000)
}

async function resolveJobContent(job) {
  if (!job.template) {
    return { subject: job.subject, text: job.body, html: job.body }
  }

  let brand = {}
  if (job.schoolId) {
    const school = await prisma.school.findUnique({ where: { id: job.schoolId } })
    brand = schoolBrandFromRecord(school)
  }

  const rendered = renderEmailTemplate(job.template, job.payload || {}, brand)
  return {
    subject: job.subject || rendered.subject,
    text: rendered.text,
    html: rendered.html,
  }
}

async function enqueueEmail({ to, subject, body, template, payload, schoolId, scheduledAt }) {
  let finalSubject = subject
  let finalBody = body || ''

  if (template && !finalSubject) {
    let brand = {}
    if (schoolId) {
      const school = await prisma.school.findUnique({ where: { id: schoolId } })
      brand = schoolBrandFromRecord(school)
    }
    const rendered = renderEmailTemplate(template, payload || {}, brand)
    finalSubject = rendered.subject
    finalBody = rendered.text
  }

  return prisma.emailQueue.create({
    data: {
      to,
      subject: finalSubject || 'Notification',
      body: finalBody,
      template: template || null,
      payload: payload || null,
      schoolId: schoolId || null,
      scheduledAt: scheduledAt || new Date(),
    },
  })
}

async function processEmailQueue(limit = 25) {
  const pending = await prisma.emailQueue.findMany({
    where: {
      status: 'pending',
      scheduledAt: { lte: new Date() },
      attempts: { lt: MAX_ATTEMPTS },
    },
    take: limit,
    orderBy: { scheduledAt: 'asc' },
  })

  let sent = 0
  let failed = 0

  for (const job of pending) {
    try {
      const content = await resolveJobContent(job)
      await sendMail({
        to: job.to,
        subject: content.subject,
        text: content.text,
        html: content.html,
        schoolId: job.schoolId,
      })
      await prisma.emailQueue.update({
        where: { id: job.id },
        data: { status: 'sent', sentAt: new Date(), lastError: null },
      })
      sent++
    } catch (err) {
      const nextAttempts = job.attempts + 1
      const isFinal = nextAttempts >= MAX_ATTEMPTS
      await prisma.emailQueue.update({
        where: { id: job.id },
        data: {
          attempts: nextAttempts,
          lastError: err.message || 'Send failed',
          status: isFinal ? 'failed' : 'pending',
          scheduledAt: isFinal ? job.scheduledAt : nextRetryAt(nextAttempts),
        },
      })
      failed++
    }
  }

  return { processed: pending.length, sent, failed }
}

async function queueFeeReminders(prismaClient, schoolId) {
  const { dispatchNotification } = require('./notificationDispatcher')
  const now = new Date()
  const fees = await prismaClient.fee.findMany({
    where: {
      schoolId,
      isActive: true,
      dueDate: { lte: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) },
    },
  })

  let queued = 0
  for (const fee of fees) {
    const students = await prismaClient.student.findMany({
      where: {
        schoolId,
        ...(fee.classId ? { classId: fee.classId } : {}),
      },
      include: {
        user: true,
        parent: { include: { user: true } },
        feePayments: {
          where: {
            feeId: fee.id,
            status: 'completed',
            verificationStatus: { in: ['approved', 'none'] },
          },
        },
      },
    })

    for (const student of students) {
      const paid = student.feePayments.reduce((sum, p) => sum + (p.paidAmount || p.amount || 0), 0)
      const outstanding = Math.max(0, fee.amount - paid)
      if (outstanding <= 0) continue

      const overdue = fee.dueDate < now
      const payload = {
        firstName: student.user.firstName,
        feeName: fee.name,
        amount: fee.amount,
        dueDate: fee.dueDate.toLocaleDateString(),
        outstanding,
        overdue,
      }

      await dispatchNotification(prismaClient, {
        userId: student.user.id,
        schoolId,
        type: 'fee',
        title: `Fee reminder: ${fee.name}`,
        body: `Outstanding ₦${outstanding} due ${fee.dueDate.toLocaleDateString()}.`,
        payload,
        emailPayload: payload,
      })
      queued++

      if (student.parent?.user) {
        await dispatchNotification(prismaClient, {
          userId: student.parent.user.id,
          schoolId,
          type: 'fee',
          title: `Fee reminder: ${fee.name}`,
          body: `Outstanding ₦${outstanding} for ${student.user.firstName}.`,
          payload: { ...payload, firstName: student.parent.user.firstName },
          emailPayload: { ...payload, firstName: student.parent.user.firstName },
        })
        queued++
      }
    }
  }

  return { queued, feesChecked: fees.length }
}

module.exports = {
  enqueueEmail,
  processEmailQueue,
  queueFeeReminders,
  MAX_ATTEMPTS,
}
