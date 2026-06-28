const { test, expect } = require('@playwright/test')

test.describe('Public UI', () => {
  test('home page loads', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/SchoolPilot/i)
    await expect(page.getByRole('link', { name: /apply/i }).first()).toBeVisible()
  })

  test('login page is accessible', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByRole('heading', { name: /portal login/i })).toBeVisible()
    await expect(page.getByLabel(/email address/i)).toBeVisible()
    await expect(page.getByLabel(/^password$/i)).toBeVisible()
  })

  test('skip link focuses main content', async ({ page }) => {
    await page.goto('/login')
    await page.keyboard.press('Tab')
    const skip = page.getByRole('link', { name: /skip to/i })
    await expect(skip).toBeFocused()
  })
})

test.describe('Authenticated UI', () => {
  test('admin can reach dashboard', async ({ page }) => {
    const api = process.env.API_URL || 'http://localhost:4000'
    const loginRes = await page.request.post(`${api}/api/auth/login`, {
      data: { email: 'admin@example.com', password: 'admin123' },
    })
    const { accessToken } = await loginRes.json()
    await page.addInitScript((token) => {
      localStorage.setItem('sms_token', token)
    }, accessToken)
    await page.goto('/dashboard')
    await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible({ timeout: 15_000 })
  })
})
