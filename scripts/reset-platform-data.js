#!/usr/bin/env node
/**
 * Wipes all schools and platform billing data. Keeps Super Admin, roles, and subscription plans.
 * Usage: node scripts/reset-platform-data.js
 */
const { PrismaClient } = require('@prisma/client')
const { resetPlatformData } = require('../src/backend/lib/schoolDeletion')

async function main() {
  const prisma = new PrismaClient()
  try {
    await resetPlatformData(prisma)
    console.log('Platform data reset complete.')
    console.log('Schools, registrations, and billing metrics are now empty.')
    console.log('Super Admin login: admin@example.com / admin123')
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
