const { enqueueEmail } = require('./emailQueue')
const { enqueueSms } = require('./smsQueue')
const { sendPushToUser } = require('./pushHelpers')

const DEFAULT_CHANNELS = {
  login: ['email'],
  results: ['email', 'in_app', 'sms', 'push'],
  attendance: ['email', 'in_app', 'sms', 'push'],
  fee: ['email', 'in_app', 'sms'],
  payment: ['email', 'in_app', 'sms'],
  admission: ['email', 'in_app', 'push'],
  announcement: ['in_app', 'push'],
  contact: ['email', 'in_app'],
  library: ['email', 'in_app'],
  leave: ['email', 'in_app'],
  payroll: ['email', 'in_app'],
  marketplace: ['email', 'in_app', 'push'],
  general: ['in_app', 'email'],
}

const EMAIL_TEMPLATE_BY_TYPE = {
  results: 'results_released',
  attendance: 'attendance_alert',
  fee: 'fee_reminder',
  payment: 'payment_received',
  admission: 'admission_update',
  login: 'login_alert',
  library: 'library_fine',
  leave: 'leave_update',
}

function resolveChannels(type, channels, schoolDefaults, typeOverrides) {
  if (channels?.length) return channels
  if (typeOverrides?.[type]?.length) return typeOverrides[type]
  if (schoolDefaults?.[type]?.length) return schoolDefaults[type]
  return DEFAULT_CHANNELS[type] || DEFAULT_CHANNELS.general
}

function channelEnabled(channelList, channel, prefs) {
  if (!channelList.includes(channel)) return false
  if (channel === 'email') return prefs.email !== false
  if (channel === 'sms') return prefs.sms === true
  if (channel === 'push') return prefs.push !== false
  if (channel === 'in_app') return prefs.inApp !== false
  return true
}

async function getUserContext(prisma, userId) {
  if (!userId) return null
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { notificationPreference: true },
  })
  if (!user) return null
  return {
    userId: user.id,
    email: user.email,
    phone: user.phone,
    schoolId: user.schoolId,
    prefs: user.notificationPreference || {
      email: true,
      sms: false,
      push: true,
      inApp: true,
      typeOverrides: null,
    },
  }
}

async function dispatchNotification(prisma, options) {
  const {
    userId,
    schoolId,
    type = 'general',
    title,
    body,
    payload,
    channels,
    email,
    phone,
    emailTemplate,
    emailPayload,
    smsTemplate,
    smsPayload,
    skipInApp,
  } = options

  const ctx = userId ? await getUserContext(prisma, userId) : null
  const resolvedSchoolId = schoolId || ctx?.schoolId || null

  let schoolDefaults = null
  if (resolvedSchoolId) {
    const setting = await prisma.notificationSetting.findUnique({
      where: { schoolId: resolvedSchoolId },
    })
    schoolDefaults = setting?.channelDefaults || null
  }

  const prefs = ctx?.prefs || { email: true, sms: false, push: true, inApp: true }
  const typeOverrides = prefs.typeOverrides || null
  const channelList = resolveChannels(type, channels, schoolDefaults, typeOverrides)

  const results = { inApp: null, email: null, sms: null, push: null }

  if (!skipInApp && channelEnabled(channelList, 'in_app', prefs) && userId && title && body) {
    results.inApp = await prisma.notification.create({
      data: {
        userId,
        type,
        title,
        body,
        payload: payload || null,
        read: false,
        sentAt: new Date(),
      },
    })
  }

  const targetEmail = email || ctx?.email
  const template = emailTemplate || EMAIL_TEMPLATE_BY_TYPE[type] || null
  if (channelEnabled(channelList, 'email', prefs) && targetEmail && template) {
    results.email = await enqueueEmail({
      to: targetEmail,
      template,
      payload: emailPayload || payload || { firstName: 'User', body },
      schoolId: resolvedSchoolId,
    })
  }

  const targetPhone = phone || ctx?.phone
  const smsTpl = smsTemplate || template || type
  if (channelEnabled(channelList, 'sms', prefs) && targetPhone) {
    results.sms = await enqueueSms({
      to: targetPhone,
      template: smsTpl,
      payload: smsPayload || emailPayload || payload || { body, message: body },
      schoolId: resolvedSchoolId,
    })
  }

  if (channelEnabled(channelList, 'push', prefs) && userId && title) {
    results.push = await sendPushToUser(prisma, userId, {
      title,
      body: body || '',
      payload,
      schoolId: resolvedSchoolId,
    })
  }

  return results
}

async function dispatchToUsers(prisma, userIds, options) {
  const outcomes = []
  for (const userId of userIds) {
    outcomes.push(await dispatchNotification(prisma, { ...options, userId }))
  }
  return outcomes
}

module.exports = {
  DEFAULT_CHANNELS,
  dispatchNotification,
  dispatchToUsers,
}
