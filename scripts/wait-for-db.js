require('dotenv').config()
const { Client } = require('pg')

const url = process.env.DATABASE_URL
if (!url) {
  console.error('DATABASE_URL is not set')
  process.exit(1)
}

const maxAttempts = Number(process.env.DB_WAIT_ATTEMPTS || 30)
const delayMs = Number(process.env.DB_WAIT_DELAY_MS || 2000)

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function waitForDatabase() {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const client = new Client({ connectionString: url })
    try {
      await client.connect()
      await client.query('SELECT 1')
      await client.end()
      console.log('Database is ready')
      return
    } catch (err) {
      await client.end().catch(() => {})
      console.log(`Waiting for database (${attempt}/${maxAttempts})...`)
      if (attempt === maxAttempts) throw err
      await sleep(delayMs)
    }
  }
}

waitForDatabase().catch((err) => {
  console.error('Database not ready:', err.message)
  process.exit(1)
})
