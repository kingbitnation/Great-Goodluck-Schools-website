const fs = require('fs')
const path = require('path')
const root = path.join(__dirname, '..')

function replaceIn(file, pairs) {
  const fp = path.join(root, file)
  let src = fs.readFileSync(fp, 'utf8')
  let changed = false
  for (const [from, to] of pairs) {
    if (src.includes(from)) {
      src = src.split(from).join(to)
      changed = true
    }
  }
  if (changed) {
    fs.writeFileSync(fp, src)
    console.log('Updated', file)
  }
}

replaceIn('src/backend/routes/platformRoutes.js', [
  ['code: `GGS-${slug}`', 'code: `${PLATFORM_PREFIX}-${slug}`'],
])

replaceIn('prisma/seed.ts', [
  ["termiiSenderId: 'GGS'", "termiiSenderId: 'SchoolPilot'"],
])

replaceIn('docs/railway-variables.template', [
  ['SMTP_FROM=\n', 'SMTP_FROM_NAME=SchoolPilot\nSMTP_FROM=SchoolPilot <noreply@yourdomain.com>\n'],
])

replaceIn('scripts/apply-production-fixes.js', [
  [
    "patch('.env.example', [\n  ['SMTP_FROM=\"Great Goodluck Schools <your@gmail.com>\"', 'SMTP_FROM_NAME=SchoolPilot\\nSMTP_FROM=\"SchoolPilot <noreply@yourdomain.com>\"'],\n])",
    "patch('docs/env.example', [\n  ['SMTP_FROM=SchoolPilot <noreply@yourdomain.com>', 'SMTP_FROM_NAME=SchoolPilot\\nSMTP_FROM=SchoolPilot <noreply@yourdomain.com>'],\n])",
  ],
])

console.log('Brand patch complete.')
