require('dotenv').config()
const { spawnSync } = require('child_process')
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function main() {
  const schools = await prisma.school.count()
  if (schools > 0) {
    console.log('Database already seeded — skipping auto-seed')
    return
  }
  console.log('Empty database detected — running seed...')
  const result = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'prisma:seed'], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })
  if (result.status !== 0) process.exit(result.status || 1)
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
