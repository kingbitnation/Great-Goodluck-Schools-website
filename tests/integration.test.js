const { request, login } = require('./helpers/http')

async function main() {
  const health = await request('GET', '/api/health')
  if (health.status !== 200 || !health.body?.db) {
    console.error('Health check failed', health)
    process.exit(1)
  }
  console.log('✓ Health OK')

  const loginRes = await request('POST', '/api/auth/login', {
    email: 'student@demoschool.edu',
    password: 'admin123',
  })
  if (loginRes.status !== 200 || !loginRes.body?.accessToken) {
    console.error('Login failed', loginRes)
    process.exit(1)
  }
  console.log('✓ Student login OK')

  const token = loginRes.body.accessToken
  const auth = { Authorization: `Bearer ${token}` }

  const routes = [
    ['GET', '/api/students'],
    ['GET', '/api/hostel/my-allocation'],
    ['GET', '/api/transport/my-allocation'],
    ['GET', '/api/lms/courses'],
    ['GET', '/api/live-classes'],
    ['GET', '/api/cbt/available-exams'],
  ]

  for (const [method, path] of routes) {
    const res = await request(method, path, null, auth)
    if (res.status >= 400) {
      console.error(`✗ ${method} ${path}`, res)
      process.exit(1)
    }
    console.log(`✓ ${method} ${path}`)
  }

  const library = await request('GET', '/api/library/books', null, auth)
  if (library.status === 200) {
    console.log('✓ GET /api/library/books')
  } else if (library.status === 403 && library.body?.code === 'FEATURE_NOT_AVAILABLE') {
    console.log('✓ GET /api/library/books (plan-gated)')
  } else {
    console.error('✗ GET /api/library/books', library)
    process.exit(1)
  }

  const parentLogin = await request('POST', '/api/auth/login', {
    email: 'parent@demoschool.edu',
    password: 'admin123',
  })
  const parentToken = parentLogin.body?.accessToken
  if (!parentToken) {
    console.error('Parent login failed')
    process.exit(1)
  }
  const parentFees = await request('GET', '/api/parents/children', null, {
    Authorization: `Bearer ${parentToken}`,
  })
  if (parentFees.status !== 200) {
    console.error('Parent children failed', parentFees)
    process.exit(1)
  }
  console.log('✓ Parent portal OK')

  const certVerify = await request('GET', '/api/public/certificates/verify/demo-lms-verify-2026')
  if (certVerify.status !== 200 || !certVerify.body?.valid) {
    console.error('LMS certificate verify failed', certVerify)
    process.exit(1)
  }
  console.log('✓ LMS certificate verify OK')

  console.log('All integration checks passed')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
