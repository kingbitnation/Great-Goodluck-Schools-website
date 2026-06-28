const { test, expect } = require('@playwright/test')

const API = process.env.API_URL || process.env.E2E_API_URL || 'http://localhost:4000'

test.describe('API smoke', () => {
  test('health live', async ({ request }) => {
    const res = await request.get(`${API}/api/health/live`)
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    expect(body.status).toBe('ok')
  })

  test('health ready', async ({ request }) => {
    const res = await request.get(`${API}/api/health/ready`)
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    expect(body.status).toBe('ready')
  })

  test('openapi spec served', async ({ request }) => {
    const res = await request.get(`${API}/api/docs/openapi.yaml`)
    expect(res.ok()).toBeTruthy()
    const text = await res.text()
    expect(text).toContain('openapi:')
    expect(text).toContain('SchoolPilot')
  })

  test('public home', async ({ request }) => {
    const res = await request.get(`${API}/api/public/home`)
    expect(res.ok()).toBeTruthy()
  })

  test('login returns token', async ({ request }) => {
    const res = await request.post(`${API}/api/auth/login`, {
      data: { email: 'admin@example.com', password: 'admin123' },
    })
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    expect(body.accessToken).toBeTruthy()
  })

  test('platform metrics requires auth', async ({ request }) => {
    const res = await request.get(`${API}/api/platform/metrics`)
    expect(res.status()).toBe(401)
  })

  test('platform metrics for super admin', async ({ request }) => {
    const login = await request.post(`${API}/api/auth/login`, {
      data: { email: 'admin@example.com', password: 'admin123' },
    })
    const { accessToken } = await login.json()
    const res = await request.get(`${API}/api/platform/metrics`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    expect(body.schools).toBeDefined()
    expect(body.revenue).toBeDefined()
  })
})
