const { dispatchNotification } = require('./notificationDispatcher')

const { parseDeviceLabel } = require('./authHelpers')



async function notifyLoginAlert({ prisma, user, req }) {

  await dispatchNotification(prisma, {

    userId: user.id,

    schoolId: user.schoolId,

    type: 'login',

    title: 'New login detected',

    body: `Sign-in from ${parseDeviceLabel(req?.headers?.['user-agent'])} at ${new Date().toLocaleString()}`,

    emailPayload: {

      firstName: user.firstName,

      device: parseDeviceLabel(req?.headers?.['user-agent']),

      time: new Date().toLocaleString(),

    },

    channels: ['email'],

  })

}



async function notifyResultsPublished(prisma, { resultIds }) {

  const results = await prisma.result.findMany({

    where: { id: { in: resultIds } },

    include: {

      subject: true,

      exam: true,

      student: { include: { user: true, parent: { include: { user: true } } } },

    },

  })



  const byStudent = new Map()

  for (const r of results) {

    if (!byStudent.has(r.studentId)) {

      byStudent.set(r.studentId, { student: r.student, examName: r.exam?.name, lines: [] })

    }

    const entry = byStudent.get(r.studentId)

    entry.lines.push(`${r.subject?.name || 'Subject'}: ${r.totalScore}% (${r.grade || '—'})`)

    if (r.exam?.name) entry.examName = r.exam.name

  }



  for (const { student, examName, lines } of byStudent.values()) {

    const summary = lines.join(' · ')

    const payload = {

      firstName: student.user.firstName,

      examName: examName || 'Term results',

      summary: summary || 'Log in to view your full report.',

    }



    await dispatchNotification(prisma, {

      userId: student.user.id,

      schoolId: student.schoolId,

      type: 'results',

      title: `${payload.examName} results published`,

      body: summary || 'Your results are now available.',

      payload,

      emailPayload: payload,

    })



    if (student.parent?.user) {

      await dispatchNotification(prisma, {

        userId: student.parent.user.id,

        schoolId: student.schoolId,

        type: 'results',

        title: `Results for ${student.user.firstName}`,

        body: summary || 'Results are now available.',

        payload: { ...payload, firstName: student.parent.user.firstName },

        emailPayload: { ...payload, firstName: student.parent.user.firstName },

      })

    }

  }

}



async function notifyBulkResultsPublished(prisma, { examId, classId }) {

  const where = { published: true }

  if (examId) where.examId = examId

  if (classId) where.student = { classId }



  const results = await prisma.result.findMany({

    where,

    select: { id: true },

    take: 500,

  })

  if (results.length) {

    await notifyResultsPublished(prisma, { resultIds: results.map((r) => r.id) })

  }

  return results.length

}



async function notifyAttendanceMarked(prisma, attendance) {

  if (!['Absent', 'Late'].includes(attendance.status)) return



  const record = await prisma.attendance.findUnique({

    where: { id: attendance.id },

    include: {

      student: {

        include: {

          user: true,

          parent: { include: { user: true } },

        },

      },

    },

  })

  if (!record?.student) return



  const { student } = record

  const payload = {

    studentName: `${student.user.firstName} ${student.user.lastName}`,

    status: record.status,

    date: new Date(record.date).toLocaleDateString(),

    remark: record.remark,

  }



  const recipients = []

  if (student.parent?.user) {

    recipients.push(student.parent.user)

  }

  if (student.user) {

    recipients.push(student.user)

  }



  for (const user of recipients) {

    await dispatchNotification(prisma, {

      userId: user.id,

      schoolId: student.schoolId,

      type: 'attendance',

      title: `Attendance: ${payload.status}`,

      body: `${payload.studentName} was ${payload.status} on ${payload.date}.`,

      payload: { ...payload, firstName: user.firstName },

      emailPayload: { ...payload, firstName: user.firstName },

    })

  }

}



async function notifyFeeReminder(prisma, { userId, schoolId, payload }) {

  await dispatchNotification(prisma, {

    userId,

    schoolId,

    type: 'fee',

    title: `Fee reminder: ${payload.feeName}`,

    body: `Outstanding ₦${payload.outstanding} due ${payload.dueDate}.`,

    payload,

    emailPayload: payload,

  })

}



async function notifyPaymentReceived(prisma, { userId, schoolId, payload }) {

  await dispatchNotification(prisma, {

    userId,

    schoolId,

    type: 'payment',

    title: 'Payment received',

    body: `₦${payload.amount} received for ${payload.feeName || 'school fees'}.`,

    payload,

    emailPayload: payload,

  })

}



async function notifyAdmissionUpdate(prisma, { userId, schoolId, payload }) {

  await dispatchNotification(prisma, {

    userId,

    schoolId,

    type: 'admission',

    title: `Admission: ${payload.status}`,

    body: payload.message || `Application status updated to ${payload.status}.`,

    payload,

    emailTemplate: payload.template,

    emailPayload: payload,

  })

}



module.exports = {

  notifyLoginAlert,

  notifyResultsPublished,

  notifyBulkResultsPublished,

  notifyAttendanceMarked,

  notifyFeeReminder,

  notifyPaymentReceived,

  notifyAdmissionUpdate,

}

