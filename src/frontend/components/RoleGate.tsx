import type { ReactNode } from 'react'
import { hasRole, type AuthUser } from '../lib/useAuth'

type RoleGateProps = {
  user: AuthUser | null
  roles: string[]
  children: ReactNode
  fallback?: ReactNode
}

export function RoleGate({ user, roles, children, fallback = null }: RoleGateProps) {
  if (!hasRole(user, ...roles)) return <>{fallback}</>
  return <>{children}</>
}
