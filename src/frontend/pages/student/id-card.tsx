import { withAuth } from '../../components/withAuth'
import AppLayout from '../../components/layout/AppLayout'
import { MyIdCardView } from '../../components/idcard/MyIdCardView'
import type { AuthUser } from '../../lib/useAuth'

function StudentIdCardPage({ user }: { user: AuthUser }) {
  return (
    <AppLayout user={user} title="My ID Card">
      <div className="p-8 max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Digital ID Card</h1>
        <p className="text-gray-600 mb-8">Your official student identity card with QR verification.</p>
        <MyIdCardView />
      </div>
    </AppLayout>
  )
}

export default withAuth(StudentIdCardPage, { roles: ['Student'] })
