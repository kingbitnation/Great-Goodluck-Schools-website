require('dotenv').config()
const { Client } = require('pg')

async function run() {
  const client = new Client({ connectionString: process.env.DATABASE_URL })
  await client.connect()
  await client.query('ALTER TABLE "_prisma_migrations" ADD COLUMN IF NOT EXISTS rolled_back_at timestamp')
  const res = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name = '_prisma_migrations'")
  console.log(res.rows.map(r => r.column_name))
  await client.end()
}

run().catch(e => { console.error(e); process.exit(1) })
