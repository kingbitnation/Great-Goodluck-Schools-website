import { withAuth } from '../../../components/withAuth'
import { ShopCatalog, ShopLayout } from '../../../components/shop/ShopPortal'
import type { AuthUser } from '../../../lib/useAuth'

function ParentShopPage({ user }: { user: AuthUser }) {
  return (
    <ShopLayout user={user} basePath="/parent/shop">
      <ShopCatalog user={user} basePath="/parent/shop" />
    </ShopLayout>
  )
}

export default withAuth(ParentShopPage, { roles: ['Parent'] })
