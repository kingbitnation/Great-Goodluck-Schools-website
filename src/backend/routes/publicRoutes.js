const {
  resolvePublicSchool,
  formatPost,
  formatEvent,
  formatGalleryItem,
  formatStaff,
  formatPage,
  buildHomeBundle,
} = require('../lib/publicHelpers')

function registerPublicRoutes(app, { prisma }) {
  function schoolFromRequest(req) {
    return resolvePublicSchool(prisma, req.query.schoolId, req.headers.host)
  }

  app.post('/api/public/newsletter', async (req, res) => {
    try {
      const { email, name } = req.body
      if (!email) return res.status(400).json({ error: 'Email required' })
      const school = await schoolFromRequest(req)
      if (!school) return res.status(404).json({ error: 'School not found' })
      const sub = await prisma.publicNewsletterSubscriber.upsert({
        where: { schoolId_email: { schoolId: school.id, email: String(email).toLowerCase().trim() } },
        create: { schoolId: school.id, email: String(email).toLowerCase().trim(), name: name || null },
        update: { name: name || null },
      })
      res.status(201).json({ message: 'Subscribed successfully', id: sub.id })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.get('/api/public/school-info', async (req, res) => {
    try {
      const school = await schoolFromRequest(req)
      if (!school) return res.status(404).json({ error: 'School not found' })
      res.json(school)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.get('/api/public/home', async (req, res) => {
    try {
      const school = await schoolFromRequest(req)
      if (!school) return res.status(404).json({ error: 'School not found' })
      const principal = await prisma.publicPageContent.findUnique({
        where: { schoolId_slug: { schoolId: school.id, slug: 'principal-message' } },
      })
      res.json({
        school,
        principal: principal ? formatPage(principal) : null,
        ...(await buildHomeBundle(prisma, school.id)),
      })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.get('/api/public/stats', async (req, res) => {
    try {
      const school = await schoolFromRequest(req)
      if (!school) return res.json([])
      const bundle = await buildHomeBundle(prisma, school.id)
      res.json(bundle.stats)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.get('/api/public/posts', async (req, res) => {
    try {
      const school = await schoolFromRequest(req)
      if (!school) return res.json([])
      const postType = req.query.type ? String(req.query.type) : undefined
      const posts = await prisma.publicPost.findMany({
        where: {
          schoolId: school.id,
          published: true,
          ...(postType ? { postType } : {}),
        },
        orderBy: { publishedAt: 'desc' },
        take: Math.min(Number(req.query.limit) || 50, 100),
      })
      res.json(posts.map(formatPost))
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.get('/api/public/posts/:slug', async (req, res) => {
    try {
      const school = await schoolFromRequest(req)
      if (!school) return res.status(404).json({ error: 'Not found' })
      const post = await prisma.publicPost.findFirst({
        where: { schoolId: school.id, slug: req.params.slug, published: true },
      })
      if (!post) return res.status(404).json({ error: 'Not found' })
      res.json(formatPost(post))
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.get('/api/public/events', async (req, res) => {
    try {
      const school = await schoolFromRequest(req)
      if (!school) return res.json([])
      const upcoming = req.query.upcoming === 'true'
      const events = await prisma.publicEvent.findMany({
        where: {
          schoolId: school.id,
          published: true,
          ...(upcoming ? { eventDate: { gte: new Date() } } : {}),
        },
        orderBy: { eventDate: 'asc' },
        take: 50,
      })
      res.json(events.map(formatEvent))
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.get('/api/public/gallery', async (req, res) => {
    try {
      const school = await schoolFromRequest(req)
      if (!school) return res.json([])
      const items = await prisma.publicGalleryItem.findMany({
        where: { schoolId: school.id, published: true },
        orderBy: { sortOrder: 'asc' },
      })
      res.json(items.map(formatGalleryItem))
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.get('/api/public/staff', async (req, res) => {
    try {
      const school = await schoolFromRequest(req)
      if (!school) return res.json([])
      const members = await prisma.publicStaffMember.findMany({
        where: { schoolId: school.id, published: true },
        orderBy: { sortOrder: 'asc' },
      })
      res.json(members.map(formatStaff))
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.get('/api/public/pages/:slug', async (req, res) => {
    try {
      const school = await schoolFromRequest(req)
      if (!school) return res.status(404).json({ error: 'Not found' })
      const page = await prisma.publicPageContent.findFirst({
        where: { schoolId: school.id, slug: req.params.slug, published: true },
      })
      if (!page) return res.status(404).json({ error: 'Not found' })
      res.json(formatPage(page))
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })
}

module.exports = { registerPublicRoutes }
