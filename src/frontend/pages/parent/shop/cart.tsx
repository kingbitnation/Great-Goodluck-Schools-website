import { withAuth } from '../../../components/withAuth'
import { ShopCart, ShopLayout } from '../../../components/shop/ShopPortal'
import type { AuthUser } from '../../../lib/useAuth'

function ParentShopCartPage({ user }: { user: AuthUser }) {
  return (
    <ShopLayout user={user} basePath="/parent/shop" title="Cart">
      <ShopCart user={user} basePath="/parent/shop" />
    </ShopLayout>
  )
}

export default withAuth(ParentShopCartPage, { roles: ['Parent'] })
