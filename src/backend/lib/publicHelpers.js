async function resolvePublicSchool(prisma, schoolId, host) {
  const select = {
    id: true,
    name: true,
    address: true,
    city: true,
    state: true,
    country: true,
    contactEmail: true,
    contactPhone: true,
    website: true,
    logo: true,
    primaryColor: true,
    secondaryColor: true,
    customDomain: true,
  }

  if (schoolId) {
    const school = await prisma.school.findFirst({
      where: { id: String(schoolId), status: 'active' },
      select,
    })
    if (school) return school
  }

  if (host) {
    const normalized = String(host).split(':')[0].toLowerCase()
    const byDomain = await prisma.school.findFirst({
      where: { customDomain: normalized, status: 'active' },
      select,
    })
    if (byDomain) return byDomain
  }

  return prisma.school.findFirst({
    where: { status: 'active' },
    orderBy: { createdAt: 'asc' },
    select,
  })
}

function formatPost(post) {
  return {
    id: post.id,
    slug: post.slug,
    postType: post.postType,
    title: post.title,
    excerpt: post.excerpt,
    body: post.body,
    author: post.author,
    imageUrl: post.imageUrl,
    badge: post.badge,
    icon: post.icon,
    publishedAt: post.publishedAt || post.createdAt,
  }
}

function formatEvent(event) {
  const d = new Date(event.eventDate)
  return {
    id: event.id,
    title: event.title,
    description: event.description,
    venue: event.venue,
    category: event.category,
    eventDate: event.eventDate,
    dateLabel: d.toLocaleDateString('en', { month: 'short', day: 'numeric' }),
    monthShort: d.toLocaleDateString('en', { month: 'short' }),
    dayNum: d.getDate(),
    badge: event.category || 'Event',
  }
}

function formatGalleryItem(item) {
  return {
    id: item.id,
    title: item.title,
    caption: item.caption,
    imageUrl: item.imageUrl,
    colorClass: item.colorClass || 'from-blue-500 to-cyan-500',
  }
}

function formatStaff(member) {
  return {
    id: member.id,
    name: member.fullName,
    role: member.roleTitle,
    dept: member.department,
    photoUrl: member.photoUrl,
  }
}

function formatPage(page) {
  return {
    slug: page.slug,
    title: page.title,
    subtitle: page.subtitle,
    body: page.body,
  }
}

async function buildHomeBundle(prisma, schoolId) {
  const [stats, news, events, features] = await Promise.all([
    prisma.publicSiteStat.findMany({
      where: { schoolId },
      orderBy: { sortOrder: 'asc' },
    }),
    prisma.publicPost.findMany({
      where: { schoolId, postType: 'news', published: true },
      orderBy: { publishedAt: 'desc' },
      take: 3,
    }),
    prisma.publicEvent.findMany({
      where: { schoolId, published: true, eventDate: { gte: new Date() } },
      orderBy: { eventDate: 'asc' },
      take: 4,
    }),
    prisma.publicPageContent.findUnique({
      where: { schoolId_slug: { schoolId, slug: 'home-features' } },
    }),
  ])

  let liveStats = stats
  if (!liveStats.length) {
    const [studentCount, teacherCount] = await Promise.all([
      prisma.student.count({ where: { schoolId } }),
      prisma.teacher.count({ where: { schoolId } }),
    ])
    liveStats = [
      { label: 'Students', value: `${studentCount}+` },
      { label: 'Expert Teachers', value: `${teacherCount}+` },
      { label: 'Years of Excellence', value: '25+' },
      { label: 'WAEC Pass Rate', value: '98%' },
    ]
  }

  return {
    stats: liveStats.map((s) => ({ label: s.label, value: s.value })),
    featuredNews: news.map(formatPost),
    featuredEvents: events.map(formatEvent),
    features: features?.body?.features || [],
  }
}

module.exports = {
  resolvePublicSchool,
  formatPost,
  formatEvent,
  formatGalleryItem,
  formatStaff,
  formatPage,
  buildHomeBundle,
}
