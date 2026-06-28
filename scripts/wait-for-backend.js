const http = require('http')

const port = Number(process.env.PORT || 4000)
const path = process.env.HEALTH_PATH || '/api/health/ready'
const maxAttempts = Number(process.env.BACKEND_WAIT_ATTEMPTS || 30)
const delayMs = Number(process.env.BACKEND_WAIT_DELAY_MS || 2000)

function check() {
  return new Promise((resolve, reject) => {
    http
      .get(`http://127.0.0.1:${port}${path}`, (res) => {
        let data = ''
        res.on('data', (chunk) => (data += chunk))
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(data) })
          } catch {
            resolve({ status: res.statusCode, body: data })
          }
        })
      })
      .on('error', reject)
  })
}

async function main() {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await check()
      if (result.status === 200 && result.body?.db) {
        console.log('Backend is ready')
        return
      }
      console.log(`Waiting for backend (${attempt}/${maxAttempts})... status=${result.status}`)
    } catch {
      console.log(`Waiting for backend (${attempt}/${maxAttempts})...`)
    }
    await new Promise((r) => setTimeout(r, delayMs))
  }
  console.error('Backend did not become ready in time')
  process.exit(1)
}

main()
