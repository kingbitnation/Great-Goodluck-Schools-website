const { hashApiKey } = require('./developerHelpers')

const DEFAULT_INTEGRATIONS = [
  { slug: 'google-workspace', name: 'Google Workspace', category: 'productivity', description: 'Calendar, Drive, and SSO for staff.' },
  { slug: 'microsoft-365', name: 'Microsoft 365', category: 'productivity', description: 'Outlook calendar and Teams integration.' },
  { slug: 'zoom', name: 'Zoom', category: 'video', description: 'Auto-create Zoom meetings for live classes.' },
  { slug: 'google-meet', name: 'Google Meet', category: 'video', description: 'Meet links on timetable and live classes.' },
  { slug: 'whatsapp', name: 'WhatsApp Business', category: 'messaging', description: 'Fee reminders and announcements via WhatsApp.' },
  { slug: 'slack', name: 'Slack', category: 'messaging', description: 'Staff alerts and workflow notifications.' },
  { slug: 'paystack', name: 'Paystack', category: 'payments', description: 'Online fee and subscription collections.' },
  { slug: 'flutterwave', name: 'Flutterwave', category: 'payments', description: 'Multi-currency payment gateway.' },
  { slug: 'stripe', name: 'Stripe', category: 'payments', description: 'International card payments.' },
  { slug: 'cloudinary', name: 'Cloudinary', category: 'storage', description: 'Media CDN for uploads and galleries.' },
  { slug: 'aws-s3', name: 'AWS S3', category: 'storage', description: 'Object storage for documents and backups.' },
  { slug: 'dropbox', name: 'Dropbox', category: 'storage', description: 'Staff file sync and sharing.' },
  { slug: 'google-drive', name: 'Google Drive', category: 'storage', description: 'Store lesson materials and documents.' },
]

async function ensureIntegrationCatalog(prisma) {
  for (const [i, item] of DEFAULT_INTEGRATIONS.entries()) {
    await prisma.integrationProvider.upsert({
      where: { slug: item.slug },
      create: { ...item, sortOrder: i, isActive: true },
      update: { name: item.name, description: item.description, category: item.category, sortOrder: i },
    })
  }
}

async function resolveApiKey(prisma, rawKey) {
  if (!rawKey || !String(rawKey).startsWith('sp_live_')) return null
  const keyHash = hashApiKey(rawKey)
  const record = await prisma.developerApiKey.findUnique({
    where: { keyHash },
    include: { school: { select: { id: true, status: true } } },
  })
  if (!record || record.revokedAt) return null
  if (record.expiresAt && record.expiresAt < new Date()) return null
  if (record.school?.status === 'suspended') return null
  await prisma.developerApiKey.update({
    where: { id: record.id },
    data: { lastUsedAt: new Date() },
  }).catch(() => {})
  return record
}

module.exports = {
  DEFAULT_INTEGRATIONS,
  ensureIntegrationCatalog,
  resolveApiKey,
}
