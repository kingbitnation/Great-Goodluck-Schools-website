const { dispatchNotification, DEFAULT_CHANNELS } = require('../lib/notificationDispatcher')
const { resolveSmsConfig, renderSmsBody, processSmsQueue } = require('../lib/smsQueue')
const { sendSms } = require('../lib/smsProviders')
const { resolveVapidForSchool, generateVapidKeys } = require('../lib/pushHelpers')

function getUserId(req) {
  return req.user?.userId || req.user?.id
}

function maskSecret(value) {
  if (!value) return ''
  if (value.length <= 4) return '****'
  return `${'*'.repeat(Math.min(value.length - 4, 8))}${value.slice(-4)}`
}

function serializeNotificationSettings(setting) {
  if (!setting) {
    return {
      smsEnabled: false,
      smsProvider: 'termii',
      termiiSenderId: '',
      hasTermiiApiKey: false,
      hasTwilioAuthToken: false,
      twilioAccountSid: '',
      twilioFromNumber: '',
      pushEnabled: true,
      vapidPublicKey: '',
      hasVapidPrivateKey: false,
      vapidSubject: '',
      channelDefaults: DEFAULT_CHANNELS,
    }
  }
  return {
    smsEnabled: setting.smsEnabled,
    smsProvider: setting.smsProvider || 'termii',
    termiiSenderId: setting.termiiSenderId || '',
    hasTermiiApiKey: Boolean(setting.termiiApiKey),
    hasTwilioAuthToken: Boolean(setting.twilioAuthToken),
    twilioAccountSid: setting.twilioAccountSid || '',
    twilioFromNumber: setting.twilioFromNumber || '',
    pushEnabled: setting.pushEnabled !== false,
    vapidPublicKey: setting.vapidPublicKey || '',
    hasVapidPrivateKey: Boolean(setting.vapidPrivateKey),
    vapidSubject: setting.vapidSubject || '',
    channelDefaults: setting.channelDefaults || DEFAULT_CHANNELS,
  }
}

