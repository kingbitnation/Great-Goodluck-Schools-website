function schoolIdFor(req) {
  if (req.user.role === 'SuperAdmin' && req.query.schoolId) return String(req.query.schoolId)
  return req.user.schoolId
}

function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

const { sanitizeHtml, sanitizeText } = require('../lib/htmlSanitize')

function registerPublicAdminRoutes(app, { prisma, requireRole }) {
  const roles = ['SuperAdmin', 'SchoolAdmin']

  function guardSchool(req, res, schoolId) {
    if (!schoolId) {
      res.status(400).json({ error: 'School required' })
      return false
    }
    if (req.user.role === 'SchoolAdmin' && req.user.schoolId !== schoolId) {
      res.status(403).json({ error: 'Forbidden' })
      return false
    }
    return true
  }

  // ===== OVERVIEW =====
  app.get('/api/admin/website/summary', requireRole(...roles), async (req, res) => {
    try {
      const schoolId = schoolIdFor(req)
      if (!guardSchool(req, res, schoolId)) return
      const [posts, events, gallery, staff, pages, stats, subscribers] = await Promise.all([
        prisma.publicPost.count({ where: { schoolId } }),
        prisma.publicEvent.count({ where: { schoolId } }),
        prisma.publicGalleryItem.count({ where: { schoolId } }),
        prisma.publicStaffMember.count({ where: { schoolId } }),
        prisma.publicPageContent.count({ where: { schoolId } }),
        prisma.publicSiteStat.count({ where: { schoolId } }),
        prisma.publicNewsletterSubscriber.count({ where: { schoolId } }),
      ])
      res.json({ posts, events, gallery, staff, pages, stats, subscribers })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  // ===== POSTS =====
  app.get('/api/admin/website/posts', requireRole(...roles), async (req, res) => {
    try {
      const schoolId = schoolIdFor(req)
      if (!guardSchool(req, res, schoolId)) return
      const posts = await prisma.publicPost.findMany({
        where: { schoolId, ...(req.query.type ? { postType: String(req.query.type) } : {}) },
        orderBy: { updatedAt: 'desc' },
      })
      res.json(posts)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.post('/api/admin/website/posts', requireRole(...roles), async (req, res) => {
    try {
      const schoolId = schoolIdFor(req)
      if (!guardSchool(req, res, schoolId)) return
      const { title, body, excerpt, postType, author, imageUrl, badge, published, slug } = req.body
      if (!title || !body) return res.status(400).json({ error: 'Title and body required' })
      const post = await prisma.publicPost.create({
        data: {
          schoolId,
          title: sanitizeText(title),
          body: sanitizeHtml(body),
          excerpt: excerpt ? sanitizeText(excerpt) : null,
          postType: postType || 'news',
          author: author || null,
          imageUrl: imageUrl || null,
          badge: badge || null,
          slug: slugify(slug || title),
          published: published !== false,
          publishedAt: published !== false ? new Date() : null,
        },
      })
      res.status(201).json(post)
    } catch (err) {
      console.error(err)
      res.status(400).json({ error: err.message || 'Failed to create post' })
    }
  })

  app.put('/api/admin/website/posts/:id', requireRole(...roles), async (req, res) => {
    try {
      const existing = await prisma.publicPost.findUnique({ where: { id: req.params.id } })
      if (!existing || !guardSchool(req, res, existing.schoolId)) return
      const { title, body, excerpt, postType, author, imageUrl, badge, published, slug } = req.body
      const post = await prisma.publicPost.update({
        where: { id: existing.id },
        data: {
          ...(title !== undefined ? { title: sanitizeText(title) } : {}),
          ...(body !== undefined ? { body: sanitizeHtml(body) } : {}),
          ...(excerpt !== undefined ? { excerpt: excerpt ? sanitizeText(excerpt) : null } : {}),
          ...(postType !== undefined ? { postType } : {}),
          ...(author !== undefined ? { author } : {}),
          ...(imageUrl !== undefined ? { imageUrl } : {}),
          ...(badge !== undefined ? { badge } : {}),
          ...(slug !== undefined ? { slug: slugify(slug) } : {}),
          ...(published !== undefined ? { published: Boolean(published), publishedAt: published ? new Date() : null } : {}),
        },
      })
      res.json(post)
    } catch (err) {
      console.error(err)
      res.status(400).json({ error: err.message || 'Failed to update post' })
    }
  })

  app.delete('/api/admin/website/posts/:id', requireRole(...roles), async (req, res) => {
    try {
      const existing = await prisma.publicPost.findUnique({ where: { id: req.params.id } })
      if (!existing || !guardSchool(req, res, existing.schoolId)) return
      await prisma.publicPost.delete({ where: { id: existing.id } })
      res.json({ message: 'Deleted' })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  // ===== EVENTS =====
  app.get('/api/admin/website/events', requireRole(...roles), async (req, res) => {
    try {
      const schoolId = schoolIdFor(req)
      if (!guardSchool(req, res, schoolId)) return
      const events = await prisma.publicEvent.findMany({ where: { schoolId }, orderBy: { eventDate: 'desc' } })
      res.json(events)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.post('/api/admin/website/events', requireRole(...roles), async (req, res) => {
    try {
      const schoolId = schoolIdFor(req)
      if (!guardSchool(req, res, schoolId)) return
      const { title, description, venue, category, eventDate, published } = req.body
      if (!title || !eventDate) return res.status(400).json({ error: 'Title and date required' })
      const event = await prisma.publicEvent.create({
        data: {
          schoolId,
          title,
          description: description || null,
          venue: venue || null,
          category: category || null,
          eventDate: new Date(eventDate),
          published: published !== false,
        },
      })
      res.status(201).json(event)
    } catch (err) {
      console.error(err)
      res.status(400).json({ error: err.message || 'Failed to create event' })
    }
  })

  app.put('/api/admin/website/events/:id', requireRole(...roles), async (req, res) => {
    try {
      const existing = await prisma.publicEvent.findUnique({ where: { id: req.params.id } })
      if (!existing || !guardSchool(req, res, existing.schoolId)) return
      const { title, description, venue, category, eventDate, published } = req.body
      const event = await prisma.publicEvent.update({
        where: { id: existing.id },
        data: {
          ...(title !== undefined ? { title } : {}),
          ...(description !== undefined ? { description } : {}),
          ...(venue !== undefined ? { venue } : {}),
          ...(category !== undefined ? { category } : {}),
          ...(eventDate !== undefined ? { eventDate: new Date(eventDate) } : {}),
          ...(published !== undefined ? { published: Boolean(published) } : {}),
        },
      })
      res.json(event)
    } catch (err) {
      console.error(err)
      res.status(400).json({ error: err.message || 'Failed to update event' })
    }
  })

  app.delete('/api/admin/website/events/:id', requireRole(...roles), async (req, res) => {
    try {
      const existing = await prisma.publicEvent.findUnique({ where: { id: req.params.id } })
      if (!existing || !guardSchool(req, res, existing.schoolId)) return
      await prisma.publicEvent.delete({ where: { id: existing.id } })
      res.json({ message: 'Deleted' })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  // ===== GALLERY =====
  app.get('/api/admin/website/gallery', requireRole(...roles), async (req, res) => {
    try {
      const schoolId = schoolIdFor(req)
      if (!guardSchool(req, res, schoolId)) return
      const items = await prisma.publicGalleryItem.findMany({ where: { schoolId }, orderBy: { sortOrder: 'asc' } })
      res.json(items)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.post('/api/admin/website/gallery', requireRole(...roles), async (req, res) => {
    try {
      const schoolId = schoolIdFor(req)
      if (!guardSchool(req, res, schoolId)) return
      const { title, caption, imageUrl, colorClass, sortOrder, published } = req.body
      if (!title) return res.status(400).json({ error: 'Title required' })
      const item = await prisma.publicGalleryItem.create({
        data: {
          schoolId,
          title,
          caption: caption || null,
          imageUrl: imageUrl || null,
          colorClass: colorClass || null,
          sortOrder: Number(sortOrder) || 0,
          published: published !== false,
        },
      })
      res.status(201).json(item)
    } catch (err) {
      console.error(err)
      res.status(400).json({ error: err.message || 'Failed to create gallery item' })
    }
  })

  app.put('/api/admin/website/gallery/:id', requireRole(...roles), async (req, res) => {
    try {
      const existing = await prisma.publicGalleryItem.findUnique({ where: { id: req.params.id } })
      if (!existing || !guardSchool(req, res, existing.schoolId)) return
      const { title, caption, imageUrl, colorClass, sortOrder, published } = req.body
      const item = await prisma.publicGalleryItem.update({
        where: { id: existing.id },
        data: {
          ...(title !== undefined ? { title } : {}),
          ...(caption !== undefined ? { caption } : {}),
          ...(imageUrl !== undefined ? { imageUrl } : {}),
          ...(colorClass !== undefined ? { colorClass } : {}),
          ...(sortOrder !== undefined ? { sortOrder: Number(sortOrder) } : {}),
          ...(published !== undefined ? { published: Boolean(published) } : {}),
        },
      })
      res.json(item)
    } catch (err) {
      console.error(err)
      res.status(400).json({ error: err.message || 'Failed to update gallery item' })
    }
  })

  app.delete('/api/admin/website/gallery/:id', requireRole(...roles), async (req, res) => {
    try {
      const existing = await prisma.publicGalleryItem.findUnique({ where: { id: req.params.id } })
      if (!existing || !guardSchool(req, res, existing.schoolId)) return
      await prisma.publicGalleryItem.delete({ where: { id: existing.id } })
      res.json({ message: 'Deleted' })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  // ===== STAFF =====
  app.get('/api/admin/website/staff', requireRole(...roles), async (req, res) => {
    try {
      const schoolId = schoolIdFor(req)
      if (!guardSchool(req, res, schoolId)) return
      const members = await prisma.publicStaffMember.findMany({ where: { schoolId }, orderBy: { sortOrder: 'asc' } })
      res.json(members)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.post('/api/admin/website/staff', requireRole(...roles), async (req, res) => {
    try {
      const schoolId = schoolIdFor(req)
      if (!guardSchool(req, res, schoolId)) return
      const { fullName, roleTitle, department, photoUrl, sortOrder, published } = req.body
      if (!fullName || !roleTitle) return res.status(400).json({ error: 'Name and role required' })
      const member = await prisma.publicStaffMember.create({
        data: {
          schoolId,
          fullName,
          roleTitle,
          department: department || null,
          photoUrl: photoUrl || null,
          sortOrder: Number(sortOrder) || 0,
          published: published !== false,
        },
      })
      res.status(201).json(member)
    } catch (err) {
      console.error(err)
      res.status(400).json({ error: err.message || 'Failed to create staff member' })
    }
  })

  app.put('/api/admin/website/staff/:id', requireRole(...roles), async (req, res) => {
    try {
      const existing = await prisma.publicStaffMember.findUnique({ where: { id: req.params.id } })
      if (!existing || !guardSchool(req, res, existing.schoolId)) return
      const { fullName, roleTitle, department, photoUrl, sortOrder, published } = req.body
      const member = await prisma.publicStaffMember.update({
        where: { id: existing.id },
        data: {
          ...(fullName !== undefined ? { fullName } : {}),
          ...(roleTitle !== undefined ? { roleTitle } : {}),
          ...(department !== undefined ? { department } : {}),
          ...(photoUrl !== undefined ? { photoUrl } : {}),
          ...(sortOrder !== undefined ? { sortOrder: Number(sortOrder) } : {}),
          ...(published !== undefined ? { published: Boolean(published) } : {}),
        },
      })
      res.json(member)
    } catch (err) {
      console.error(err)
      res.status(400).json({ error: err.message || 'Failed to update staff member' })
    }
  })

  app.delete('/api/admin/website/staff/:id', requireRole(...roles), async (req, res) => {
    try {
      const existing = await prisma.publicStaffMember.findUnique({ where: { id: req.params.id } })
      if (!existing || !guardSchool(req, res, existing.schoolId)) return
      await prisma.publicStaffMember.delete({ where: { id: existing.id } })
      res.json({ message: 'Deleted' })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  // ===== CMS PAGES =====
  app.get('/api/admin/website/pages', requireRole(...roles), async (req, res) => {
    try {
      const schoolId = schoolIdFor(req)
      if (!guardSchool(req, res, schoolId)) return
      const pages = await prisma.publicPageContent.findMany({ where: { schoolId }, orderBy: { slug: 'asc' } })
      res.json(pages)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.put('/api/admin/website/pages/:slug', requireRole(...roles), async (req, res) => {
    try {
      const schoolId = schoolIdFor(req)
      if (!guardSchool(req, res, schoolId)) return
      const { title, subtitle, body, published } = req.body
      if (!title || body === undefined) return res.status(400).json({ error: 'Title and body required' })
      const page = await prisma.publicPageContent.upsert({
        where: { schoolId_slug: { schoolId, slug: req.params.slug } },
        create: {
          schoolId,
          slug: req.params.slug,
          title: sanitizeText(title),
          subtitle: subtitle ? sanitizeText(subtitle) : null,
          body: sanitizeHtml(body),
          published: published !== false,
        },
        update: {
          title: sanitizeText(title),
          subtitle: subtitle != null ? sanitizeText(subtitle) : null,
          body: sanitizeHtml(body),
          ...(published !== undefined ? { published: Boolean(published) } : {}),
        },
      })
      res.json(page)
    } catch (err) {
      console.error(err)
      res.status(400).json({ error: err.message || 'Failed to save page' })
    }
  })

  // ===== SITE STATS =====
  app.get('/api/admin/website/stats', requireRole(...roles), async (req, res) => {
    try {
      const schoolId = schoolIdFor(req)
      if (!guardSchool(req, res, schoolId)) return
      const stats = await prisma.publicSiteStat.findMany({ where: { schoolId }, orderBy: { sortOrder: 'asc' } })
      res.json(stats)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.put('/api/admin/website/stats', requireRole(...roles), async (req, res) => {
    try {
      const schoolId = schoolIdFor(req)
      if (!guardSchool(req, res, schoolId)) return
      const { stats } = req.body
      if (!Array.isArray(stats)) return res.status(400).json({ error: 'stats array required' })
      await prisma.$transaction(
        stats.map((s, index) =>
          prisma.publicSiteStat.upsert({
            where: { schoolId_label: { schoolId, label: s.label } },
            create: { schoolId, label: s.label, value: s.value, sortOrder: s.sortOrder ?? index },
            update: { value: s.value, sortOrder: s.sortOrder ?? index },
          })
        )
      )
      const updated = await prisma.publicSiteStat.findMany({ where: { schoolId }, orderBy: { sortOrder: 'asc' } })
      res.json(updated)
    } catch (err) {
      console.error(err)
      res.status(400).json({ error: err.message || 'Failed to save stats' })
    }
  })

  // ===== NEWSLETTER SUBSCRIBERS (admin view) =====
  app.get('/api/admin/website/newsletter', requireRole(...roles), async (req, res) => {
    try {
      const schoolId = schoolIdFor(req)
      if (!guardSchool(req, res, schoolId)) return
      const subs = await prisma.publicNewsletterSubscriber.findMany({
        where: { schoolId },
        orderBy: { createdAt: 'desc' },
        take: 200,
      })
      res.json(subs)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })
}

module.exports = { registerPublicAdminRoutes }
