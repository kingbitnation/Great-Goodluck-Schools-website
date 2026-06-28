import { withAuth } from '../../../components/withAuth'
import { ShopLayout, ShopOrders } from '../../../components/shop/ShopPortal'
import type { AuthUser } from '../../../lib/useAuth'

function StudentShopOrdersPage({ user }: { user: AuthUser }) {
  return (
    <ShopLayout user={user} basePath="/student/shop" title="Orders">
      <ShopOrders basePath="/student/shop" />
    </ShopLayout>
  )
}

export default withAuth(StudentShopOrdersPage, { roles: ['Student'] })
