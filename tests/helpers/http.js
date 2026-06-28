const http = require('http')

const BASE_HOST = process.env.TEST_API_HOST || 'localhost'
const BASE_PORT = Number(process.env.TEST_API_PORT || process.env.PORT || 4000)

function request(method, path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null
    const req = http.request(
      {
        hostname: BASE_HOST,
        port: BASE_PORT,
        path,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
          ...headers,
        },
      },
      (res) => {
        let raw = ''
        res.on('data', (chunk) => (raw += chunk))
        res.on('end', () => {
          let parsed = raw
          try {
            parsed = raw ? JSON.parse(raw) : null
          } catch {
            parsed = raw
          }
          resolve({ status: res.statusCode, body: parsed, headers: res.headers })
        })
      }
    )
    req.on('error', reject)
    if (data) req.write(data)
    req.end()
  })
}

async function login(email, password) {
  const res = await request('POST', '/api/auth/login', { email, password })
  if (res.status !== 200 || !res.body?.accessToken) {
    throw new Error(`Login failed for ${email}: ${res.status} ${JSON.stringify(res.body)}`)
  }
  return {
    token: res.body.accessToken,
    user: res.body.user,
    authHeader: { Authorization: `Bearer ${res.body.accessToken}` },
  }
}

module.exports = { request, login, BASE_HOST, BASE_PORT }
