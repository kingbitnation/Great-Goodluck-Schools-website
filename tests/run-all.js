const { spawnSync } = require('child_process')

function run(label, command, args) {
  console.log(`\n=== ${label} ===\n`)
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })
  if (result.status !== 0) {
    process.exit(result.status || 1)
  }
}

run('Unit tests', 'node', ['tests/run-node-tests.js', 'tests/unit'])

console.log('\n=== Checking backend ===\n')
const backendCheck = spawnSync('node', ['tests/require-backend.js'], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
})
if (backendCheck.status !== 0) {
  process.exit(backendCheck.status || 1)
}

run('Integration tests', 'node', ['tests/run-node-tests.js', 'tests/integration'])

console.log('\nAll tests passed.\n')
