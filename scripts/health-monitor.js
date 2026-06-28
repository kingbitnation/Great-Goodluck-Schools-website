#!/usr/bin/env node
/**
 * Poll /api/health/ready and alert on failure (cron or systemd timer).
 * Usage:
 *   HEALTH_CHECK_URL=https://api.schoolpilot.ng/api/health/ready npm run health:monitor
 * Schedule every 5 min: 0,5,10... * * * * cd /app && node scripts/health-monitor.js
 */
const url = process.env.HEALTH_CHECK_URL || 'http://localhost:4000/api/health/ready'
const slack = process.env.SLACK_WEBHOOK_URL

async function notify(text) {
  console.error(`[health] ALERT: ${text}`)
  if (!slack) return
  try {
    await fetch(slack, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: `🚨 SchoolPilot: ${text}` }),
    })
  } catch (e) {
    console.error('[health] Slack notify failed:', e.message)
  }
}

async function main() {
  const start = Date.now()
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) })
    const body = await res.json().catch(() => ({}))
    if (!res.ok || body.status !== 'ready') {
      await notify(`Health check failed (${res.status}) ${url} — ${JSON.stringify(body)}`)
      process.exit(1)
    }
    console.log(`[health] OK ${url} (${Date.now() - start}ms)`)
  } catch (err) {
    await notify(`Health check unreachable: ${url} — ${err.message}`)
    process.exit(1)
  }
}

main()
