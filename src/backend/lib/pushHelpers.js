let webpush
try {
  webpush = require('web-push')
} catch {
  webpush = null
}

const prisma = require('../prismaClient')

function getGlobalVapid() {
  return {
    publicKey: process.env.VAPID_PUBLIC_KEY || null,
    privateKey: process.env.VAPID_PRIVATE_KEY || null,
    subject: process.env.VAPID_SUBJECT || process.env.APP_URL || 'mailto:admin@example.com',
  }
}

async function resolveVapidForSchool(schoolId) {
  if (schoolId) {
    const setting = await prisma.notificationSetting.findUnique({ where: { schoolId } })
    if (setting?.vapidPublicKey && setting?.vapidPrivateKey) {
      return {
        publicKey: setting.vapidPublicKey,
        privateKey: setting.vapidPrivateKey,
        subject: setting.vapidSubject || getGlobalVapid().subject,
        pushEnabled: setting.pushEnabled !== false,
      }
    }
  }
  const global = getGlobalVapid()
  return {
    ...global,
    pushEnabled: Boolean(global.publicKey && global.privateKey),
  }
}

function configureWebPush(vapid) {
  if (!webpush || !vapid?.publicKey || !vapid?.privateKey) return false
  webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey)
  return true
}

async function sendPushToUser(prismaClient, userId, { title, body, payload, schoolId }) {
  if (!webpush) return { sent: 0, failed: 0 }

  const vapid = await resolveVapidForSchool(schoolId)
  if (!vapid.pushEnabled || !configureWebPush(vapid)) {
    return { sent: 0, failed: 0, skipped: true }
  }

  const subs = await prismaClient.pushSubscription.findMany({ where: { userId } })
  if (!subs.length) return { sent: 0, failed: 0 }

  const notification = JSON.stringify({ title, body, payload: payload || {} })
  let sent = 0
  let failed = 0

  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        notification
      )
      sent++
    } catch (err) {
      failed++
      if (err.statusCode === 404 || err.statusCode === 410) {
        await prismaClient.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {})
      }
    }
  }

  return { sent, failed }
}

function generateVapidKeys() {
  if (!webpush) throw new Error('web-push package not installed')
  return webpush.generateVAPIDKeys()
}

module.exports = {
  getGlobalVapid,
  resolveVapidForSchool,
  configureWebPush,
  sendPushToUser,
  generateVapidKeys,
}
