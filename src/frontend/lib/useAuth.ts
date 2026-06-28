import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { fetchWithAuth, getToken } from './auth'

export type AuthUser = {
  id: string
  email?: string
  firstName?: string
  lastName?: string
  role: string
  schoolId?: string | null
  schoolName?: string | null
  emailVerified?: boolean
  twoFactorEnabled?: boolean
}

type UseAuthOptions = {
  redirectTo?: string
  roles?: string[]
}

export function useAuth(options: UseAuthOptions = {}) {
  const { redirectTo = '/login', roles } = options
  const router = useRouter()
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = getToken()
    if (!token) {
      router.replace(redirectTo)
      return
    }

    fetchWithAuth('/api/auth/me')
      .then(async (res) => {
        if (!res.ok) throw new Error('Unauthorized')
        const data = await res.json()
        const nextUser = (data.user || data) as AuthUser
        if (roles?.length && !roles.includes(nextUser.role) && nextUser.role !== 'SuperAdmin') {
          router.replace('/dashboard')
          return
        }
        setUser(nextUser)
      })
      .catch(() => router.replace(redirectTo))
      .finally(() => setLoading(false))
  }, [router, redirectTo, roles])

  return { user, loading }
}

export function hasRole(user: AuthUser | null, ...roles: string[]) {
  if (!user) return false
  if (user.role === 'SuperAdmin') return true
  return roles.includes(user.role)
}
