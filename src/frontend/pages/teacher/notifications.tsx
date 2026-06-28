import { withAuth } from '../../components/withAuth'
import AppLayout from '../../components/layout/AppLayout'
import NotificationsPanel from '../../components/notifications/NotificationsPanel'
import type { AuthUser } from '../../lib/useAuth'

function TeacherNotificationsPage({ user }: { user: AuthUser }) {
  return (
    <AppLayout user={user} title="Notifications">
      <NotificationsPanel user={user} />
    </AppLayout>
  )
}

export default withAuth(TeacherNotificationsPage, { roles: ['Teacher'] })
