const http = require('http')

const port = Number(process.env.PORT || 4000)
const host = process.env.API_HOST || '127.0.0.1'
const path = process.env.HEALTH_PATH || '/api/health/ready'

function checkBackend() {
  return new Promise((resolve, reject) => {
    http
      .get(`http://${host}:${port}${path}`, (res) => {
        let data = ''
        res.on('data', (chunk) => { data += chunk })
        res.on('end', () => {
          try {
            const body = JSON.parse(data)
            resolve(res.statusCode === 200 && body.db !== false)
          } catch {
            resolve(res.statusCode === 200)
          }
        })
      })
      .on('error', reject)
  })
}

async function main() {
  try {
    const ok = await checkBackend()
    if (ok) {
      console.log(`Backend ready at http://${host}:${port}`)
      return
    }
  } catch {
    // fall through
  }

  console.error(`
Integration / E2E tests need the API server running on port ${port}.

  Terminal 1 — database (if not already up):
    docker compose up -d db

  Terminal 2 — backend:
    npm run dev:backend

  Then re-run your test command.
`)
  process.exit(1)
}

if (require.main === module) {
  main()
}

module.exports = { checkBackend }
