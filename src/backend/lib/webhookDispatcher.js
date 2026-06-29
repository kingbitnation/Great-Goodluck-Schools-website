const { signWebhookPayload } = require('./developerHelpers')

async function deliverWebhook(prisma, { schoolId, event, payload }) {
  const endpoints = await prisma.webhookEndpoint.findMany({
    where: {
      schoolId,
      isActive: true,
      events: { has: event },
    },
  })
  if (!endpoints.length) return []

  const body = { event, schoolId, data: payload, timestamp: new Date().toISOString() }
  const results = []

  for (const endpoint of endpoints) {
    const delivery = await prisma.webhookDelivery.create({
      data: {
        endpointId: endpoint.id,
        event,
        payload: body,
        status: 'pending',
      },
    })

    try {
      const res = await fetch(endpoint.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-SchoolPilot-Event': event,
          'X-SchoolPilot-Signature': signWebhookPayload(endpoint.secret, body),
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15000),
      })
      const responseBody = await res.text().catch(() => '')
      await prisma.webhookDelivery.update({
        where: { id: delivery.id },
        data: {
          status: res.ok ? 'delivered' : 'failed',
          responseCode: res.status,
          responseBody: responseBody.slice(0, 2000),
          attempts: 1,
          deliveredAt: res.ok ? new Date() : null,
        },
      })
      results.push({ endpointId: endpoint.id, ok: res.ok, status: res.status })
    } catch (err) {
      await prisma.webhookDelivery.update({
        where: { id: delivery.id },
        data: {
          status: 'failed',
          responseBody: String(err.message || err).slice(0, 500),
          attempts: 1,
        },
      })
      results.push({ endpointId: endpoint.id, ok: false, error: err.message })
    }
  }

  return results
}

module.exports = { deliverWebhook }
