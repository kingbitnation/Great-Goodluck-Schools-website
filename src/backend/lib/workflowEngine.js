const { dispatchNotification } = require('./notificationDispatcher')
const { deliverWebhook } = require('./webhookDispatcher')

const TRIGGERS = {
  ATTENDANCE_ABSENT_STREAK: 'attendance.absent_streak',
  ATTENDANCE_MARKED: 'attendance.marked',
  FEE_OVERDUE: 'fee.overdue',
  PAYMENT_APPROVED: 'payment.approved',
}

function evaluateConditions(conditions, context) {
  if (!conditions || typeof conditions !== 'object') return true
  if (conditions.minAbsentDays != null) {
    return (context.absentStreak || 0) >= Number(conditions.minAbsentDays)
  }
  if (conditions.status != null) {
    return String(context.status).toLowerCase() === String(conditions.status).toLowerCase()
  }
  return true
}

async function runActions(prisma, actions, context) {
  const log = []
  const list = Array.isArray(actions) ? actions : []
  for (const action of list) {
    if (!action?.type) continue
    try {
      if (action.type === 'notify' && context.parentUserId) {
        await dispatchNotification(prisma, {
          userId: context.parentUserId,
          schoolId: context.schoolId,
          type: 'workflow',
          title: action.title || 'School update',
          body: action.body || context.message || 'An automated workflow ran for your child.',
          channels: action.channels || ['in_app', 'email'],
          email: context.parentEmail,
          payload: context,
        })
        log.push({ type: 'notify', ok: true })
      } else if (action.type === 'notify_teacher' && context.teacherUserId) {
        await dispatchNotification(prisma, {
          userId: context.teacherUserId,
          schoolId: context.schoolId,
          type: 'workflow',
          title: action.title || 'Attendance follow-up',
          body: action.body || context.message,
          channels: action.channels || ['in_app'],
          payload: context,
        })
        log.push({ type: 'notify_teacher', ok: true })
      } else if (action.type === 'webhook') {
        await deliverWebhook(prisma, {
          schoolId: context.schoolId,
          event: action.event || TRIGGERS.ATTENDANCE_MARKED,
          payload: context,
        })
        log.push({ type: 'webhook', ok: true })
      } else {
        log.push({ type: action.type, ok: false, note: 'skipped — missing context' })
      }
    } catch (err) {
      log.push({ type: action.type, ok: false, error: err.message })
    }
  }
  return log
}

async function executeWorkflowRules(prisma, { schoolId, trigger, context }) {
  const rules = await prisma.workflowRule.findMany({
    where: { schoolId, trigger, isActive: true },
    orderBy: { createdAt: 'asc' },
  })
  const runs = []
  for (const rule of rules) {
    if (!evaluateConditions(rule.conditions, context)) continue
    const log = await runActions(prisma, rule.actions, context)
    const run = await prisma.workflowRun.create({
      data: {
        ruleId: rule.id,
        status: log.every((l) => l.ok !== false) ? 'completed' : 'partial',
        trigger,
        context,
        log,
      },
    })
    await prisma.workflowRule.update({
      where: { id: rule.id },
      data: { runCount: { increment: 1 }, lastRunAt: new Date() },
    })
    runs.push(run)
  }
  return runs
}

async function countConsecutiveAbsentDays(prisma, studentId, beforeDate) {
  const records = await prisma.attendance.findMany({
    where: { studentId, date: { lte: beforeDate } },
    orderBy: { date: 'desc' },
    take: 30,
  })
  let streak = 0
  for (const row of records) {
    if (String(row.status).toLowerCase() === 'absent') streak += 1
    else break
  }
  return streak
}

async function onAttendanceMarked(prisma, attendance) {
  const student = await prisma.student.findUnique({
    where: { id: attendance.studentId },
    include: {
      user: { select: { firstName: true, lastName: true } },
      parent: { include: { user: { select: { id: true, email: true } } } },
      class: { select: { name: true } },
    },
  })
  if (!student?.schoolId) return

  const schoolId = student.schoolId
  const studentName = [student.user?.firstName, student.user?.lastName].filter(Boolean).join(' ')
  const baseContext = {
    schoolId,
    studentId: student.id,
    studentName,
    className: student.class?.name || '',
    status: attendance.status,
    date: attendance.date,
    parentUserId: student.parent?.user?.id,
    parentEmail: student.parent?.user?.email,
    message: `${studentName} was marked ${attendance.status} on ${new Date(attendance.date).toLocaleDateString()}.`,
  }

  await executeWorkflowRules(prisma, {
    schoolId,
    trigger: TRIGGERS.ATTENDANCE_MARKED,
    context: baseContext,
  })

  if (String(attendance.status).toLowerCase() !== 'absent') return

  const absentStreak = await countConsecutiveAbsentDays(prisma, student.id, new Date(attendance.date))
  await executeWorkflowRules(prisma, {
    schoolId,
    trigger: TRIGGERS.ATTENDANCE_ABSENT_STREAK,
    context: { ...baseContext, absentStreak },
  })
}

module.exports = {
  TRIGGERS,
  executeWorkflowRules,
  onAttendanceMarked,
}
