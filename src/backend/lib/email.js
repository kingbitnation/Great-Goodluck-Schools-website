const prisma = require('../prismaClient')

function envSmtpConfig() {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER) return null
  return {
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
  }
}

function smtpFromSchoolSettings(school) {
  const smtp = school?.settings?.smtp
  if (!smtp || smtp.enabled === false) return null
  if (!smtp.host || !smtp.user) return null
  return {
    host: smtp.host,
    port: Number(smtp.port || 587),
    secure: Boolean(smtp.secure),
    user: smtp.user,
    pass: smtp.pass || '',
    from: smtp.from || smtp.user,
  }
}

async function resolveSmtpConfig(schoolId) {
  if (schoolId) {
    const school = await prisma.school.findUnique({
      where: { id: schoolId },
      select: { settings: true },
    })
    const schoolSmtp = smtpFromSchoolSettings(school)
    if (schoolSmtp) return schoolSmtp
  }
  return envSmtpConfig()
}

let transporterCache = new Map()

function cacheKey(config) {
  return `${config.host}:${config.port}:${config.user}`
}

async function getTransporter(config) {
  const key = cacheKey(config)
  if (transporterCache.has(key)) return transporterCache.get(key)
  const nodemailer = require('nodemailer')
  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.user, pass: config.pass },
  })
  transporterCache.set(key, transporter)
  return transporter
}

async function sendMail({ to, subject, text, html, schoolId }) {
  const config = await resolveSmtpConfig(schoolId)
  if (!config) {
    const err = new Error('SMTP not configured')
    err.code = 'SMTP_NOT_CONFIGURED'
    throw err
  }

  const transporter = await getTransporter(config)
  await transporter.sendMail({
    from: config.from,
    to,
    subject,
    text: text || html?.replace(/<[^>]+>/g, ' ') || '',
    html: html || undefined,
  })
  return { sent: true }
}

function clearTransporterCache() {
  transporterCache = new Map()
}

module.exports = {
  sendMail,
  resolveSmtpConfig,
  envSmtpConfig,
  smtpFromSchoolSettings,
  clearTransporterCache,
}
