const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const { request, login } = require('../helpers/http')

describe('Health endpoints', () => {
  it('GET /api/health returns ok with database', async () => {
    const res = await request('GET', '/api/health')
    assert.equal(res.status, 200)
    assert.equal(res.body.db, true)
    assert.equal(res.body.status, 'ok')
    assert.ok(res.body.version)
  })

  it('GET /api/health/live returns liveness', async () => {
    const res = await request('GET', '/api/health/live')
    assert.equal(res.status, 200)
    assert.equal(res.body.backend, 'running')
  })

  it('GET /api/health/ready returns readiness', async () => {
    const res = await request('GET', '/api/health/ready')
    assert.equal(res.status, 200)
    assert.equal(res.body.db, true)
  })
})

describe('Authentication', () => {
  it('rejects invalid credentials', async () => {
    const res = await request('POST', '/api/auth/login', {
      email: 'student@demoschool.edu',
      password: 'wrong-password',
    })
    assert.ok(res.status === 401 || res.status === 400)
  })

  it('logs in demo student', async () => {
    const session = await login('student@demoschool.edu', 'admin123')
    assert.equal(session.user.role, 'Student')
  })

  it('logs in demo admin', async () => {
    const session = await login('admin@example.com', 'admin123')
    assert.ok(['SchoolAdmin', 'SuperAdmin'].includes(session.user.role))
  })
})

describe('Student portal APIs', () => {
  it('student can access core routes', async () => {
    const { authHeader } = await login('student@demoschool.edu', 'admin123')
    const routes = [
      '/api/students',
      '/api/hostel/my-allocation',
      '/api/transport/my-allocation',
      '/api/lms/courses',
      '/api/live-classes',
      '/api/cbt/available-exams',
      '/api/notifications',
      '/api/marketplace/products',
    ]

    for (const path of routes) {
      const res = await request('GET', path, null, authHeader)
      assert.ok(res.status < 400, `${path} returned ${res.status}`)
    }

    const library = await request('GET', '/api/library/books', null, authHeader)
    assert.ok(
      library.status === 200 || (library.status === 403 && library.body?.code === 'FEATURE_NOT_AVAILABLE'),
      `/api/library/books returned ${library.status}`
    )
  })
})

describe('Parent portal APIs', () => {
  it('parent can list children', async () => {
    const { authHeader } = await login('parent@demoschool.edu', 'admin123')
    const res = await request('GET', '/api/parents/children', null, authHeader)
    assert.equal(res.status, 200)
    assert.ok(Array.isArray(res.body))
  })
})

describe('Notifications', () => {
  it('student can load preferences and notifications', async () => {
    const { authHeader } = await login('student@demoschool.edu', 'admin123')
    const prefs = await request('GET', '/api/notifications/preferences', null, authHeader)
    assert.equal(prefs.status, 200)
    assert.equal(typeof prefs.body.email, 'boolean')

    const list = await request('GET', '/api/notifications', null, authHeader)
    assert.equal(list.status, 200)
    assert.ok(Array.isArray(list.body))
  })

  it('student can mark all notifications read', async () => {
    const { authHeader } = await login('student@demoschool.edu', 'admin123')
    const res = await request('PUT', '/api/notifications/read-all', {}, authHeader)
    assert.equal(res.status, 200)
    assert.ok(typeof res.body.updated === 'number')
  })
})

describe('Public website APIs', () => {
  it('GET /api/public/home returns CMS payload', async () => {
    const res = await request('GET', '/api/public/home')
    assert.equal(res.status, 200)
    assert.ok(res.body.school || res.body.stats)
  })

  it('certificate verification works for demo cert', async () => {
    const res = await request('GET', '/api/public/certificates/verify/demo-lms-verify-2026')
    assert.equal(res.status, 200)
    assert.equal(res.body.valid, true)
  })
})

describe('Admin analytics', () => {
  it('school admin can load dashboard analytics', async () => {
    const { authHeader } = await login('admin@example.com', 'admin123')
    const res = await request('GET', '/api/analytics/dashboard', null, authHeader)
    assert.equal(res.status, 200)
  })
})

describe('Teacher APIs', () => {
  it('teacher can load analytics and notifications', async () => {
    const { authHeader } = await login('teacher@demoschool.edu', 'admin123')
    const analytics = await request('GET', '/api/analytics/teacher', null, authHeader)
    assert.equal(analytics.status, 200)

    const notifications = await request('GET', '/api/notifications', null, authHeader)
    assert.equal(notifications.status, 200)
  })
})
