import { withAuth } from '../../../components/withAuth'
import { ShopCatalog, ShopLayout } from '../../../components/shop/ShopPortal'
import type { AuthUser } from '../../../lib/useAuth'

function StudentShopPage({ user }: { user: AuthUser }) {
  return (
    <ShopLayout user={user} basePath="/student/shop">
      <ShopCatalog user={user} basePath="/student/shop" />
    </ShopLayout>
  )
}

export default withAuth(StudentShopPage, { roles: ['Student'] })
