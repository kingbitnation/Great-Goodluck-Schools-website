const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')

function latestBackup() {
  const backupsDir = path.join(__dirname, '..', 'backups')
  if (!fs.existsSync(backupsDir)) return null
  const files = fs
    .readdirSync(backupsDir)
    .filter((f) => f.endsWith('.sql'))
    .map((f) => ({ name: f, mtime: fs.statSync(path.join(backupsDir, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime)
  return files[0] ? path.join(backupsDir, files[0].name) : null
}

function restoreViaDocker(file) {
  const sql = fs.readFileSync(file)
  const result = spawnSync('docker', ['compose', 'exec', '-T', 'db', 'psql', '-U', 'postgres', 'schooldb'], {
    input: sql,
    cwd: path.join(__dirname, '..'),
  })
  if (result.status !== 0) {
    throw new Error(result.stderr?.toString() || 'docker compose psql restore failed')
  }
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

function restoreLocal(file, url) {
  const cfg = parseDatabaseUrl(url)
  const sql = fs.readFileSync(file)
  const result = spawnSync(
    'psql',
    ['-h', cfg.host, '-p', cfg.port, '-U', cfg.user, cfg.database],
    {
      input: sql,
      env: { ...process.env, PGPASSWORD: cfg.password },
    }
  )
  if (result.status !== 0) {
    throw new Error(result.stderr?.toString() || 'psql restore failed')
  }
}

function main() {
  require('dotenv').config()

  const argFile = process.argv.find((a) => a.endsWith('.sql'))
  const file = argFile || latestBackup()
  if (!file || !fs.existsSync(file)) {
    console.error('No backup file found. Run npm run backup:db first or pass a .sql path.')
    process.exit(1)
  }

  console.log(`Restoring from ${file}...`)
  const useDocker = process.argv.includes('--docker') || process.env.BACKUP_VIA_DOCKER === 'true'

  try {
    if (useDocker) restoreViaDocker(file)
    else restoreLocal(file, process.env.DATABASE_URL)
  } catch (localErr) {
    if (!useDocker) {
      try {
        restoreViaDocker(file)
      } catch {
        throw localErr
      }
    } else {
      throw localErr
    }
  }

  console.log('Restore completed')
}

main()
