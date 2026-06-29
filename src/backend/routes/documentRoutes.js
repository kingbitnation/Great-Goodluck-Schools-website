const { uploadFile } = require('../lib/uploadHelpers')

function schoolIdFromReq(req) {
  if (req.user?.role === 'SuperAdmin' && req.query.schoolId) return req.query.schoolId
  return req.user?.schoolId
}

function canAccessDocument(user, doc) {
  if (user.role === 'SuperAdmin' || user.role === 'SchoolAdmin') return true
  if (doc.visibility === 'school') return true
  if (doc.allowedRoles?.length && doc.allowedRoles.includes(user.role)) return true
  if (doc.visibility === 'staff' && ['Teacher', 'Accountant', 'HRManager'].includes(user.role)) return true
  if (doc.visibility === 'student' && user.role === 'Student') return true
  if (doc.visibility === 'parent' && user.role === 'Parent') return true
  if (doc.createdById === user.userId) return true
  return false
}

function registerDocumentRoutes(app, { prisma, requireRole }) {
  const staff = requireRole('SuperAdmin', 'SchoolAdmin', 'Teacher', 'Accountant', 'HRManager')
  const allRoles = requireRole('SuperAdmin', 'SchoolAdmin', 'Teacher', 'Student', 'Parent', 'Accountant', 'HRManager')

  app.get('/api/documents/folders', staff, async (req, res) => {
    try {
      const schoolId = schoolIdFromReq(req)
      if (!schoolId) return res.status(400).json({ error: 'School context required' })
      const folders = await prisma.documentFolder.findMany({
        where: { schoolId },
        orderBy: { name: 'asc' },
        include: { _count: { select: { documents: true } } },
      })
      res.json({ folders })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.post('/api/documents/folders', staff, async (req, res) => {
    try {
      const schoolId = schoolIdFromReq(req)
      const { name, parentId } = req.body || {}
      if (!schoolId || !name) return res.status(400).json({ error: 'name required' })
      const folder = await prisma.documentFolder.create({
        data: { schoolId, name: String(name).slice(0, 120), parentId: parentId || null },
      })
      res.status(201).json({ folder })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.get('/api/documents', allRoles, async (req, res) => {
    try {
      const schoolId = schoolIdFromReq(req)
      if (!schoolId) return res.status(400).json({ error: 'School context required' })
      const { folderId, category, expiringSoon } = req.query
      const where = { schoolId, archivedAt: null }
      if (folderId) where.folderId = String(folderId)
      if (category) where.category = String(category)
      if (expiringSoon === 'true') {
        const in30 = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        where.expiresAt = { lte: in30, gte: new Date() }
      }
      const docs = await prisma.documentVault.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        include: {
          versions: { orderBy: { versionNumber: 'desc' }, take: 1 },
          folder: { select: { name: true } },
        },
      })
      res.json({
        documents: docs.filter((d) => canAccessDocument(req.user, d)).map((d) => ({
          ...d,
          latestVersion: d.versions[0] || null,
          versions: undefined,
        })),
      })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.get('/api/documents/:id', allRoles, async (req, res) => {
    try {
      const schoolId = schoolIdFromReq(req)
      const doc = await prisma.documentVault.findFirst({
        where: { id: req.params.id, schoolId },
        include: { versions: { orderBy: { versionNumber: 'desc' } }, folder: true },
      })
      if (!doc) return res.status(404).json({ error: 'Document not found' })
      if (!canAccessDocument(req.user, doc)) return res.status(403).json({ error: 'Forbidden' })
      res.json({ document: doc })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.post('/api/documents', staff, async (req, res) => {
    try {
      const schoolId = schoolIdFromReq(req)
      const {
        title, category, description, folderId, visibility, allowedRoles,
        studentId, employeeId, expiresAt, fileBase64, mimeType, changeNote,
      } = req.body || {}
      if (!schoolId || !title) return res.status(400).json({ error: 'title required' })
      if (!fileBase64) return res.status(400).json({ error: 'fileBase64 required' })

      const uploaded = await uploadFile({ fileBase64, folder: `vault-${schoolId}`, resourceType: 'auto' })
      const doc = await prisma.documentVault.create({
        data: {
          schoolId,
          folderId: folderId || null,
          title: String(title).slice(0, 200),
          category: category || 'general',
          description: description || null,
          visibility: visibility || 'staff',
          allowedRoles: Array.isArray(allowedRoles) ? allowedRoles.map(String) : [],
          studentId: studentId || null,
          employeeId: employeeId || null,
          expiresAt: expiresAt ? new Date(expiresAt) : null,
          createdById: req.user.userId,
          versions: {
            create: {
              versionNumber: 1,
              fileUrl: uploaded.url,
              mimeType: mimeType || uploaded.mime,
              fileSize: uploaded.size || null,
              changeNote: changeNote || 'Initial upload',
              uploadedById: req.user.userId,
            },
          },
        },
        include: { versions: true },
      })
      res.status(201).json({ document: doc })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: err.message || 'Server error' })
    }
  })

  app.post('/api/documents/:id/versions', staff, async (req, res) => {
    try {
      const schoolId = schoolIdFromReq(req)
      const { fileBase64, mimeType, changeNote } = req.body || {}
      if (!fileBase64) return res.status(400).json({ error: 'fileBase64 required' })
      const doc = await prisma.documentVault.findFirst({ where: { id: req.params.id, schoolId } })
      if (!doc) return res.status(404).json({ error: 'Document not found' })

      const latest = await prisma.documentVersion.findFirst({
        where: { documentId: doc.id },
        orderBy: { versionNumber: 'desc' },
      })
      const versionNumber = (latest?.versionNumber || 0) + 1
      const uploaded = await uploadFile({ fileBase64, folder: `vault-${schoolId}`, resourceType: 'auto' })
      const version = await prisma.documentVersion.create({
        data: {
          documentId: doc.id,
          versionNumber,
          fileUrl: uploaded.url,
          mimeType: mimeType || uploaded.mime,
          fileSize: uploaded.size || null,
          changeNote: changeNote || `Version ${versionNumber}`,
          uploadedById: req.user.userId,
        },
      })
      await prisma.documentVault.update({ where: { id: doc.id }, data: { updatedAt: new Date() } })
      res.status(201).json({ version })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: err.message || 'Server error' })
    }
  })

  app.patch('/api/documents/:id', staff, async (req, res) => {
    try {
      const schoolId = schoolIdFromReq(req)
      const doc = await prisma.documentVault.findFirst({ where: { id: req.params.id, schoolId } })
      if (!doc) return res.status(404).json({ error: 'Document not found' })
      const { title, category, description, folderId, visibility, allowedRoles, expiresAt, archived } = req.body || {}
      const updated = await prisma.documentVault.update({
        where: { id: doc.id },
        data: {
          ...(title != null ? { title: String(title).slice(0, 200) } : {}),
          ...(category != null ? { category } : {}),
          ...(description !== undefined ? { description } : {}),
          ...(folderId !== undefined ? { folderId: folderId || null } : {}),
          ...(visibility != null ? { visibility } : {}),
          ...(Array.isArray(allowedRoles) ? { allowedRoles } : {}),
          ...(expiresAt !== undefined ? { expiresAt: expiresAt ? new Date(expiresAt) : null } : {}),
          ...(archived === true ? { archivedAt: new Date() } : {}),
          ...(archived === false ? { archivedAt: null } : {}),
        },
      })
      res.json({ document: updated })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.delete('/api/documents/:id', staff, async (req, res) => {
    try {
      const schoolId = schoolIdFromReq(req)
      const doc = await prisma.documentVault.findFirst({ where: { id: req.params.id, schoolId } })
      if (!doc) return res.status(404).json({ error: 'Document not found' })
      await prisma.documentVault.delete({ where: { id: doc.id } })
      res.json({ message: 'Document deleted' })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.get('/api/documents/expiring/list', staff, async (req, res) => {
    try {
      const schoolId = schoolIdFromReq(req)
      const in30 = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      const docs = await prisma.documentVault.findMany({
        where: { schoolId, archivedAt: null, expiresAt: { lte: in30, gte: new Date() } },
        orderBy: { expiresAt: 'asc' },
      })
      res.json({ documents: docs })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })
}

module.exports = { registerDocumentRoutes }
