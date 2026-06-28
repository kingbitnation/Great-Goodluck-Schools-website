const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')

function collectTests(dir) {
  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith('.test.js'))
    .map((name) => path.join(dir, name))
}

const targetDir = process.argv[2] || path.join(__dirname, 'unit')
const files = collectTests(targetDir)

if (!files.length) {
  console.error(`No test files found in ${targetDir}`)
  process.exit(1)
}

const result = spawnSync(process.execPath, ['--test', ...files], {
  stdio: 'inherit',
  env: process.env,
})

process.exit(result.status ?? 1)
