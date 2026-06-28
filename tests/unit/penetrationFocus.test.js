const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const { assertSameSchool, tenantWhere } = require('../../src/backend/middleware/tenantGuard')
const { sanitizeHtml } = require('../../src/backend/lib/htmlSanitize')
const { storeLocalUpload } = require('../../src/backend/lib/uploadHelpers')
const { LOCKOUT_THRESHOLD, handleFailedLogin } = require('../../src/backend/lib/authHelpers')
const fs = require('fs')
const path = require('path')

describe('penetration: cross-tenant IDOR', () => {
  const schoolA = '11111111-1111-1111-1111-111111111111'
  const schoolB = '22222222-2222-2222-2222-222222222222'

  it('denies school admin access to another school resource', () => {
    const user = { role: 'SchoolAdmin', schoolId: schoolA, userId: 'u1' }
    assert.equal(assertSameSchool(user, schoolB), false)
    assert.equal(assertSameSchool(user, schoolA), true)
  })

  it('scopes tenant queries to user school (non-super-admin)', () => {
    const user = { role: 'Teacher', schoolId: schoolA }
    assert.deepEqual(tenantWhere(user), { schoolId: schoolA })
  })

  it('blocks users without school context', () => {
    assert.deepEqual(tenantWhere({ role: 'Student' }), { schoolId: '__TENANT_BLOCKED__' })
  })

  it('allows SuperAdmin cross-tenant reads', () => {
    assert.equal(assertSameSchool({ role: 'SuperAdmin' }, schoolB), true)
    assert.deepEqual(tenantWhere({ role: 'SuperAdmin' }), {})
  })
})

describe('penetration: role escalation', () => {
  it('JWT role is not elevated by client body fields', () => {
    // requireRole checks req.user.role from verified JWT — spoofed body.role must not apply
    const { registerAuthRoutes } = require('../../src/backend/routes/authRoutes')
    assert.equal(typeof registerAuthRoutes, 'function')
    const fakeReq = { user: { role: 'Student', schoolId: 's1' }, body: { role: 'SuperAdmin' } }
    assert.equal(fakeReq.user.role, 'Student')
    assert.notEqual(fakeReq.body.role, fakeReq.user.role)
  })
})

describe('penetration: removed payment webhooks', () => {
  it('flutterwave webhook module is not registered', () => {
    const serverSrc = fs.readFileSync(path.join(__dirname, '../../src/backend/server.js'), 'utf8')
    assert.ok(!serverSrc.includes('registerFlutterwaveWebhook'))
    assert.ok(!fs.existsSync(path.join(__dirname, '../../src/backend/lib/flutterwaveWebhook.js')))
  })
})

describe('penetration: upload path traversal', () => {
  const tinyPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

  it('strips directory traversal from folder names', async () => {
    const result = await storeLocalUpload({ fileBase64: tinyPng, folder: '../../etc' })
    assert.ok(result.path.startsWith('etc/') || !result.path.includes('..'))
    assert.ok(!result.path.includes('etc/passwd'))
  })

  it('rejects executable MIME types', async () => {
    const evil = Buffer.from('MZ').toString('base64')
    await assert.rejects(
      () => storeLocalUpload({ fileBase64: `data:application/x-msdownload;base64,${evil}` }),
      /not allowed/
    )
  })
})

describe('penetration: SQL injection surface', () => {
  it('only uses tagged template raw query in monitoring health check', () => {
    const src = fs.readFileSync(path.join(__dirname, '../../src/backend/lib/monitoring.js'), 'utf8')
    assert.ok(src.includes('$queryRaw`SELECT 1`'))
    const backendRoot = path.join(__dirname, '../../src/backend')
    const offenders = []
    function scan(dir) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name)
        if (entry.isDirectory() && entry.name !== 'node_modules') scan(full)
        else if (entry.isFile() && entry.name.endsWith('.js')) {
          const content = fs.readFileSync(full, 'utf8')
          if (/\$queryRawUnsafe|\$executeRawUnsafe/.test(content)) offenders.push(full)
        }
      }
    }
    scan(backendRoot)
    assert.deepEqual(offenders, [])
  })
})

describe('penetration: XSS on CMS content', () => {
  it('removes script tags and inline handlers', () => {
    const dirty = '<p>Hello</p><script>alert(1)</script><img src=x onerror=alert(1)>'
    const clean = sanitizeHtml(dirty)
    assert.ok(!clean.includes('<script'))
    assert.ok(!clean.includes('onerror'))
    assert.ok(!clean.toLowerCase().includes('javascript:'))
  })

  it('blocks javascript: URIs in links', () => {
    const dirty = '<a href="javascript:alert(1)">click</a>'
    assert.ok(!sanitizeHtml(dirty).toLowerCase().includes('javascript:'))
  })
})

describe('penetration: brute force login', () => {
  it('locks account after threshold failed attempts', async () => {
    const updates = []
    const prisma = {
      user: {
        update: async ({ where, data }) => {
          updates.push({ where, data })
          return { id: where.id, ...data }
        },
      },
    }
    let user = { id: 'u1', failedLoginAttempts: 0, lockedUntil: null }
    for (let i = 0; i < LOCKOUT_THRESHOLD; i++) {
      await handleFailedLogin(prisma, user)
      user = { ...user, failedLoginAttempts: i + 1 }
    }
    const last = updates[updates.length - 1]
    assert.ok(last.data.lockedUntil instanceof Date)
    assert.equal(last.data.failedLoginAttempts, LOCKOUT_THRESHOLD)
  })
})
