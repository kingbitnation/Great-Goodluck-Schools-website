function parseRange(query) {
  const now = new Date()
  const from = query.from ? new Date(query.from) : new Date(now.getFullYear(), now.getMonth(), 1)
  const to = query.to ? new Date(query.to) : new Date(now.getFullYear(), now.getMonth() + 2, 0, 23, 59, 59)
  return { from, to }
}

function toEvent({ id, title, startAt, endAt, allDay, category, color, location, description, source }) {
  return {
    id,
    title,
    startAt: startAt instanceof Date ? startAt.toISOString() : startAt,
    endAt: endAt ? (endAt instanceof Date ? endAt.toISOString() : endAt) : null,
    allDay: !!allDay,
    category,
    color: color || '#f59e0b',
    location: location || null,
    description: description || null,
    source,
  }
}

async function buildSchoolCalendar(prisma, schoolId, { from, to, categories }) {
  const catSet = categories?.length ? new Set(categories) : null
  const inRange = (start, end) => {
    const s = new Date(start)
    const e = end ? new Date(end) : s
    return s <= to && e >= from
  }
  const include = (cat) => !catSet || catSet.has(cat)

  const [
    customEvents,
    publicEvents,
    liveClasses,
    cbtExams,
    fees,
    installments,
    terms,
    sessions,
  ] = await Promise.all([
    prisma.calendarEvent.findMany({ where: { schoolId, startAt: { lte: to }, OR: [{ endAt: null }, { endAt: { gte: from } }] } }),
    prisma.publicEvent.findMany({ where: { schoolId, published: true, eventDate: { gte: from, lte: to } } }),
    prisma.liveClass.findMany({
      where: { schoolId, scheduledAt: { gte: from, lte: to } },
      include: { class: { select: { name: true } }, subject: { select: { name: true } } },
    }),
    prisma.exam.findMany({
      where: {
        OR: [{ schoolId }, { class: { schoolId } }],
        published: true,
        startDate: { lte: to },
        endDate: { gte: from },
      },
      include: { subject: { select: { name: true } }, class: { select: { name: true } } },
    }),
    prisma.fee.findMany({ where: { schoolId, dueDate: { gte: from, lte: to } }, include: { class: { select: { name: true } } } }),
    prisma.feeInstallment.findMany({
      where: { dueDate: { gte: from, lte: to }, fee: { schoolId } },
      include: { fee: { select: { name: true, schoolId: true } } },
    }),
    prisma.term.findMany({
      where: { session: { schoolId }, startDate: { lte: to }, endDate: { gte: from } },
      include: { session: { select: { name: true } } },
    }),
    prisma.session.findMany({
      where: { schoolId, startDate: { lte: to }, endDate: { gte: from } },
    }),
  ])

  const events = []

  if (include('custom')) {
    for (const e of customEvents) {
      if (!inRange(e.startAt, e.endAt || e.startAt)) continue
      events.push(toEvent({
        id: `cal-${e.id}`,
        title: e.title,
        startAt: e.startAt,
        endAt: e.endAt,
        allDay: e.allDay,
        category: e.category,
        color: e.color,
        location: e.location,
        description: e.description,
        source: 'calendar_event',
      }))
    }
  }

  if (include('event')) {
    for (const e of publicEvents) {
      events.push(toEvent({
        id: `pub-${e.id}`,
        title: e.title,
        startAt: e.eventDate,
        endAt: e.eventDate,
        allDay: true,
        category: 'event',
        color: '#8b5cf6',
        location: e.venue,
        description: e.description,
        source: 'public_event',
      }))
    }
  }

  if (include('live_class')) {
    for (const lc of liveClasses) {
      const end = lc.scheduledAt ? new Date(lc.scheduledAt.getTime() + 60 * 60 * 1000) : null
      events.push(toEvent({
        id: `live-${lc.id}`,
        title: lc.title || `Live: ${lc.subject?.name || 'Class'}`,
        startAt: lc.scheduledAt,
        endAt: end,
        category: 'live_class',
        color: '#06b6d4',
        location: lc.class?.name,
        description: lc.description,
        source: 'live_class',
      }))
    }
  }

  if (include('exam')) {
    for (const ex of cbtExams) {
      events.push(toEvent({
        id: `exam-${ex.id}`,
        title: ex.name || `${ex.subject?.name || 'Exam'}${ex.class?.name ? ` — ${ex.class.name}` : ''}`,
        startAt: ex.startDate,
        endAt: ex.endDate,
        category: 'exam',
        color: '#ef4444',
        description: ex.type,
        source: 'exam',
      }))
    }
  }

  if (include('fee')) {
    for (const f of fees) {
      events.push(toEvent({
        id: `fee-${f.id}`,
        title: `Fee due: ${f.name}${f.class?.name ? ` (${f.class.name})` : ''}`,
        startAt: f.dueDate,
        endAt: f.dueDate,
        allDay: true,
        category: 'fee',
        color: '#f97316',
        description: `₦${f.amount}`,
        source: 'fee',
      }))
    }
    for (const inst of installments) {
      events.push(toEvent({
        id: `inst-${inst.id}`,
        title: `Installment: ${inst.fee.name} — ${inst.label}`,
        startAt: inst.dueDate,
        endAt: inst.dueDate,
        allDay: true,
        category: 'fee',
        color: '#fb923c',
        description: `₦${inst.amount}`,
        source: 'fee_installment',
      }))
    }
  }

  if (include('term')) {
    for (const t of terms) {
      events.push(toEvent({
        id: `term-${t.id}`,
        title: `${t.name} (${t.session.name})`,
        startAt: t.startDate,
        endAt: t.endDate,
        allDay: true,
        category: 'term',
        color: '#64748b',
        source: 'term',
      }))
    }
  }

  if (include('session')) {
    for (const s of sessions) {
      events.push(toEvent({
        id: `session-${s.id}`,
        title: `Session: ${s.name}`,
        startAt: s.startDate,
        endAt: s.endDate,
        allDay: true,
        category: 'session',
        color: '#475569',
        source: 'session',
      }))
    }
  }

  events.sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
  return { from: from.toISOString(), to: to.toISOString(), events, total: events.length }
}

module.exports = { buildSchoolCalendar, parseRange }
