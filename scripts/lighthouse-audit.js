#!/usr/bin/env node
/**
 * Lighthouse audit for / and /login (target score 95+).
 * Usage:
 *   npm run dev:frontend & npm run dev:backend &
 *   npm run lighthouse
 *   BASE_URL=https://staging.schoolpilot.ng npm run lighthouse
 */
const { spawnSync } = require('child_process')
const path = require('path')

const BASE = process.env.BASE_URL || process.env.LIGHTHOUSE_BASE_URL || 'http://localhost:3000'
const TARGET = Number(process.env.LIGHTHOUSE_TARGET || 95)
const outDir = path.join(__dirname, '..', 'reports', 'lighthouse')

const pages = [
  { name: 'home', url: `${BASE}/` },
  { name: 'login', url: `${BASE}/login` },
]

function runLighthouse(url, name) {
  const out = path.join(outDir, name)
  const args = [
    url,
    '--output=json',
    '--output=html',
    `--output-path=${out}`,
    '--chrome-flags=--headless --no-sandbox',
    '--only-categories=performance,accessibility,best-practices,seo',
    '--quiet',
  ]
  const result = spawnSync('npx', ['lighthouse', ...args], {
    stdio: 'inherit',
    shell: true,
    cwd: path.join(__dirname, '..'),
  })
  return result.status === 0 ? out + '.report.json' : null
}

function readScores(jsonPath) {
  const fs = require('fs')
  const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'))
  const c = data.categories || {}
  return {
    performance: Math.round((c.performance?.score || 0) * 100),
    accessibility: Math.round((c.accessibility?.score || 0) * 100),
    bestPractices: Math.round((c['best-practices']?.score || 0) * 100),
    seo: Math.round((c.seo?.score || 0) * 100),
  }
}

const fs = require('fs')
fs.mkdirSync(outDir, { recursive: true })

console.log(`\nLighthouse audit — base ${BASE} (target ${TARGET}+)\n`)
let failed = false

for (const page of pages) {
  console.log(`Auditing ${page.name}: ${page.url}`)
  const jsonPath = runLighthouse(page.url, page.name)
  if (!jsonPath || !fs.existsSync(jsonPath)) {
    console.error(`  Failed to audit ${page.name}`)
    failed = true
    continue
  }
  const scores = readScores(jsonPath)
  const min = Math.min(scores.performance, scores.accessibility, scores.bestPractices, scores.seo)
  const pass = min >= TARGET
  console.log(`  performance=${scores.performance} a11y=${scores.accessibility} best-practices=${scores.bestPractices} seo=${scores.seo} ${pass ? 'PASS' : 'BELOW TARGET'}`)
  if (!pass) failed = true
}

console.log(`\nReports saved to ${outDir}/`)
process.exit(failed ? 1 : 0)
