const crypto = require('crypto')
const { decryptSecret } = require('./credentialCrypto')

async function getGoogleAccessToken(integration) {
  const config = integration.config || {}
  if (config.expiresAt && new Date(config.expiresAt) > new Date(Date.now() + 60_000)) {
    return decryptSecret(config.accessTokenEnc)
  }
  const refresh = decryptSecret(config.refreshTokenEnc)
  if (!refresh) return decryptSecret(config.accessTokenEnc)

  const body = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    client_secret: process.env.GOOGLE_CLIENT_SECRET,
    refresh_token: refresh,
    grant_type: 'refresh_token',
  })
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  const data = await res.json()
  if (!data.access_token) throw new Error(data.error_description || 'Google token refresh failed')
  return data.access_token
}

async function pushEventsToGoogle(prisma, schoolId, accessToken, events) {
  let synced = 0
  for (const e of events.slice(0, 50)) {
    const body = {
      summary: e.title,
      description: e.description || e.source,
      location: e.location || undefined,
      start: e.allDay
        ? { date: e.startAt.slice(0, 10) }
        : { dateTime: e.startAt, timeZone: 'Africa/Lagos' },
      end: e.allDay
        ? { date: (e.endAt || e.startAt).slice(0, 10) }
        : { dateTime: e.endAt || e.startAt, timeZone: 'Africa/Lagos' },
    }
    const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (res.ok) synced += 1
  }
  return synced
}

async function pullGoogleEvents(accessToken, timeMin, timeMax) {
  const params = new URLSearchParams({
    timeMin: timeMin.toISOString(),
    timeMax: timeMax.toISOString(),
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '50',
  })
  const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  const data = await res.json()
  return data.items || []
}

async function syncSchoolGoogleCalendar(prisma, schoolId) {
  const integration = await prisma.schoolIntegration.findUnique({
    where: { schoolId_providerSlug: { schoolId, providerSlug: 'google-workspace' } },
  })
  if (!integration || integration.status !== 'connected') return { skipped: true }

  const { buildSchoolCalendar } = require('./calendarHelpers')
  const now = new Date()
  const from = new Date(now.getFullYear(), now.getMonth(), 1)
  const to = new Date(now.getFullYear(), now.getMonth() + 3, 0)
  const accessToken = await getGoogleAccessToken(integration)

  const { events } = await buildSchoolCalendar(prisma, schoolId, { from, to })
  const pushed = await pushEventsToGoogle(prisma, schoolId, accessToken, events)

  const googleEvents = await pullGoogleEvents(accessToken, from, to)
  let imported = 0
  for (const ge of googleEvents) {
    const start = ge.start?.dateTime || ge.start?.date
    if (!start) continue
    const exists = await prisma.calendarEvent.findFirst({
      where: { schoolId, title: ge.summary || 'Google event', startAt: new Date(start) },
    })
    if (exists) continue
    await prisma.calendarEvent.create({
      data: {
        schoolId,
        title: ge.summary || 'Google event',
        description: ge.description || 'Imported from Google Calendar',
        startAt: new Date(start),
        endAt: ge.end?.dateTime || ge.end?.date ? new Date(ge.end.dateTime || ge.end.date) : null,
        allDay: !!ge.start?.date,
        category: 'google',
        color: '#4285f4',
      },
    })
    imported += 1
  }

  await prisma.schoolIntegration.update({
    where: { id: integration.id },
    data: { lastSyncAt: new Date(), lastError: null },
  })

  return { pushed, imported }
}

async function runGoogleCalendarSyncJob(prisma) {
  const schools = await prisma.schoolIntegration.findMany({
    where: { providerSlug: 'google-workspace', status: 'connected' },
    select: { schoolId: true },
  })
  const results = []
  for (const { schoolId } of schools) {
    try {
      results.push({ schoolId, ...(await syncSchoolGoogleCalendar(prisma, schoolId)) })
    } catch (err) {
      await prisma.schoolIntegration.updateMany({
        where: { schoolId, providerSlug: 'google-workspace' },
        data: { lastError: err.message },
      })
      results.push({ schoolId, error: err.message })
    }
  }
  return results
}

function startGoogleCalendarSyncJob(prisma) {
  const run = () => runGoogleCalendarSyncJob(prisma).catch((e) => console.error('Google calendar sync:', e))
  setTimeout(run, 60_000)
  setInterval(run, 60 * 60 * 1000)
}

module.exports = { syncSchoolGoogleCalendar, runGoogleCalendarSyncJob, startGoogleCalendarSyncJob }
