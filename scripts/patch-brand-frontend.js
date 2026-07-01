const fs = require('fs')
const path = require('path')
const root = path.join(__dirname, '..')

function replaceIn(file, pairs) {
  const fp = path.join(root, file)
  if (!fs.existsSync(fp)) return
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

const authTs = `import { apiBaseUrl } from './apiBase'
import { getStoredToken, setStoredToken, clearStoredToken } from './storageKeys'

export function saveToken(token: string) {
  setStoredToken(token)
}

export function getToken(): string | null {
  return getStoredToken()
}

export function clearToken() {
  clearStoredToken()
}

let refreshPromise: Promise<string | null> | null = null

async function tryRefresh(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = fetch(\`\${apiBaseUrl()}/api/auth/refresh\`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    })
      .then(async (res) => {
        if (!res.ok) return null
        const data = await res.json()
        if (data?.accessToken) {
          saveToken(data.accessToken)
          return data.accessToken as string
        }
        return null
      })
      .finally(() => {
        refreshPromise = null
      })
  }
  return refreshPromise
}

export async function fetchWithAuth(path: string, options: RequestInit = {}) {
  let token = getToken()
  const headers = new Headers(options.headers || {})
  if (token) headers.set('Authorization', \`Bearer \${token}\`)
  const base = apiBaseUrl()

  let res = await fetch(\`\${base}\${path}\`, {
    ...options,
    headers,
    credentials: 'include',
  })

  if (res.status === 401) {
    token = await tryRefresh()
    if (token) {
      headers.set('Authorization', \`Bearer \${token}\`)
      res = await fetch(\`\${base}\${path}\`, {
        ...options,
        headers,
        credentials: 'include',
      })
    }
  }

  return res
}

export async function logout() {
  try {
    await fetch(\`\${apiBaseUrl()}/api/auth/logout\`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    })
  } finally {
    clearToken()
  }
}
`
fs.writeFileSync(path.join(root, 'src/frontend/lib/auth.ts'), authTs)
console.log('Updated src/frontend/lib/auth.ts')

replaceIn('src/frontend/components/ThemeProvider.tsx', [
  ["const STORAGE_KEY = 'sms_theme'", "import { getStoredTheme, setStoredTheme } from '../lib/storageKeys'"],
  ['const saved = localStorage.getItem(STORAGE_KEY) as Theme | null', 'const saved = getStoredTheme() as Theme | null'],
  ['localStorage.setItem(STORAGE_KEY, theme)', 'setStoredTheme(theme)'],
])

replaceIn('src/frontend/pages/_document.tsx', [
  ["var stored = localStorage.getItem('sms_theme');", "var stored = localStorage.getItem('sp_theme') || localStorage.getItem('sms_theme');"],
])

replaceIn('src/frontend/pages/admin/students.tsx', [
  ["localStorage.getItem('sms_token')", "localStorage.getItem('sp_token') || localStorage.getItem('sms_token')"],
])

replaceIn('src/frontend/components/fees/FeesPortal.tsx', [
  ["localStorage.getItem('sms_token')", "localStorage.getItem('sp_token') || localStorage.getItem('sms_token')"],
])

replaceIn('src/frontend/components/shop/ShopPortal.tsx', [
  ["localStorage.getItem('sms_token')", "localStorage.getItem('sp_token') || localStorage.getItem('sms_token')"],
])

replaceIn('e2e/ui.spec.js', [
  ["localStorage.setItem('sms_token', token)", "localStorage.setItem('sp_token', token)"],
])

replaceIn('package.json', [
  ['"name": "school-management-system"', '"name": "schoolpilot"'],
])

replaceIn('src/frontend/package.json', [
  ['"name": "sms-frontend"', '"name": "schoolpilot-frontend"'],
])

replaceIn('docs/VERCEL.md', [
  ['cd C:\\Users\\HP\\Documents\\coggc\\src\\frontend', 'cd src/frontend'],
])

console.log('Frontend brand patch complete.')
