import type { ComponentType } from 'react'
import { useAuth } from '../lib/useAuth'

type WithAuthOptions = {
  roles?: string[]
  redirectTo?: string
}

export function withAuth<P extends object>(
  Wrapped: ComponentType<P & { user: NonNullable<ReturnType<typeof useAuth>['user']> }>,
  options: WithAuthOptions = {}
) {
  return function AuthenticatedPage(props: P) {
    const { user, loading } = useAuth(options)

    if (loading || !user) {
      return (
        <div style={{ padding: 24 }}>
          <p>Loading...</p>
        </div>
      )
    }

    return <Wrapped {...props} user={user} />
  }
}
