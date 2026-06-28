#!/usr/bin/env node
/**
 * Run full production validation pipeline in order:
 *   deploy:preflight → deploy:prod → test:e2e:staging → lighthouse
 *
 * Usage:
 *   npm run deploy:pipeline
 *   npm run deploy:pipeline -- --skip-docker    # native stack (db must already run)
 *   npm run deploy:pipeline -- --native         # start backend+frontend without Docker
 */
const { spawnSync } = require('child_process')
const path = require('path')

const root = path.join(__dirname, '..')
const args = process.argv.slice(2)
const skipDocker = args.includes('--skip-docker')
const native = args.includes('--native') || skipDocker

function run(label, cmd, extraEnv = {}) {
  console.log(`\n${'='.repeat(50)}\n▶ ${label}\n${'='.repeat(50)}\n`)
  const result = spawnSync(cmd, {
    stdio: 'inherit',
    shell: true,
    cwd: root,
    env: { ...process.env, ...extraEnv },
  })
  if (result.status !== 0) {
    console.error(`\n✗ ${label} failed (exit ${result.status})`)
    process.exit(result.status || 1)
  }
  console.log(`\n✓ ${label} passed`)
}

run('1/4 deploy:preflight', 'npm run deploy:preflight')

if (native) {
  run('2/4 db:setup', 'npm run db:setup')
  console.log('\nStart backend and frontend in separate terminals, then re-run with --skip-docker after they are up.')
  console.log('  npm run dev:backend')
  console.log('  npm run dev:frontend')
  run('2b/4 wait-for-backend', 'node scripts/wait-for-backend.js')
} else {
  run('2/4 deploy:prod', 'npm run deploy:prod')
  console.log('\nWaiting 30s for containers to become healthy...')
  spawnSync('node', ['-e', 'setTimeout(()=>{},30000)'], { shell: true, cwd: root, stdio: 'inherit' })
  run('2b/4 health check', 'node scripts/health-monitor.js')
}

run('3/4 test:e2e:staging', 'npm run test:e2e:staging', {
  STAGING_API_URL: process.env.STAGING_API_URL || 'http://localhost:4000',
  STAGING_BASE_URL: process.env.STAGING_BASE_URL || 'http://localhost:3000',
})

run('4/4 lighthouse', 'npm run lighthouse', {
  BASE_URL: process.env.BASE_URL || process.env.STAGING_BASE_URL || 'http://localhost:3000',
})

console.log('\n' + '='.repeat(50))
console.log('Pipeline complete.')
console.log('='.repeat(50))
