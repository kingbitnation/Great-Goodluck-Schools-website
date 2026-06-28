const { request } = require('./helpers/http')

async function get(path) {
  return request('GET', path)
}

async function main() {
  const health = await get('/api/health')
  if (health.status !== 200 || !health.body.db) {
    console.error('Health check failed', health)
    process.exit(1)
  }
  console.log('Health check passed', health.body.version ? `(v${health.body.version})` : '')

  const live = await get('/api/health/live')
  if (live.status !== 200) {
    console.error('Liveness check failed', live)
    process.exit(1)
  }
  console.log('Liveness check passed')

  const ready = await get('/api/health/ready')
  if (ready.status !== 200 || !ready.body.db) {
    console.error('Readiness check failed', ready)
    process.exit(1)
  }
  console.log('Readiness check passed')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
