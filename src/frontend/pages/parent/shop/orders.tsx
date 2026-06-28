import { withAuth } from '../../../components/withAuth'
import { ShopLayout, ShopOrders } from '../../../components/shop/ShopPortal'
import type { AuthUser } from '../../../lib/useAuth'

function ParentShopOrdersPage({ user }: { user: AuthUser }) {
  return (
    <ShopLayout user={user} basePath="/parent/shop" title="Orders">
      <ShopOrders basePath="/parent/shop" />
    </ShopLayout>
  )
}

export default withAuth(ParentShopOrdersPage, { roles: ['Parent'] })
