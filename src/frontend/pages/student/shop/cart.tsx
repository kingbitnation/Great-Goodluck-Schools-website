import { withAuth } from '../../../components/withAuth'
import { ShopCart, ShopLayout } from '../../../components/shop/ShopPortal'
import type { AuthUser } from '../../../lib/useAuth'

function StudentShopCartPage({ user }: { user: AuthUser }) {
  return (
    <ShopLayout user={user} basePath="/student/shop" title="Cart">
      <ShopCart user={user} basePath="/student/shop" />
    </ShopLayout>
  )
}

export default withAuth(StudentShopCartPage, { roles: ['Student'] })
