const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')

const backupsDir = path.join(__dirname, '..', 'backups')
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
const outfile = path.join(backupsDir, `schooldb-${stamp}.sql`)

function runPgDumpViaDocker() {
  const result = spawnSync(
    'docker',
    ['compose', 'exec', '-T', 'db', 'pg_dump', '-U', 'postgres', '--clean', '--if-exists', 'schooldb'],
    { encoding: 'buffer', cwd: path.join(__dirname, '..') }
  )
  if (result.status !== 0) {
    const err = result.stderr?.toString() || 'docker compose pg_dump failed'
    throw new Error(err)
  }
  return result.stdout
}

function parseDatabaseUrl(url) {
  const parsed = new URL(url)
  return {
    host: parsed.hostname,
    port: parsed.port || '5432',
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    database: parsed.pathname.replace(/^\//, ''),
  }
}

function runPgDumpLocal(url) {
  const cfg = parseDatabaseUrl(url)
  const result = spawnSync(
    'pg_dump',
    ['-h', cfg.host, '-p', cfg.port, '-U', cfg.user, '--clean', '--if-exists', cfg.database],
    {
      encoding: 'buffer',
      env: { ...process.env, PGPASSWORD: cfg.password },
    }
  )
  if (result.status !== 0) {
    const err = result.stderr?.toString() || 'pg_dump failed'
    throw new Error(err)
  }
  return result.stdout
}

function main() {
  require('dotenv').config()
  fs.mkdirSync(backupsDir, { recursive: true })

  const useDocker = process.argv.includes('--docker') || process.env.BACKUP_VIA_DOCKER === 'true'
  let dump

  try {
    dump = useDocker ? runPgDumpViaDocker() : runPgDumpLocal(process.env.DATABASE_URL)
  } catch (dockerErr) {
    if (!useDocker && process.env.DATABASE_URL) {
      try {
        dump = runPgDumpViaDocker()
      } catch {
        throw dockerErr
      }
    } else {
      throw dockerErr
    }
  }

  fs.writeFileSync(outfile, dump)
  const sizeKb = Math.round(fs.statSync(outfile).size / 1024)
  console.log(`Backup saved: ${outfile} (${sizeKb} KB)`)
}

main()
