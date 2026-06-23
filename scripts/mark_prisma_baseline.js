require('dotenv').config()
const { Client } = require('pg')

async function run() {
  const client = new Client({ connectionString: process.env.DATABASE_URL })
  await client.connect()
  await client.query(`CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
    id text PRIMARY KEY,
    checksum text NOT NULL,
    finished_at timestamp,
    migration_name text NOT NULL,
    logs text,
    rolled_back boolean,
    started_at timestamp NOT NULL,
    applied_steps_count integer NOT NULL
  );`)

  await client.query(`INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, logs, rolled_back, started_at, applied_steps_count)
    VALUES ($1, $2, NOW(), $3, '', false, NOW(), 0)
    ON CONFLICT (id) DO NOTHING;`, ['20260622_init', 'baseline', '20260622_init'])

  const res = await client.query('SELECT id, migration_name, applied_steps_count, started_at FROM "_prisma_migrations"')
  console.log(res.rows)
  await client.end()
}

run().catch((e) => { console.error(e); process.exit(1) })
