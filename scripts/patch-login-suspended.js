const fs = require('fs')
const path = require('path')
const loginPath = path.join(__dirname, '../src/frontend/pages/login.tsx')
let login = fs.readFileSync(loginPath, 'utf8')

if (!login.includes('router.query.suspended')) {
  login = login.replace(
    `  const router = useRouter()

  async function completeLogin`,
    `  const router = useRouter()

  useEffect(() => {
    if (router.query.suspended === '1') {
      const code = String(router.query.code || '')
      const messages: Record<string, string> = {
        SCHOOL_SUSPENDED: 'This school account has been suspended. Contact SchoolPilot support.',
        SUBSCRIPTION_EXPIRED: 'Your subscription has expired. Renew billing to restore access.',
        TRIAL_EXPIRED: 'Your free trial has ended. Subscribe to continue using SchoolPilot.',
        SUBSCRIPTION_CANCELLED: 'This subscription was cancelled.',
      }
      setError(messages[code] || 'School access is currently blocked.')
    }
  }, [router.query.suspended, router.query.code])

  async function completeLogin`
  )
}

if (!login.includes("body.code && blocked.includes")) {
  login = login.replace(
    `        message?: string
      }>(res)
      if (!res.ok) throw new Error(body?.error || body?.message || 'Login failed')`,
    `        message?: string
        code?: string
      }>(res)
      if (!res.ok) {
        const blocked = ['SCHOOL_SUSPENDED', 'SUBSCRIPTION_EXPIRED', 'TRIAL_EXPIRED', 'SUBSCRIPTION_CANCELLED']
        if (res.status === 403 && body.code && blocked.includes(body.code)) {
          throw new Error(body.error || 'School access is blocked')
        }
        throw new Error(body?.error || body?.message || 'Login failed')
      }`
  )
}

fs.writeFileSync(loginPath, login)
console.log('login.tsx patched')
