const { createFeatureGuard } = require('../lib/featureFlags')
const { generateApiKey, generateWebhookSecret } = require('../lib/developerHelpers')
const { ensureIntegrationCatalog } = require('../lib/integrationCatalog')
const { TRIGGERS } = require('../lib/workflowEngine')

function schoolIdFromReq(req) {
  if (req.user?.role === 'SuperAdmin' && req.query.schoolId) return req.query.schoolId
  return req.user?.schoolId
}

function registerDeveloperRoutes(app, { prisma, requireRole }) {
  const schoolAdmin = requireRole('SuperAdmin', 'SchoolAdmin')
  const superAdmin = requireRole('SuperAdmin')
  const apiAccessGuard = createFeatureGuard(prisma, 'apiAccess')

  async function requireApiAccess(req, res, next) {
    if (req.user?.role === 'SuperAdmin') return next()
    return apiAccessGuard(req, res, next)
  }

  // ===== API KEYS =====
  app.get('/api/developer/keys', schoolAdmin, requireApiAccess, async (req, res) => {
    try {
      const schoolId = schoolIdFromReq(req)
      if (!schoolId) return res.status(400).json({ error: 'School context required' })
      const keys = await prisma.developerApiKey.findMany({
        where: { schoolId, revokedAt: null },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, name: true, keyPrefix: true, scopes: true, rateLimit: true,
          lastUsedAt: true, expiresAt: true, createdAt: true,
        },
      })
      res.json({ keys })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.post('/api/developer/keys', schoolAdmin, requireApiAccess, async (req, res) => {
    try {
      const schoolId = schoolIdFromReq(req)
      if (!schoolId) return res.status(400).json({ error: 'School context required' })
      const { name, scopes = [], rateLimit = 1000, expiresAt } = req.body || {}
      if (!name) return res.status(400).json({ error: 'name is required' })

      const { rawKey, keyPrefix, keyHash } = generateApiKey()
      const key = await prisma.developerApiKey.create({
        data: {
          schoolId,
          name: String(name).slice(0, 120),
          keyPrefix,
          keyHash,
          scopes: Array.isArray(scopes) ? scopes.map(String) : [],
          rateLimit: Math.min(Math.max(Number(rateLimit) || 1000, 100), 10000),
          expiresAt: expiresAt ? new Date(expiresAt) : null,
          createdById: req.user.userId,
        },
      })
      res.status(201).json({
        key: {
          id: key.id,
          name: key.name,
          keyPrefix: key.keyPrefix,
          scopes: key.scopes,
          rateLimit: key.rateLimit,
          createdAt: key.createdAt,
        },
        secret: rawKey,
        message: 'Copy the secret now — it will not be shown again.',
      })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.post('/api/developer/keys/:id/revoke', schoolAdmin, requireApiAccess, async (req, res) => {
    try {
      const schoolId = schoolIdFromReq(req)
      const key = await prisma.developerApiKey.findFirst({ where: { id: req.params.id, schoolId } })
      if (!key) return res.status(404).json({ error: 'Key not found' })
      await prisma.developerApiKey.update({
        where: { id: key.id },
        data: { revokedAt: new Date() },
      })
      res.json({ message: 'API key revoked' })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  // ===== WEBHOOKS =====
  app.get('/api/developer/webhooks', schoolAdmin, requireApiAccess, async (req, res) => {
    try {
      const schoolId = schoolIdFromReq(req)
      if (!schoolId) return res.status(400).json({ error: 'School context required' })
      const endpoints = await prisma.webhookEndpoint.findMany({
        where: { schoolId },
        orderBy: { createdAt: 'desc' },
        include: {
          deliveries: { orderBy: { createdAt: 'desc' }, take: 5 },
        },
      })
      res.json({
        endpoints: endpoints.map((e) => ({
          ...e,
          secret: undefined,
          secretPreview: `${e.secret.slice(0, 6)}…`,
        })),
      })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.post('/api/developer/webhooks', schoolAdmin, requireApiAccess, async (req, res) => {
    try {
      const schoolId = schoolIdFromReq(req)
      const { url, events = [], description } = req.body || {}
      if (!schoolId || !url) return res.status(400).json({ error: 'url required' })
      const secret = generateWebhookSecret()
      const endpoint = await prisma.webhookEndpoint.create({
        data: {
          schoolId,
          url: String(url),
          secret,
          events: Array.isArray(events) ? events.map(String) : [],
          description: description || null,
        },
      })
      res.status(201).json({ endpoint: { ...endpoint, secret }, message: 'Save the signing secret securely.' })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.patch('/api/developer/webhooks/:id', schoolAdmin, requireApiAccess, async (req, res) => {
    try {
      const schoolId = schoolIdFromReq(req)
      const existing = await prisma.webhookEndpoint.findFirst({ where: { id: req.params.id, schoolId } })
      if (!existing) return res.status(404).json({ error: 'Webhook not found' })
      const { url, events, isActive, description } = req.body || {}
      const endpoint = await prisma.webhookEndpoint.update({
        where: { id: existing.id },
        data: {
          ...(url != null ? { url: String(url) } : {}),
          ...(Array.isArray(events) ? { events: events.map(String) } : {}),
          ...(isActive != null ? { isActive: Boolean(isActive) } : {}),
          ...(description !== undefined ? { description } : {}),
        },
      })
      res.json({ endpoint: { ...endpoint, secret: undefined } })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.get('/api/developer/webhooks/:id/deliveries', schoolAdmin, requireApiAccess, async (req, res) => {
    try {
      const schoolId = schoolIdFromReq(req)
      const endpoint = await prisma.webhookEndpoint.findFirst({ where: { id: req.params.id, schoolId } })
      if (!endpoint) return res.status(404).json({ error: 'Webhook not found' })
      const deliveries = await prisma.webhookDelivery.findMany({
        where: { endpointId: endpoint.id },
        orderBy: { createdAt: 'desc' },
        take: 50,
      })
      res.json({ deliveries })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  // ===== INTEGRATIONS =====
  app.get('/api/developer/integrations/catalog', schoolAdmin, async (req, res) => {
    try {
      await ensureIntegrationCatalog(prisma)
      const providers = await prisma.integrationProvider.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
      })
      res.json({ providers })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.get('/api/developer/integrations', schoolAdmin, async (req, res) => {
    try {
      const schoolId = schoolIdFromReq(req)
      if (!schoolId) return res.status(400).json({ error: 'School context required' })
      await ensureIntegrationCatalog(prisma)
      const [providers, connections] = await Promise.all([
        prisma.integrationProvider.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } }),
        prisma.schoolIntegration.findMany({ where: { schoolId } }),
      ])
      const bySlug = Object.fromEntries(connections.map((c) => [c.providerSlug, c]))
      res.json({
        integrations: providers.map((p) => ({
          provider: p,
          connection: bySlug[p.slug] || null,
        })),
      })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.post('/api/developer/integrations/:slug/connect', schoolAdmin, async (req, res) => {
    try {
      const schoolId = schoolIdFromReq(req)
      if (!schoolId) return res.status(400).json({ error: 'School context required' })
      const slug = req.params.slug
      const provider = await prisma.integrationProvider.findUnique({ where: { slug } })
      if (!provider) return res.status(404).json({ error: 'Unknown integration' })

      const config = req.body?.config || {}
      const connection = await prisma.schoolIntegration.upsert({
        where: { schoolId_providerSlug: { schoolId, providerSlug: slug } },
        create: {
          schoolId,
          providerSlug: slug,
          status: 'connected',
          config,
          connectedAt: new Date(),
        },
        update: {
          status: 'connected',
          config,
          connectedAt: new Date(),
          lastError: null,
        },
      })
      res.json({ connection, message: `${provider.name} connected (configuration saved). OAuth flows coming in Phase 4B.` })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.post('/api/developer/integrations/:slug/disconnect', schoolAdmin, async (req, res) => {
    try {
      const schoolId = schoolIdFromReq(req)
      const connection = await prisma.schoolIntegration.findUnique({
        where: { schoolId_providerSlug: { schoolId, providerSlug: req.params.slug } },
      })
      if (!connection) return res.status(404).json({ error: 'Not connected' })
      await prisma.schoolIntegration.update({
        where: { id: connection.id },
        data: { status: 'disconnected', config: null, connectedAt: null },
      })
      res.json({ message: 'Disconnected' })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  // ===== WORKFLOW AUTOMATION =====
  app.get('/api/developer/workflows/triggers', schoolAdmin, (_req, res) => {
    res.json({
      triggers: [
        { key: TRIGGERS.ATTENDANCE_MARKED, label: 'Attendance marked', description: 'Runs when any attendance record is created.' },
        { key: TRIGGERS.ATTENDANCE_ABSENT_STREAK, label: 'Consecutive absences', description: 'Runs when a student is marked absent; use minAbsentDays condition.' },
        { key: TRIGGERS.PAYMENT_APPROVED, label: 'Payment approved', description: 'Coming soon — fires when accountant approves a payment.' },
        { key: TRIGGERS.FEE_OVERDUE, label: 'Fee overdue', description: 'Coming soon — scheduled fee reminders.' },
      ],
      actionTypes: [
        { type: 'notify', label: 'Notify parent', fields: ['title', 'body', 'channels'] },
        { type: 'notify_teacher', label: 'Notify teacher', fields: ['title', 'body'] },
        { type: 'webhook', label: 'Send webhook', fields: ['event'] },
      ],
    })
  })

  app.get('/api/developer/workflows', schoolAdmin, async (req, res) => {
    try {
      const schoolId = schoolIdFromReq(req)
      if (!schoolId) return res.status(400).json({ error: 'School context required' })
      const rules = await prisma.workflowRule.findMany({
        where: { schoolId },
        orderBy: { updatedAt: 'desc' },
        include: { runs: { orderBy: { createdAt: 'desc' }, take: 3 } },
      })
      res.json({ rules })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.post('/api/developer/workflows', schoolAdmin, async (req, res) => {
    try {
      const schoolId = schoolIdFromReq(req)
      const { name, description, trigger, conditions, actions, isActive = true } = req.body || {}
      if (!schoolId || !name || !trigger || !actions) {
        return res.status(400).json({ error: 'name, trigger, and actions are required' })
      }
      const rule = await prisma.workflowRule.create({
        data: {
          schoolId,
          name: String(name).slice(0, 160),
          description: description || null,
          trigger: String(trigger),
          conditions: conditions || null,
          actions,
          isActive: Boolean(isActive),
          createdById: req.user.userId,
        },
      })
      res.status(201).json({ rule })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.patch('/api/developer/workflows/:id', schoolAdmin, async (req, res) => {
    try {
      const schoolId = schoolIdFromReq(req)
      const existing = await prisma.workflowRule.findFirst({ where: { id: req.params.id, schoolId } })
      if (!existing) return res.status(404).json({ error: 'Workflow not found' })
      const { name, description, trigger, conditions, actions, isActive } = req.body || {}
      const rule = await prisma.workflowRule.update({
        where: { id: existing.id },
        data: {
          ...(name != null ? { name: String(name).slice(0, 160) } : {}),
          ...(description !== undefined ? { description } : {}),
          ...(trigger != null ? { trigger: String(trigger) } : {}),
          ...(conditions !== undefined ? { conditions } : {}),
          ...(actions != null ? { actions } : {}),
          ...(isActive != null ? { isActive: Boolean(isActive) } : {}),
        },
      })
      res.json({ rule })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.delete('/api/developer/workflows/:id', schoolAdmin, async (req, res) => {
    try {
      const schoolId = schoolIdFromReq(req)
      const existing = await prisma.workflowRule.findFirst({ where: { id: req.params.id, schoolId } })
      if (!existing) return res.status(404).json({ error: 'Workflow not found' })
      await prisma.workflowRule.delete({ where: { id: existing.id } })
      res.json({ message: 'Workflow deleted' })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  // ===== PLATFORM OVERVIEW (super admin) =====
  app.get('/api/platform/developer', superAdmin, async (_req, res) => {
    try {
      const [keyCount, webhookCount, workflowCount, integrationCount] = await Promise.all([
        prisma.developerApiKey.count({ where: { revokedAt: null } }),
        prisma.webhookEndpoint.count(),
        prisma.workflowRule.count({ where: { isActive: true } }),
        prisma.schoolIntegration.count({ where: { status: 'connected' } }),
      ])
      const recentDeliveries = await prisma.webhookDelivery.findMany({
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: { endpoint: { select: { schoolId: true, url: true } } },
      })
      res.json({
        totals: { apiKeys: keyCount, webhooks: webhookCount, activeWorkflows: workflowCount, connectedIntegrations: integrationCount },
        recentDeliveries,
      })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })
}

module.exports = { registerDeveloperRoutes }
