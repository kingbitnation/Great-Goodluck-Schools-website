#!/usr/bin/env node
/**
 * Run daily database backups. Schedule via cron or Task Scheduler:
 *   0 2 * * * cd /app && node scripts/schedule-backup.js
 */
const { spawnSync } = require('child_process')
const path = require('path')

const RETAIN_DAYS = Number(process.env.BACKUP_RETAIN_DAYS || 30)

function pruneOldBackups() {
  const fs = require('fs')
  const backupsDir = path.join(__dirname, '..', 'backups')
  if (!fs.existsSync(backupsDir)) return
  const cutoff = Date.now() - RETAIN_DAYS * 24 * 60 * 60 * 1000
  for (const file of fs.readdirSync(backupsDir)) {
    if (!file.endsWith('.sql')) continue
    const full = path.join(backupsDir, file)
    const stat = fs.statSync(full)
    if (stat.mtimeMs < cutoff) {
      fs.unlinkSync(full)
      console.log(`[backup] pruned old backup: ${file}`)
    }
  }
}

console.log(`[backup] starting scheduled backup at ${new Date().toISOString()}`)
const result = spawnSync(process.execPath, [path.join(__dirname, 'backup-db.js')], {
  stdio: 'inherit',
  cwd: path.join(__dirname, '..'),
})

if (result.status !== 0) {
  console.error('[backup] backup failed')
  process.exit(result.status || 1)
}

pruneOldBackups()
console.log('[backup] completed successfully')