function registerNotificationRoutes(app, { prisma, requireRole, requirePermission }) {
  app.get('/api/notifications/preferences', requireRole('SuperAdmin', 'SchoolAdmin', 'Teacher', 'Student', 'Parent', 'Accountant', 'Alumni'), async (req, res) => {
    try {
      const userId = getUserId(req)
      let pref = await prisma.userNotificationPreference.findUnique({ where: { userId } })
      if (!pref) {
        pref = await prisma.userNotificationPreference.create({
          data: { userId },
        })
      }
      const pushCount = await prisma.pushSubscription.count({ where: { userId } })
      res.json({ ...pref, pushSubscribed: pushCount > 0 })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.put('/api/notifications/preferences', requireRole('SuperAdmin', 'SchoolAdmin', 'Teacher', 'Student', 'Parent', 'Accountant', 'Alumni'), async (req, res) => {
    try {
      const userId = getUserId(req)
      const { email, sms, push, inApp, typeOverrides } = req.body
      const pref = await prisma.userNotificationPreference.upsert({
        where: { userId },
        create: {
          userId,
          email: email !== false,
          sms: Boolean(sms),
          push: push !== false,
          inApp: inApp !== false,
          typeOverrides: typeOverrides || null,
        },
        update: {
          ...(email !== undefined ? { email: Boolean(email) } : {}),
          ...(sms !== undefined ? { sms: Boolean(sms) } : {}),
          ...(push !== undefined ? { push: Boolean(push) } : {}),
          ...(inApp !== undefined ? { inApp: Boolean(inApp) } : {}),
          ...(typeOverrides !== undefined ? { typeOverrides } : {}),
        },
      })
      res.json(pref)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.get('/api/notifications/vapid-public-key', requireRole('SuperAdmin', 'SchoolAdmin', 'Teacher', 'Student', 'Parent', 'Accountant', 'Alumni'), async (req, res) => {
    try {
      const vapid = await resolveVapidForSchool(req.user.schoolId)
      res.json({ publicKey: vapid.publicKey || null, pushEnabled: vapid.pushEnabled })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.post('/api/notifications/push/subscribe', requireRole('SuperAdmin', 'SchoolAdmin', 'Teacher', 'Student', 'Parent', 'Accountant', 'Alumni'), async (req, res) => {
    try {
      const userId = getUserId(req)
      const { endpoint, keys } = req.body
      if (!endpoint || !keys?.p256dh || !keys?.auth) {
        return res.status(400).json({ error: 'Invalid push subscription' })
      }
      const sub = await prisma.pushSubscription.upsert({
        where: { endpoint },
        create: {
          userId,
          endpoint,
          p256dh: keys.p256dh,
          auth: keys.auth,
          userAgent: req.headers['user-agent'] || null,
        },
        update: {
          userId,
          p256dh: keys.p256dh,
          auth: keys.auth,
          userAgent: req.headers['user-agent'] || null,
        },
      })
      res.status(201).json(sub)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.delete('/api/notifications/push/subscribe', requireRole('SuperAdmin', 'SchoolAdmin', 'Teacher', 'Student', 'Parent', 'Accountant', 'Alumni'), async (req, res) => {
    try {
      const userId = getUserId(req)
      const { endpoint } = req.body
      if (endpoint) {
        await prisma.pushSubscription.deleteMany({ where: { userId, endpoint } })
      } else {
        await prisma.pushSubscription.deleteMany({ where: { userId } })
      }
      res.json({ message: 'Unsubscribed' })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.put('/api/notifications/read-all', requireRole('SuperAdmin', 'SchoolAdmin', 'Teacher', 'Student', 'Parent', 'Accountant', 'Alumni'), async (req, res) => {
    try {
      const userId = getUserId(req)
      const result = await prisma.notification.updateMany({
        where: { userId, read: false },
        data: { read: true, readAt: new Date() },
      })
      res.json({ updated: result.count })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.get('/api/schools/:id/notification-settings', requireRole('SuperAdmin', 'SchoolAdmin'), async (req, res) => {
    try {
      if (req.user.role === 'SchoolAdmin' && req.user.schoolId !== req.params.id) {
        return res.status(403).json({ error: 'Forbidden' })
      }
      const school = await prisma.school.findUnique({ where: { id: req.params.id } })
      if (!school) return res.status(404).json({ error: 'School not found' })

      let setting = await prisma.notificationSetting.findUnique({ where: { schoolId: school.id } })
      if (!setting) {
        setting = await prisma.notificationSetting.create({
          data: { schoolId: school.id, channelDefaults: DEFAULT_CHANNELS },
        })
      }

      res.json({
        schoolId: school.id,
        schoolName: school.name,
        settings: serializeNotificationSettings(setting),
      })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.put('/api/schools/:id/notification-settings', requireRole('SuperAdmin', 'SchoolAdmin'), async (req, res) => {
    try {
      if (req.user.role === 'SchoolAdmin' && req.user.schoolId !== req.params.id) {
        return res.status(403).json({ error: 'Forbidden' })
      }
      const school = await prisma.school.findUnique({ where: { id: req.params.id } })
      if (!school) return res.status(404).json({ error: 'School not found' })

      const existing = await prisma.notificationSetting.findUnique({ where: { schoolId: school.id } })
      const {
        smsEnabled,
        smsProvider,
        termiiApiKey,
        termiiSenderId,
        twilioAccountSid,
        twilioAuthToken,
        twilioFromNumber,
        pushEnabled,
        vapidPublicKey,
        vapidPrivateKey,
        vapidSubject,
        channelDefaults,
        generateVapid,
      } = req.body

      const data = {
        smsEnabled: Boolean(smsEnabled),
        smsProvider: smsProvider || 'termii',
        termiiSenderId: termiiSenderId || '',
        twilioAccountSid: twilioAccountSid || '',
        twilioFromNumber: twilioFromNumber || '',
        pushEnabled: pushEnabled !== false,
        vapidSubject: vapidSubject || process.env.VAPID_SUBJECT || process.env.APP_URL || 'mailto:admin@example.com',
        channelDefaults: channelDefaults || DEFAULT_CHANNELS,
      }

      if (termiiApiKey) data.termiiApiKey = termiiApiKey
      else if (existing?.termiiApiKey) data.termiiApiKey = existing.termiiApiKey

      if (twilioAuthToken) data.twilioAuthToken = twilioAuthToken
      else if (existing?.twilioAuthToken) data.twilioAuthToken = existing.twilioAuthToken

      if (vapidPublicKey) data.vapidPublicKey = vapidPublicKey
      else if (existing?.vapidPublicKey) data.vapidPublicKey = existing.vapidPublicKey

      if (vapidPrivateKey) data.vapidPrivateKey = vapidPrivateKey
      else if (existing?.vapidPrivateKey) data.vapidPrivateKey = existing.vapidPrivateKey

      if (generateVapid) {
        const keys = generateVapidKeys()
        data.vapidPublicKey = keys.publicKey
        data.vapidPrivateKey = keys.privateKey
      }

      const setting = await prisma.notificationSetting.upsert({
        where: { schoolId: school.id },
        create: { schoolId: school.id, ...data },
        update: data,
      })

      res.json({ settings: serializeNotificationSettings(setting) })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.post('/api/schools/:id/notification-settings/test-sms', requireRole('SuperAdmin', 'SchoolAdmin'), async (req, res) => {
    try {
      if (req.user.role === 'SchoolAdmin' && req.user.schoolId !== req.params.id) {
        return res.status(403).json({ error: 'Forbidden' })
      }
      const { to } = req.body
      const user = await prisma.user.findUnique({ where: { id: getUserId(req) } })
      const phone = to || user?.phone
      if (!phone) return res.status(400).json({ error: 'Phone number required' })

      const config = await resolveSmsConfig(req.params.id)
      if (!config.smsEnabled && !process.env.TERMII_API_KEY && !process.env.TWILIO_ACCOUNT_SID) {
        return res.status(400).json({ error: 'SMS is not enabled or configured' })
      }

      const message = renderSmsBody('general', {
        message: 'Test SMS from SchoolPilot notification system.',
      })

      await sendSms({
        provider: config.smsProvider,
        config,
        to: phone,
        message,
      })

      res.json({ message: 'Test SMS sent' })
    } catch (err) {
      console.error(err)
      res.status(400).json({ error: err.message || 'Failed to send test SMS' })
    }
  })

  app.get('/api/notifications/sms-queue', requireRole('SuperAdmin', 'SchoolAdmin'), requirePermission('reports.view'), async (req, res) => {
    try {
      const { status, limit = '50' } = req.query
      const where = {}
      if (status) where.status = String(status)
      if (req.user.role === 'SchoolAdmin' && req.user.schoolId) {
        where.schoolId = req.user.schoolId
      }

      const [items, stats] = await Promise.all([
        prisma.smsQueue.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take: Math.min(Number(limit) || 50, 200),
        }),
        prisma.smsQueue.groupBy({
          by: ['status'],
          where: req.user.role === 'SchoolAdmin' && req.user.schoolId ? { schoolId: req.user.schoolId } : {},
          _count: { status: true },
        }),
      ])

      const statsMap = stats.reduce((acc, row) => {
        acc[row.status] = row._count.status
        return acc
      }, {})

      res.json({
        items: items.map((item) => ({
          ...item,
          to: maskSecret(item.to),
        })),
        stats: statsMap,
      })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.post('/api/notifications/sms-queue/process', requireRole('SuperAdmin', 'SchoolAdmin'), async (req, res) => {
    try {
      const result = await processSmsQueue(25)
      res.json(result)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })
}

module.exports = { registerNotificationRoutes }
